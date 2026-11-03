"use strict";

// Lessons are written once, in the server's NATIVE_LANGUAGE (usually English).
// This turns their meanings and titles into the language each user picked,
// translating once and saving the result in the "translations" table.
//
// If the AI is busy or fails, the user simply sees the original text, so a
// lesson never breaks because of a translation problem.

const supabase = require("./supabase");
const { completeJson } = require("./aijson");

const BASE_LANGUAGE = process.env.NATIVE_LANGUAGE || "English";
const MAX_BATCH = 40;

function needsTranslation(language) {
  return (
    typeof language === "string" &&
    language.trim() !== "" &&
    language !== BASE_LANGUAGE
  );
}

function parseItems(reply) {
  const cleaned = String(reply || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    const data = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(data.items) ? data.items : null;
  } catch {
    return null;
  }
}

// Returns a Map of original text -> translated text (only the ones that worked)
async function translateTexts(texts, target) {
  const translated = new Map();
  const unique = [...new Set(texts)];

  for (let i = 0; i < unique.length; i += MAX_BATCH) {
    const batch = unique.slice(i, i + MAX_BATCH);

    const reply = await completeJson(
      [
        {
          role: "system",
          content:
            "You translate short vocabulary meanings and lesson titles. " +
            "Return one valid JSON object only, with no markdown.",
        },
        {
          role: "user",
          content: [
            `Translate each item from ${BASE_LANGUAGE} into ${target}.`,
            "Keep each translation natural and as short as the original.",
            `Return exactly: {"items":["..."]} with the same number of items, in the same order.`,
            `Items: ${JSON.stringify(batch)}`,
          ].join("\n"),
        },
      ],
      3000,
    );

    const items = parseItems(reply);
    if (!items || items.length !== batch.length) continue; // skip a bad batch

    batch.forEach((original, index) => {
      const text = items[index];
      if (typeof text === "string" && text.trim() && text.length <= 300) {
        translated.set(original, text.trim());
      }
    });
  }

  return translated;
}

async function readCache(kind, ids, language) {
  const cached = new Map();
  if (ids.length === 0) return cached;

  const { data, error } = await supabase
    .from("translations")
    .select("ref_id, text")
    .eq("kind", kind)
    .eq("language", language)
    .in("ref_id", ids);

  if (error) {
    console.error("Translation cache read failed:", error.message);
    return cached;
  }
  for (const row of data) cached.set(Number(row.ref_id), row.text);
  return cached;
}

// rows: [{ id, [field]: "text in the base language", ... }]
// Returns the same rows with [field] in the user's language where possible.
async function localize(kind, rows, field, language) {
  if (
    !needsTranslation(language) ||
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return rows;
  }

  try {
    const cached = await readCache(
      kind,
      rows.map((row) => row.id),
      language,
    );

    const missing = rows.filter(
      (row) => !cached.has(row.id) && String(row[field] || "").trim(),
    );

    if (missing.length > 0) {
      const translated = await translateTexts(
        missing.map((row) => row[field]),
        language,
      );

      const toSave = [];
      for (const row of missing) {
        const text = translated.get(row[field]);
        if (text) {
          cached.set(row.id, text);
          toSave.push({ kind, ref_id: row.id, language, text });
        }
      }

      if (toSave.length > 0) {
        const { error } = await supabase
          .from("translations")
          .upsert(toSave, { onConflict: "kind,ref_id,language" });
        if (error) console.error("Translation save failed:", error.message);
      }
    }

    return rows.map((row) =>
      cached.has(row.id) ? { ...row, [field]: cached.get(row.id) } : row,
    );
  } catch (err) {
    console.error("Translation skipped:", String(err.message).slice(0, 200));
    return rows;
  }
}

module.exports = { localize };
