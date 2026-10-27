const fields = "key,title,author_name,first_publish_year";

const variants = [
  ["1. our current query", { q: "candide language:fre", limit: "8", fields }],
  ["2. title field instead of q", { title: "candide", limit: "8", fields }],
  [
    "3. title field plus language",
    { title: "candide", language: "fre", limit: "8", fields },
  ],
  ["4. no language filter", { q: "candide", limit: "8", fields }],
];

async function time([label, params]) {
  const start = Date.now();
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?${new URLSearchParams(params)}`,
      {
        headers: { "User-Agent": "LinguaApp/0.1 (test)" },
        signal: AbortSignal.timeout(40000),
      },
    );
    const data = await res.json();
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `${label}: ${res.status}, ${(data.docs || []).length} results, ${seconds}s`,
    );
  } catch (err) {
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `${label}: FAILED after ${seconds}s (${err.cause?.code || err.message})`,
    );
  }
}

(async () => {
  for (const variant of variants) await time(variant);
})();
