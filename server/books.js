const db = require("./database");

const OPEN_LIBRARY = "https://openlibrary.org";
const ALLOWED_TEXT_HOSTS = new Set(["www.gutenberg.org", "gutenberg.org"]);

// Open Library asks for a descriptive User-Agent with a contact address
const USER_AGENT = `LinguaApp/0.1 (${process.env.CONTACT_EMAIL || "no contact set"})`;

const SEARCH_TIMEOUT_MS = 30 * 1000; // Open Library can be slow
const DOWNLOAD_TIMEOUT_MS = 60 * 1000;
const MAX_BOOK_BYTES = 15 * 1024 * 1024;
const SECTION_CHARS = 60000;

// Our language names mapped to Gutenberg (2-letter) and Open Library (3-letter) codes
const BOOK_LANGUAGES = {
  French: { gutenberg: "fr", openLibrary: "fre" },
  Spanish: { gutenberg: "es", openLibrary: "spa" },
  German: { gutenberg: "de", openLibrary: "ger" },
  Italian: { gutenberg: "it", openLibrary: "ita" },
  Portuguese: { gutenberg: "pt", openLibrary: "por" },
  Dutch: { gutenberg: "nl", openLibrary: "dut" },
  Swedish: { gutenberg: "sv", openLibrary: "swe" },
  Polish: { gutenberg: "pl", openLibrary: "pol" },
  Turkish: { gutenberg: "tr", openLibrary: "tur" },
  Indonesian: { gutenberg: "id", openLibrary: "ind" },
  Swahili: { gutenberg: "sw", openLibrary: "swa" },
  Russian: { gutenberg: "ru", openLibrary: "rus" },
  "Mandarin Chinese": { gutenberg: "zh", openLibrary: "chi" },
  Japanese: { gutenberg: "ja", openLibrary: "jpn" },
  Korean: { gutenberg: "ko", openLibrary: "kor" },
  Hindi: { gutenberg: "hi", openLibrary: "hin" },
  Arabic: { gutenberg: "ar", openLibrary: "ara" },
  Greek: { gutenberg: "el", openLibrary: "gre" },
  Hebrew: { gutenberg: "he", openLibrary: "heb" },
  Thai: { gutenberg: "th", openLibrary: "tha" },
};

class BookError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new BookError(
      `${new URL(url).hostname} answered ${res.status}`,
      res.status === 404 ? 404 : 502,
    );
  }
  return res.json();
}

