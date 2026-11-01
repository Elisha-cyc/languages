const { parse } = require("csv-parse/sync");
const supabase = require("./supabase");
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

  const books = [];
  const seen = new Set();

  for (const row of rows) {
    if (row.Type !== "Text") continue;

    const id = Number(row["Text#"]);
    const languages = String(row.Language || "")
      .split(/[;,\s/]+/)
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean);
    if (!Number.isInteger(id) || !languages.some((code) => wanted.has(code)))
      continue;
    if (seen.has(id)) continue; // INSERT OR REPLACE used to keep only the last copy
    seen.add(id);

    const title = String(row.Title || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) continue;
    const authors =
      String(row.Authors || "")
        .replace(/\s+/g, " ")
        .trim() || "Unknown author";

    books.push({
      id,
      title,
      authors,
      language: `,${languages.join(",")},`,
      title_key: searchKey(title),
      search: searchKey(`${title} ${authors}`),
    });
  }

  // One database transaction: the old catalog is only removed if the new one saves
  const { data: kept, error } = await supabase.rpc("replace_catalog", {
    p_rows: books,
  });
  if (error) throw new Error(`Could not save the catalog: ${error.message}`);

  console.log(`Saved ${kept} books in your 20 languages. Done.`);
}

main().catch((err) => {
  console.error("Catalog sync failed:", err.message);
  process.exit(1);
});
