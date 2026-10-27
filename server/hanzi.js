const express = require("express");
const db = require("./database");
const { LESSONS, TECHNIQUES, ALL_CHARS } = require("./hanzi-data");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const BY_CHAR = new Map(ALL_CHARS.map((item) => [item.char, item]));
const TEST_TYPES = ["meaning", "pinyin", "strokes"];
const MIN_TO_TEST = 4;

db.exec(`
  CREATE TABLE IF NOT EXISTS hanzi_progress (
    user_id INTEGER NOT NULL REFERENCES users(id),
    char TEXT NOT NULL,
    learned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, char)
  );
`);

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getUser(id) {
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  return db.prepare("SELECT id FROM users WHERE id = ?").get(n);
}

function learnedRows(userId) {
  return db
    .prepare(
      "SELECT char, correct, wrong FROM hanzi_progress WHERE user_id = ?",
    )
    .all(userId)
    .filter((row) => BY_CHAR.has(row.char));
}

// The answer to a question, as text
function valueFor(item, type) {
  if (type === "meaning") return item.meaning;
  if (type === "pinyin") return item.pinyin;
  return String(item.strokes);
}

function makeQuestion(item, type) {
  const correct = valueFor(item, type);
  let wrong;

  if (type === "strokes") {
    const n = item.strokes;
    wrong = [n - 2, n - 1, n + 1, n + 2, n + 3]
      .filter((x) => x >= 1 && x !== n)
      .map(String);
  } else {
    wrong = [
      ...new Set(ALL_CHARS.map((other) => valueFor(other, type))),
    ].filter((v) => v !== correct);
  }

  return {
    char: item.char,
    type,
    options: shuffle([correct, ...shuffle(wrong).slice(0, 3)]),
  };
}

function record(userId, char, correct) {
  db.prepare(
    `INSERT INTO hanzi_progress (user_id, char, correct, wrong) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, char) DO UPDATE SET
       correct = correct + excluded.correct, wrong = wrong + excluded.wrong`,
  ).run(userId, char, correct ? 1 : 0, correct ? 0 : 1);
}

// ---------- Home: lessons and progress ----------
router.get("/home", (req, res) => {
  const user = getUser(req.query.user);
  if (!user) return res.status(404).json({ error: "That user does not exist" });

  const rows = learnedRows(user.id);
  const learned = new Set(rows.map((row) => row.char));

  res.json({
    lessons: LESSONS.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      total: lesson.chars.length,
      learned: lesson.chars.filter((item) => learned.has(item.char)).length,
    })),
    learned: rows.length,
    total: ALL_CHARS.length,
    mastered: rows.filter((row) => row.correct >= 3 && row.correct > row.wrong)
      .length,
    review: rows
      .filter((row) => row.wrong > row.correct)
      .map((row) => row.char),
  });
});

router.get("/lessons/:id", (req, res) => {
  const lesson = LESSONS.find((item) => item.id === Number(req.params.id));
  if (!lesson) return res.status(404).json({ error: "Lesson not found" });
  res.json(lesson);
});

router.get("/techniques", (req, res) => res.json(TECHNIQUES));

router.post("/learned", (req, res) => {
  const { user_id, chars } = req.body || {};
  const user = getUser(user_id);
  if (!user) return res.status(404).json({ error: "That user does not exist" });
  if (
    !Array.isArray(chars) ||
    chars.length === 0 ||
    chars.length > 20 ||
    !chars.every((ch) => BY_CHAR.has(ch))
  ) {
    return res
      .status(400)
      .json({ error: "chars must be a short list of known characters" });
  }

  const add = db.prepare(
    "INSERT OR IGNORE INTO hanzi_progress (user_id, char) VALUES (?, ?)",
  );
  for (const ch of chars) add.run(user.id, ch);
  res.json({ saved: chars.length });
});

// ---------- Multiple-choice tests ----------
router.get("/test", (req, res) => {
  const user = getUser(req.query.user);
  if (!user) return res.status(404).json({ error: "That user does not exist" });

  const type = req.query.type;
  if (!TEST_TYPES.includes(type)) {
    return res
      .status(400)
      .json({ error: `type must be one of: ${TEST_TYPES.join(", ")}` });
  }
  const count = Math.min(Math.max(Number(req.query.count) || 10, 1), 20);

  const pool = learnedRows(user.id).map((row) => BY_CHAR.get(row.char));
  if (pool.length < MIN_TO_TEST) {
    return res.status(400).json({
      error: `Learn at least ${MIN_TO_TEST} characters first: open a lesson and go through every card.`,
    });
  }

  res.json(
    shuffle(pool)
      .slice(0, count)
      .map((item) => makeQuestion(item, type)),
  );
});

