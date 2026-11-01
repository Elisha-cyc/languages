
import sqlite3
import csv
from pathlib import Path

DB_PATH = Path("server/lingua.db")
OUTPUT_DIR = Path("migration/csv")

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

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

with sqlite3.connect(DB_PATH) as db:
    for table in TABLES:
        rows = db.execute(f'SELECT * FROM "{table}"').fetchall()
        columns = [
            column[1]
            for column in db.execute(f'PRAGMA table_info("{table}")')
        ]

        output_file = OUTPUT_DIR / f"{table}.csv"

        with output_file.open(
            "w", newline="", encoding="utf-8-sig"
        ) as file:
            writer = csv.writer(file)
            writer.writerow(columns)
            writer.writerows(rows)

        print(f"{table}: {len(rows)} rows exported")

print("CSV export complete.")
