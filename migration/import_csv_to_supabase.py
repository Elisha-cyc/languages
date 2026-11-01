
import csv
import os
from pathlib import Path

import psycopg
from psycopg import sql
from dotenv import load_dotenv


# --------------------------------------------------
# 1. Configuration
# --------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT / "migration" / "csv"
ENV_FILE = ROOT / "migration" / ".env"

TABLES = [
    "languages",
    "levels",
    "users",
    "catalog",
    "units",
    "lessons",
    "words",
    "progress",
    "sessions",
    "sleep_sessions",
    "sleep_items",
    "sleep_session_words",
    "hanzi_progress",
]

load_dotenv(ENV_FILE)

REQUIRED_VARIABLES = [
    "SUPABASE_DB_HOST",
    "SUPABASE_DB_PORT",
    "SUPABASE_DB_NAME",
    "SUPABASE_DB_USER",
    "SUPABASE_DB_PASSWORD",
]

missing = [
    key for key in REQUIRED_VARIABLES
    if not os.getenv(key)
]

if missing:
    raise SystemExit(
        "Missing configuration values: "
        + ", ".join(missing)
    )


# --------------------------------------------------
# 2. Validate all CSV files before importing
# --------------------------------------------------

csv_columns = {}
expected_counts = {}

for table in TABLES:
    csv_path = CSV_DIR / f"{table}.csv"

    if not csv_path.is_file():
        raise SystemExit(
            f"CSV file not found: {csv_path}"
        )

    with csv_path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.reader(file)
        columns = next(reader, None)

        if not columns:
            raise SystemExit(
                f"CSV is empty or has no header: {csv_path}"
            )

        if len(columns) != len(set(columns)):
            raise SystemExit(
                f"Duplicate column names in {csv_path}"
            )

        csv_columns[table] = columns
        expected_counts[table] = sum(
            1 for _ in reader
        )

source_total = sum(expected_counts.values())

print("CSV validation successful.")
print(f"Source rows: {source_total:,}")


# --------------------------------------------------
# 3. Connect to Supabase
# --------------------------------------------------

connection_settings = {
    "host": os.environ["SUPABASE_DB_HOST"],
    "port": int(os.environ["SUPABASE_DB_PORT"]),
    "dbname": os.environ["SUPABASE_DB_NAME"],
    "user": os.environ["SUPABASE_DB_USER"],
    "password": os.environ["SUPABASE_DB_PASSWORD"],
    "sslmode": "require",
    "connect_timeout": 20,
}


# --------------------------------------------------
# 4. Import everything in one transaction
# --------------------------------------------------

try:
    with psycopg.connect(
        **connection_settings
    ) as conn:

        with conn.cursor() as cur:

            # Refuse to import if any destination
            # table already contains records.
            for table in TABLES:
                cur.execute(
                    sql.SQL(
                        "SELECT COUNT(*) FROM {}"
                    ).format(
                        sql.Identifier("public", table)
                    )
                )

                existing_count = cur.fetchone()[0]

                if existing_count != 0:
                    raise RuntimeError(
                        f"Import stopped: {table} already "
                        f"contains {existing_count} rows. "
                        "No import was performed."
                    )

            # Verify exact column order in every table.
            for table in TABLES:
                cur.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = %s
                    ORDER BY ordinal_position
                    """,
                    (table,),
                )

                destination_columns = [
                    row[0] for row in cur.fetchall()
                ]

                if destination_columns != csv_columns[table]:
                    raise RuntimeError(
                        f"Column order mismatch in {table}.\n"
                        f"CSV: {csv_columns[table]}\n"
                        f"Supabase: {destination_columns}"
                    )

            print("Destination tables are empty.")
            print("Column order verified.")
            print("\nStarting import...\n")

            # Import tables in foreign-key order.
            for table in TABLES:
                csv_path = CSV_DIR / f"{table}.csv"
                columns = csv_columns[table]

                copy_command = sql.SQL(
                    "COPY {} ({}) FROM STDIN "
                    "WITH (FORMAT CSV, HEADER TRUE)"
                ).format(
                    sql.Identifier("public", table),
                    sql.SQL(", ").join(
                        sql.Identifier(column)
                        for column in columns
                    ),
                )

                with csv_path.open(
                    "r",
                    encoding="utf-8-sig",
                    newline="",
                ) as file:

                    with cur.copy(copy_command) as copy:
                        copy.write(file.read())

                # Verify the imported count.
                cur.execute(
                    sql.SQL(
                        "SELECT COUNT(*) FROM {}"
                    ).format(
                        sql.Identifier("public", table)
                    )
                )

                actual_count = cur.fetchone()[0]
                expected_count = expected_counts[table]

                if actual_count != expected_count:
                    raise RuntimeError(
                        f"Count mismatch in {table}: "
                        f"expected {expected_count}, "
                        f"found {actual_count}"
                    )

                print(
                    f"OK: {table} — "
                    f"{actual_count:,} rows"
                )

            # Reset PostgreSQL sequences only for tables
            # whose CSV actually contains an id column.
            for table in TABLES:

                if "id" not in csv_columns[table]:
                    continue

                cur.execute(
                    """
                    SELECT pg_get_serial_sequence(
                        %s, 'id'
                    )
                    """,
                    (f"public.{table}",),
                )

                sequence = cur.fetchone()[0]

                # Some id columns are not sequence-backed.
                if sequence is None:
                    continue

                cur.execute(
                    sql.SQL(
                        "SELECT MAX(id) FROM {}"
                    ).format(
                        sql.Identifier("public", table)
                    )
                )

                maximum_id = cur.fetchone()[0]

                if maximum_id is not None:
                    cur.execute(
                        "SELECT setval(%s::regclass, %s, true)",
                        (sequence, maximum_id),
                    )

            print("\nAll import checks passed.")
            print("Preparing to commit transaction...")

    # Exiting the connection context commits on success.
    print("\nIMPORT SUCCESSFUL!")
    print(f"Total rows imported: {source_total:,}")
    print("All table counts verified.")

except Exception as exc:
    print("\nIMPORT FAILED.")
    print(f"Reason: {exc}")
    print(
        "The transaction should roll back if it "
        "has not already committed."
    )
    raise SystemExit(1)