// Keep letters, numbers, spaces, apostrophes and hyphens, so a title
// cannot change the meaning of an Open Library search query
function cleanQuery(text) {
  return text
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Lowercase, no accents, no punctuation: used to compare and search titles
function searchKey(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// ---------- Free books: Project Gutenberg catalog stored in our database ----------

// Show the main authors only, without roles like "[Illustrator]"
function tidyAuthors(authors) {
  return (
    authors
      .split(";")
      .map((name) => name.replace(/\[[^\]]*\]/g, "").trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("; ") || "Unknown author"
  );
}

function searchCatalog(title, code) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM catalog").get().n;
  if (count === 0) {
    throw new BookError(
      "The free-book catalog has not been downloaded yet. Run: node --env-file=.env sync-catalog.js",
      503,
    );
  }

  const key = searchKey(title);
  const words = key.split(" ").filter(Boolean).slice(0, 6);
  if (words.length === 0) return [];

  // Every word typed must appear in the title or the author
  const wordTests = words.map(() => "search LIKE ?").join(" AND ");

  return db
    .prepare(
      `SELECT id, title, authors
       FROM catalog
       WHERE language LIKE ? AND ${wordTests}
       ORDER BY (title_key LIKE ?) DESC, LENGTH(title) ASC
       LIMIT 8`,
    )
    .all(`%,${code},%`, ...words.map((word) => `%${word}%`), `${key}%`)
    .map((book) => ({ ...book, authors: tidyAuthors(book.authors) }));
}

function searchFreeBooks(rawTitle, languageName) {
  const title = cleanQuery(rawTitle);
  if (title.length < 2) throw new BookError("Enter a book title.", 400);
  return searchCatalog(title, BOOK_LANGUAGES[languageName].gutenberg);
}

// ---------- Details-only results: Open Library ----------

async function searchOpenLibrary(title, code) {
  const query = new URLSearchParams({
    q: `${title} language:${code}`,
    limit: "8",
    fields: "key,title,author_name,first_publish_year",
  });
  const data = await getJson(`${OPEN_LIBRARY}/search.json?${query}`);

  return (data.docs || []).map((doc) => ({
    key: doc.key,
    title: doc.title,
    authors: (doc.author_name || []).slice(0, 2).join("; ") || "Unknown author",
    year: doc.first_publish_year || null,
  }));
}

// Remember good Open Library results for 10 minutes. Failed searches are never remembered.
const detailCache = new Map();
const DETAIL_CACHE_MS = 10 * 60 * 1000;
const DETAIL_CACHE_SIZE = 100;

async function searchDetailBooks(rawTitle, languageName) {
  const title = cleanQuery(rawTitle);
  if (title.length < 2) throw new BookError("Enter a book title.", 400);

  const key = `${languageName}|${searchKey(title)}`;
  const hit = detailCache.get(key);
  if (hit && Date.now() - hit.at < DETAIL_CACHE_MS) return hit.data;

  const data = await searchOpenLibrary(
    title,
    BOOK_LANGUAGES[languageName].openLibrary,
  );

  detailCache.set(key, { at: Date.now(), data });
  if (detailCache.size > DETAIL_CACHE_SIZE) {
    detailCache.delete(detailCache.keys().next().value);
  }
  return data;
}

// ---------- Reading a free book ----------

// Remove the Project Gutenberg license text before and after the book
function stripBoilerplate(text) {
  const startMatch = /\*\*\* ?START OF[^\n]*\n/i.exec(text);
  const from = startMatch ? startMatch.index + startMatch[0].length : 0;
  const endMatch = /\*\*\* ?END OF/i.exec(text.slice(from));
  const to = endMatch ? from + endMatch.index : text.length;
  return text.slice(from, to).replace(/\r\n/g, "\n").trim();
}

// Cut a long text into sections of about SECTION_CHARS, preferring paragraph breaks
function splitSections(text) {
  const sections = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + SECTION_CHARS, text.length);
    if (end < text.length) {
      let cut = text.lastIndexOf("\n\n", end);
      if (cut <= start + SECTION_CHARS * 0.5) cut = text.lastIndexOf("\n", end);
      if (cut > start + SECTION_CHARS * 0.5) end = cut;
    }
    const piece = text.slice(start, end).trim();
    if (piece) sections.push(piece);
    start = end;
  }
  return sections;
}

// A book can live at different Gutenberg addresses, so try each one in turn
const TEXT_URLS = (id) => [
  `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
  `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
];

async function downloadText(id) {
  let lastError = null;

  for (const url of TEXT_URLS(id)) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (res.status === 404) continue;
      if (!res.ok) {
        lastError = new BookError(`Gutenberg answered ${res.status}`, 502);
        continue;
      }
      if (!ALLOWED_TEXT_HOSTS.has(new URL(res.url).hostname)) {
        lastError = new BookError("Unexpected download address.", 502);
        continue;
      }

      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_BOOK_BYTES) {
        throw new BookError("That book is too large.", 413);
      }
      return bytes;
    } catch (err) {
      if (err instanceof BookError && err.status === 413) throw err;
      console.error(
        "Book download failed:",
        url,
        err.cause ? err.cause.code || err.cause.message : err.message,
      );
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError instanceof BookError
      ? lastError
      : new BookError("The book could not be downloaded.", 502);
  }
  throw new BookError("That book has no plain-text edition.", 404);
}

// Keep the last few books in memory so reading section after section
// does not download the same file again
const cache = new Map();
const CACHE_SIZE = 5;

