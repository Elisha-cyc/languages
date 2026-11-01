
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

tables = [
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

with psycopg.connect(
    host=os.environ["SUPABASE_DB_HOST"],
    port=int(os.environ["SUPABASE_DB_PORT"]),
    dbname=os.environ["SUPABASE_DB_NAME"],
    user=os.environ["SUPABASE_DB_USER"],
    password=os.environ["SUPABASE_DB_PASSWORD"],
    sslmode="require",
) as conn:
    with conn.cursor() as cur:
        print("\nSUPABASE DESTINATION CHECK")
        print("-" * 35)

        total = 0

        for table in tables:
            cur.execute(f'SELECT COUNT(*) FROM public."{table}"')
            count = cur.fetchone()[0]
            total += count
            print(f"{table}: {count} rows")

        print("-" * 35)
        print(f"TOTAL: {total} rows")
