const express = require("express");
const db = require("./database");
const { chatReply, TOPICS, PERSONAS } = require("./ai");
const { LANGUAGES, LEVELS, PRONUNCIATION_GUIDE } = require("./curriculum");

const router = express.Router();

const MAX_HISTORY = 20; // messages sent back with each request
const MAX_MESSAGE_CHARS = 500;
const LIMIT_PER_HOUR = 60; // each message uses AI tokens

// Remember when each user last sent a message, to enforce the hourly limit
const recent = new Map();

function underLimit(userId) {
  const now = Date.now();
  const times = (recent.get(userId) || []).filter(
    (t) => now - t < 60 * 60 * 1000,
  );
  if (times.length >= LIMIT_PER_HOUR) {
    recent.set(userId, times);
    return false;
  }
  times.push(now);
  recent.set(userId, times);
  return true;
}

// Send one message in a conversation and get the assistant's reply
router.post("/message", async (req, res) => {
  const { user_id, language, level, topic, nativeLanguage, history } =
    req.body || {};

  if (!Number.isInteger(user_id)) {
    return res.status(400).json({ error: "user_id is required" });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(user_id);
  if (!user) return res.status(404).json({ error: "That user does not exist" });

  if (!LANGUAGES.includes(language)) {
    return res
      .status(400)
      .json({
        error: `Choose one of these languages: ${LANGUAGES.join(", ")}`,
      });
  }
  const levelInfo = LEVELS.find((item) => item.name === level);
  if (!levelInfo) {
    return res
      .status(400)
      .json({
        error: `level must be one of: ${LEVELS.map((l) => l.name).join(", ")}`,
      });
  }
  if (!Object.prototype.hasOwnProperty.call(TOPICS, topic)) {
    return res
      .status(400)
      .json({
        error: `topic must be one of: ${Object.keys(TOPICS).join(", ")}`,
      });
  }
  if (
    typeof nativeLanguage !== "string" ||
    !/^[\p{L} ()-]{2,30}$/u.test(nativeLanguage)
  ) {
    return res.status(400).json({ error: "nativeLanguage is not valid" });
  }

  if (!Array.isArray(history) || history.length > MAX_HISTORY) {
    return res
      .status(400)
      .json({
        error: `history must be a list of at most ${MAX_HISTORY} messages`,
      });
  }
  for (const message of history) {
    const valid =
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0 &&
      message.content.length <= MAX_MESSAGE_CHARS;
    if (!valid) {
      return res
        .status(400)
        .json({
          error: `Each message needs a role and text of up to ${MAX_MESSAGE_CHARS} characters`,
        });
    }
  }
  if (history.length > 0 && history[history.length - 1].role !== "user") {
    return res
      .status(400)
      .json({ error: "The last message must be the learner's" });
  }

  if (!underLimit(user_id)) {
    return res
      .status(429)
      .json({
        error:
          "That is a lot of messages for one hour. Take a break and try again later.",
      });
  }

  try {
    const result = await chatReply({
      language,
      nativeLanguage,
      level,
      cefr: levelInfo.cefr,
      topic,
      history: history.map((m) => ({
        role: m.role,
        content: m.content.trim(),
      })),
      pronunciationGuide: PRONUNCIATION_GUIDE[language],
    });
    res.json({ ...result, persona: PERSONAS[language] || "Alex" });
  } catch (err) {
    console.error("Chat error:", err.message);
    if (err.message.startsWith("429")) {
      return res
        .status(429)
        .json({
          error:
            "The assistant is very busy right now. Try again in a few minutes.",
        });
    }
    res.status(502).json({ error: "The assistant is unavailable right now." });
  }
});

// The topics the app can offer
router.get("/topics", (req, res) => {
  res.json(Object.keys(TOPICS));
});

module.exports = router;