router.post("/test", (req, res) => {
  const { user_id, type, answers } = req.body || {};
  const user = getUser(user_id);
  if (!user) return res.status(404).json({ error: "That user does not exist" });
  if (!TEST_TYPES.includes(type))
    return res.status(400).json({ error: "Unknown test type" });
  if (!Array.isArray(answers) || answers.length === 0 || answers.length > 20) {
    return res
      .status(400)
      .json({ error: "answers must be a list of 1 to 20 answers" });
  }

  const results = [];
  for (const a of answers) {
    const item = a && BY_CHAR.get(a.char);
    if (!item)
      return res
        .status(400)
        .json({ error: "Unknown character in the answers" });
    const expected = valueFor(item, type);
    results.push({
      char: item.char,
      pinyin: item.pinyin,
      meaning: item.meaning,
      expected,
      answer: String(a.answer),
      correct: String(a.answer) === expected,
    });
  }

  db.exec("BEGIN");
  try {
    for (const r of results) record(user.id, r.char, r.correct);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("Hanzi test error:", err);
    return res.status(500).json({ error: "Could not save the test." });
  }

  res.json({
    score: results.filter((r) => r.correct).length,
    total: results.length,
    results,
  });
});

// ---------- Writing practice ----------

// Characters to write from memory: the weakest ones first
router.get("/practice", (req, res) => {
  const user = getUser(req.query.user);
  if (!user) return res.status(404).json({ error: "That user does not exist" });

  const count = Math.min(Math.max(Number(req.query.count) || 5, 1), 10);
  const rows = learnedRows(user.id);
  if (rows.length === 0) {
    return res
      .status(400)
      .json({
        error:
          "Learn a few characters first: open a lesson and go through the cards.",
      });
  }

  const ordered = shuffle(rows).sort(
    (a, b) => b.wrong - b.correct - (a.wrong - a.correct),
  );
  res.json(
    ordered.slice(0, count).map((row) => {
      const item = BY_CHAR.get(row.char);
      return { char: item.char, pinyin: item.pinyin, meaning: item.meaning };
    }),
  );
});

router.post("/written", (req, res) => {
  const { user_id, char, mistakes } = req.body || {};
  const user = getUser(user_id);
  if (!user) return res.status(404).json({ error: "That user does not exist" });
  if (!BY_CHAR.has(char) || !Number.isInteger(mistakes) || mistakes < 0) {
    return res.status(400).json({ error: "char and mistakes are required" });
  }
  record(user.id, char, mistakes === 0);
  res.json({ saved: true });
});

// ---------- The page that draws and checks strokes (Hanzi Writer) ----------
// ---------- The page that draws and checks strokes (Hanzi Writer) ----------
// The library and the stroke data come from this server, not from the internet
const WRITER_JS = path.join(__dirname, "node_modules", "hanzi-writer", "dist", "hanzi-writer.min.js");
const DATA_DIR = path.join(__dirname, "node_modules", "hanzi-writer-data");

router.get("/lib/hanzi-writer.js", (req, res) => {
  if (!fs.existsSync(WRITER_JS)) {
    return res.status(404).type("text").send("Missing. In the server folder run: npm install hanzi-writer hanzi-writer-data");
  }
  res.set("Cache-Control", "public, max-age=86400");
  res.type("application/javascript").sendFile(WRITER_JS);
});

