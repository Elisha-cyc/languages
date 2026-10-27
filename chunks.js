// Cuts long text into parts, preferring a paragraph break, then the end of a sentence.
// Chinese, Japanese and Korean text gets smaller parts, because every character is
// worth much more than a letter and the tutor has a size limit.
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
const SENTENCE_END = "。！？!?…";
const CLOSERS = "”’」』）)\"'";

function findBreak(rest, size) {
  const min = Math.floor(size * 0.5);

  const paragraph = rest.lastIndexOf("\n\n", size);
  if (paragraph >= min) return paragraph;

  for (let i = Math.min(size, rest.length - 1); i >= min; i--) {
    const c = rest[i];

    if (SENTENCE_END.includes(c)) {
      // keep closing quotes and brackets with the sentence they belong to
      let end = i + 1;
      while (end < rest.length && CLOSERS.includes(rest[end])) end++;
      return end;
    }

    if (c === "." && /\s/.test(rest[i + 1] || " ")) return i + 1;
  }

  const line = rest.lastIndexOf("\n", size);
  if (line >= min) return line;

  return size;
}

export function splitIntoParts(text, size) {
  let rest = String(text).trim();

  const sample = rest.slice(0, 2000);
  const asian = (sample.match(CJK) || []).length;
  const limit = size || (asian > sample.length * 0.3 ? 800 : 3000);

  const parts = [];
  while (rest.length > limit) {
    const end = findBreak(rest, limit);
    parts.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
