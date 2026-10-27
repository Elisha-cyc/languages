const { parse } = require("csv-parse/sync");
const db = require("./database");
const { BOOK_LANGUAGES, searchKey } = require("./books");

const CATALOG_URL = "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv";
const USER_AGENT = `LinguaApp/0.1 (${process.env.CONTACT_EMAIL || "no contact set"})`;

async function main() {
  console.log(
    "Downloading the Project Gutenberg catalog (one file, a few MB)...",
  );

  const res = await fetch(CATALOG_URL, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(3 * 60 * 1000),
  });
  if (!res.ok) throw new Error(`Download failed with status ${res.status}`);

  const rows = parse(await res.text(), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });
  console.log(`Downloaded ${rows.length} catalog entries.`);

  if (rows.length === 0 || !("Text#" in rows[0])) {
    throw new Error(
      `Unexpected columns: ${rows[0] ? Object.keys(rows[0]).join(", ") : "none"}`,
    );
  }

  const wanted = new Set(Object.values(BOOK_LANGUAGES).map((l) => l.gutenberg));
  const add = db.prepare(
    `INSERT OR REPLACE INTO catalog (id, title, authors, language, title_key, search)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  let kept = 0;
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM catalog");

    for (const row of rows) {
      if (row.Type !== "Text") continue;

      const id = Number(row["Text#"]);
      const languages = String(row.Language || "")
        .split(/[;,\s/]+/)
        .map((code) => code.trim().toLowerCase())
        .filter(Boolean);
      if (!Number.isInteger(id) || !languages.some((code) => wanted.has(code)))
        continue;

      const title = String(row.Title || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!title) continue;
      const authors =
        String(row.Authors || "")
          .replace(/\s+/g, " ")
          .trim() || "Unknown author";

      add.run(
        id,
        title,
        authors,
        `,${languages.join(",")},`,
        searchKey(title),
        searchKey(`${title} ${authors}`),
      );
      kept++;
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log(`Saved ${kept} books in your 20 languages. Done.`);
}

main().catch((err) => {
  console.error("Catalog sync failed:", err.message);
  process.exit(1);
});