async function loadBook(id) {
  if (!Number.isInteger(id) || id < 1)
    throw new BookError("Bad book number.", 400);
  if (cache.has(id)) return cache.get(id);

  // Only books in our own catalog can be read
  const row = db.prepare("SELECT title FROM catalog WHERE id = ?").get(id);
  if (!row)
    throw new BookError("That book is not available to read here.", 404);

  const bytes = await downloadText(id);

  const sections = splitSections(stripBoilerplate(bytes.toString("utf8")));
  if (sections.length === 0)
    throw new BookError("That book has no readable text.", 422);

  const book = { title: row.title, sections };
  cache.set(id, book);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
  return book;
}

// Lists readable books in a language without typing a title (Chinese has few books)
function browseFreeBooks(languageName) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM catalog").get().n;
  if (count === 0) {
    throw new BookError(
      "The free-book catalog has not been downloaded yet. Run: node --env-file=.env sync-catalog.js",
      503,
    );
  }
  const code = BOOK_LANGUAGES[languageName].gutenberg;
  return db
    .prepare(
      `SELECT id, title, authors FROM catalog
       WHERE language LIKE ? ORDER BY title LIMIT 60`,
    )
    .all(`%,${code},%`)
    .map((book) => ({ ...book, authors: tidyAuthors(book.authors) }));
}

// ---------- Wikisource: free texts in many languages ----------
const WIKISOURCE = {
  French: "fr", Spanish: "es", German: "de", Italian: "it", Portuguese: "pt",
  Dutch: "nl", Swedish: "sv", Polish: "pl", Turkish: "tr", Indonesian: "id",
  Swahili: "sw", Russian: "ru", "Mandarin Chinese": "zh", Japanese: "ja",
  Korean: "ko", Hindi: "hi", Arabic: "ar", Greek: "el", Hebrew: "he", Thai: "th",
};

function wikiHost(languageName) {
  const code = WIKISOURCE[languageName];
  if (!code) throw new BookError("That language is not available.", 400);
  return `${code}.wikisource.org`;
}

async function searchWikisource(rawTitle, languageName) {
  const title = cleanQuery(rawTitle);
  if (title.length < 2) throw new BookError("Enter a book title.", 400);

  const query = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: title,
    srnamespace: "0",
    srlimit: "15",
    srprop: "wordcount",
    format: "json",
    formatversion: "2",
  });

  try {
    const data = await getJson(`https://${wikiHost(languageName)}/w/api.php?${query}`);
    return ((data.query && data.query.search) || [])
      .filter((item) => item.wordcount >= 300) // skip tiny pages and contents lists
      .slice(0, 8)
      .map((item) => ({ title: item.title, words: item.wordcount }));
  } catch (err) {
    if (err instanceof BookError && err.status === 400) throw err;
    // A language with no Wikisource, or a network problem: just no results
    console.error("Wikisource search failed:", languageName, err.cause ? err.cause.code : err.message);
    return [];
  }
}

function numberToChar(n) {
  const code = Number(n);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

function htmlToText(html) {
  return html
    .replace(/<(script|style|table|sup)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => numberToChar(n))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function loadWikisource(languageName, pageTitle) {
  const title = String(pageTitle || "").trim();
  if (!title || title.length > 200) throw new BookError("Bad title.", 400);

  const key = `wiki|${languageName}|${title}`;
  if (cache.has(key)) return cache.get(key);

  const query = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "text",
    redirects: "1",
    disableeditsection: "1",
    format: "json",
    formatversion: "2",
  });
  const data = await getJson(`https://${wikiHost(languageName)}/w/api.php?${query}`);

  const html = data.parse && data.parse.text;
  if (!html) throw new BookError("That text is not available.", 404);

  const text = htmlToText(html);
  if (text.length < 300) {
    throw new BookError("That page has almost no text. Try another result.", 422);
  }

  const book = { title: data.parse.title || title, sections: splitSections(text) };
  cache.set(key, book);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
  return book;
}

module.exports = {
  searchFreeBooks,
  searchDetailBooks,
  browseFreeBooks,
  searchWikisource,
  loadWikisource,
  loadBook,
  searchKey,
  BOOK_LANGUAGES,
  BookError,
};