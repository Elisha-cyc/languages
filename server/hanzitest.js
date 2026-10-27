function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wrongOptions(all, item, field, count = 3) {
  const seen = new Set([item[field]]);
  const options = [];
  for (const other of shuffle(all)) {
    if (!other[field] || seen.has(other[field])) continue;
    seen.add(other[field]);
    options.push(other[field]);
    if (options.length === count) break;
  }
  return options;
}

// chars: [{ char, pinyin, meaning }]. Returns `count` questions covering the whole set.
function buildHanziQuestions(chars, count = 40) {
  const usable = chars.filter((c) => c.char && c.pinyin && c.meaning);
  if (usable.length < 4) throw new Error("Not enough characters for a test");

  const kinds = [
    (c) => ({ question: `What does ${c.char} mean?`, field: "meaning" }),
    (c) => ({ question: `How do you say ${c.char}?`, field: "pinyin" }),
    (c) => ({
      question: `Which character means "${c.meaning}"?`,
      field: "char",
    }),
  ];

  return shuffle(usable)
    .slice(0, count)
    .map((c, i) => {
      const { question, field } = kinds[i % kinds.length](c);
      const wrong = wrongOptions(usable, c, field);
      const options = shuffle([c[field], ...wrong]);
      return {
        question,
        options,
        answer: options.indexOf(c[field]),
        explanation: `${c.char} (${c.pinyin}): ${c.meaning}`,
      };
    })
    .filter((q) => q.options.length === 4);
}

module.exports = { buildHanziQuestions };
