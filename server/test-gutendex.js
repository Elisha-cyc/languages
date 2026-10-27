const base = "https://gutendex.com/books?search=candide&languages=fr";

const tests = [
  ["1. plain request, no custom headers", `${base}&mime_type=text%2Fplain`, {}],
  [
    "2. with our User-Agent",
    `${base}&mime_type=text%2Fplain`,
    {
      "User-Agent": "LinguaApp/0.1 (no contact set)",
      Accept: "application/json",
    },
  ],
  ["3. without the mime_type filter", base, {}],
  [
    "4. the book text itself",
    "https://www.gutenberg.org/ebooks/4650.txt.utf-8",
    {},
  ],
];

async function time([label, url, headers]) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.text();
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `${label}: ${res.status}, ${body.length} characters, ${seconds}s`,
    );
  } catch (err) {
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `${label}: FAILED after ${seconds}s (${err.cause?.code || err.message})`,
    );
  }
}

(async () => {
  for (const test of tests) await time(test);
})();
