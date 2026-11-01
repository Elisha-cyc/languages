
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

env_file = Path(__file__).parent / ".env"
load_dotenv(env_file)

required = [
    "SUPABASE_DB_HOST",
    "SUPABASE_DB_PORT",
    "SUPABASE_DB_NAME",
    "SUPABASE_DB_USER",
    "SUPABASE_DB_PASSWORD",
]

missing = [key for key in required if not os.getenv(key)]

if missing:
    raise SystemExit(
        "Missing configuration values: " + ", ".join(missing)
    )

try:
    with psycopg.connect(
        host=os.environ["SUPABASE_DB_HOST"],
        port=int(os.environ["SUPABASE_DB_PORT"]),
        dbname=os.environ["SUPABASE_DB_NAME"],
        user=os.environ["SUPABASE_DB_USER"],
        password=os.environ["SUPABASE_DB_PASSWORD"],
        connect_timeout=15,
        sslmode="require",
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database(), version()")
            database, version = cur.fetchone()

            cur.execute("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
            """)
            table_count = cur.fetchone()[0]

        print("Connection successful!")
        print("Database:", database)
        print("Public tables:", table_count)
        print("PostgreSQL version:", version.split(",")[0])

except Exception as exc:
    print("Connection failed:", str(exc))
    raise SystemExit(1)