router.get("/data/:file", (req, res) => {
  const chars = [...String(req.params.file).replace(/\.json$/i, "")];
  if (chars.length !== 1 || !/\p{Script=Han}/u.test(chars[0])) {
    return res.status(400).json({ error: "One Chinese character is required." });
  }
  const file = path.join(DATA_DIR, `${chars[0]}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "No stroke data for that character." });
  res.set("Cache-Control", "public, max-age=86400");
  res.type("application/json").sendFile(file);
});

router.get("/writer", (req, res) => {
  const chars = [...String(req.query.char || "")];
  if (chars.length !== 1 || !/\p{Script=Han}/u.test(chars[0])) {
    return res.status(400).send("One Chinese character is required.");
  }
  const mode = req.query.mode === "quiz" ? "quiz" : "animate";
  const outline = req.query.outline === "0" ? false : true;
  const size = Math.min(Math.max(Number(req.query.size) || 260, 120), 500);

  res.type("html").send(writerPage({ char: chars[0], mode, outline, size }));
});

function writerPage(config) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; background: #fff; font-family: system-ui, sans-serif; text-align: center; color: #333; }
  #wrap { position: relative; display: inline-block; margin-top: 8px; }
  #grid { position: absolute; left: 0; top: 0; pointer-events: none; }
  #target { position: relative; touch-action: none; }
  #msg { min-height: 22px; font-size: 15px; margin: 8px 8px 4px; color: #444; }
  button { background: #dbe7ff; color: #2a6fdb; border: 0; border-radius: 10px; padding: 10px 16px; font-size: 15px; margin: 4px; cursor: pointer; }
</style></head>
<body>
<div id="wrap"><svg id="grid"></svg><div id="target"></div></div>
<div id="msg">Loading...</div>
<div id="buttons"></div>
<script src="/hanzi/lib/hanzi-writer.js"></script>
<script>
  var cfg = ${JSON.stringify(config)};
  var s = cfg.size;
  var msgEl = document.getElementById("msg");
  function say(text) { msgEl.textContent = text; }
  window.onerror = function (m) { say("Error: " + m); };

  function post(m) {
    var text = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent !== window) window.parent.postMessage(text, "*");
  }
  function addButton(label, onClick) {
    var b = document.createElement("button");
    b.textContent = label;
    b.onclick = onClick;
    document.getElementById("buttons").appendChild(b);
    return b;
  }

  if (typeof HanziWriter === "undefined") {
    say("The writing library did not load. In the server folder run: npm install hanzi-writer hanzi-writer-data, then restart the server.");
  } else {
    var grid = document.getElementById("grid");
    grid.setAttribute("width", s);
    grid.setAttribute("height", s);
    var dash = 'stroke="#e3a1a1" stroke-width="1" stroke-dasharray="5,5"';
    grid.innerHTML =
      '<rect x="1" y="1" width="' + (s - 2) + '" height="' + (s - 2) + '" fill="none" stroke="#d98a8a" stroke-width="2"/>' +
      '<line x1="0" y1="0" x2="' + s + '" y2="' + s + '" ' + dash + '/>' +
      '<line x1="' + s + '" y1="0" x2="0" y2="' + s + '" ' + dash + '/>' +
      '<line x1="' + s / 2 + '" y1="0" x2="' + s / 2 + '" y2="' + s + '" ' + dash + '/>' +
      '<line x1="0" y1="' + s / 2 + '" x2="' + s + '" y2="' + s / 2 + '" ' + dash + '/>';

    var writer = HanziWriter.create("target", cfg.char, {
      width: s,
      height: s,
      padding: 20,
      showOutline: cfg.outline,
      showCharacter: cfg.mode === "animate",
      strokeColor: "#222222",
      outlineColor: "#dddddd",
      highlightColor: "#2a6fdb",
      drawingColor: "#2a6fdb",
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 250,
      charDataLoader: function (char, onLoad, onError) {
        fetch("/hanzi/data/" + encodeURIComponent(char) + ".json")
          .then(function (r) { if (!r.ok) throw new Error("no data"); return r.json(); })
          .then(onLoad)
          .catch(onError);
      },
      onLoadCharDataError: function () {
        say("Could not load the stroke data for this character. Run: npm install hanzi-writer-data in the server folder.");
      }
    });

    if (cfg.mode === "animate") {
      var total = 0;
      var next = 0;
      writer.getCharacterData().then(function (data) {
        total = data.strokes.length;
        say("This character has " + total + " strokes.");
      });

      addButton("Watch", function () { next = 0; writer.animateCharacter(); });
      addButton("Step by step", function () {
        if (!total) return;
        if (next === 0) writer.hideCharacter();
        var shown = next + 1;
        writer.animateStroke(next, { onComplete: function () { say("Stroke " + shown + " of " + total); } });
        next++;
        if (next >= total) {
          next = 0;
          setTimeout(function () { say("Done. Press Step by step to go again."); }, 900);
        }
      });
    } else {
      var peeked = false;
      var startQuiz = function () {
        writer.quiz({
          showHintAfterMisses: 3,
          onMistake: function (d) { say("Not quite. Try stroke " + (d.strokeNum + 1) + " again."); },
          onCorrectStroke: function (d) { say(d.strokesRemaining > 0 ? "Good! " + d.strokesRemaining + " stroke(s) left." : "Good!"); },
          onComplete: function (d) {
            var mistakes = d.totalMistakes + (peeked ? 3 : 0);
            say(mistakes === 0 ? "Perfect!" : "Finished with " + mistakes + " mistake(s).");
            post({ type: "complete", char: cfg.char, mistakes: mistakes });
          }
        });
      };
      say("Draw the character, one stroke at a time, in the right order.");
      startQuiz();
      addButton("Restart", function () { peeked = false; writer.cancelQuiz(); startQuiz(); });
      addButton("Show me", function () {
        peeked = true;
        writer.cancelQuiz();
        writer.animateCharacter({ onComplete: function () { startQuiz(); } });
      });
    }
  }
</script>
</body></html>`;
}


module.exports = router;
