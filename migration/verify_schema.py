
import os
import sqlite3
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
SQLITE_DB = ROOT / "server" / "lingua.db"

load_dotenv(Path(__file__).parent / ".env")

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

with sqlite3.connect(SQLITE_DB) as sqlite_db:
    sqlite_columns = {}

    for table in TABLES:
        sqlite_columns[table] = [
            row[1]
            for row in sqlite_db.execute(
                f'PRAGMA table_info("{table}")'
            )
        ]

with psycopg.connect(
    host=os.environ["SUPABASE_DB_HOST"],
    port=int(os.environ["SUPABASE_DB_PORT"]),
    dbname=os.environ["SUPABASE_DB_NAME"],
    user=os.environ["SUPABASE_DB_USER"],
    password=os.environ["SUPABASE_DB_PASSWORD"],
    sslmode="require",
) as pg_db:
    with pg_db.cursor() as cur:
        cur.execute("""
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """)

        pg_columns = {}

        for table, column in cur.fetchall():
            pg_columns.setdefault(table, []).append(column)

print("\nSCHEMA VERIFICATION")
print("=" * 45)

all_match = True

for table in TABLES:
    source = sqlite_columns[table]
    destination = pg_columns.get(table, [])

    missing = [column for column in source if column not in destination]
    extra = [column for column in destination if column not in source]

    if missing or extra:
        all_match = False
        print(f"\nMISMATCH: {table}")
        if missing:
            print("  Missing in Supabase:", missing)
        if extra:
            print("  Extra in Supabase:", extra)
    else:
        print(f"OK: {table} ({len(source)} columns)")

print("\n" + "=" * 45)

if all_match:
    print("All table column names match.")
else:
    print("Schema differences found. Do not import yet.")
