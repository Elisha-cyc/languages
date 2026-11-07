const express = require("express");
const supabase = require("./supabase");
const { chatReply, TOPICS, PERSONAS } = require("./ai");
const { LANGUAGES, LEVELS, PRONUNCIATION_GUIDE } = require("./curriculum");
const { isChinese, scopeFor } = require("./hsk");

const router = express.Router();

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 500;
const LIMIT_PER_HOUR = 60;
const CHINESE_TOPICS = {
  "HSK words and sentence patterns": "guided practice using syllabus vocabulary and grammar",
  "Greetings and introductions": "meeting someone and introducing yourself using HSK vocabulary",
  "Numbers, dates and daily routines": "daily routines, dates, time, and numbers at the selected HSK level",
  "Food, shopping and travel": "everyday food, shopping, and travel situations at the selected HSK level",
  "Tell a short story": "a short, connected story using grammar from the selected HSK level",
  "Opinions and explanations": "sharing opinions and giving reasons using vocabulary from the selected HSK level",
};

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

router.post("/message", async (req, res) => {
  const { user_id, language, level, topic, nativeLanguage, history } =
    req.body || {};

  if (!Number.isInteger(user_id)) {
    return res.status(400).json({ error: "user_id is required" });
  }

  if (!LANGUAGES.includes(language)) {
    return res.status(400).json({
      error: `Choose one of these languages: ${LANGUAGES.join(", ")}`,
    });
  }

  const levelInfo = LEVELS.find((item) => item.name === level);

  if (!levelInfo) {
    return res.status(400).json({
      error: `level must be one of: ${LEVELS.map((l) => l.name).join(", ")}`,
    });
  }

  const chinese = isChinese(language);
  const topics = chinese ? CHINESE_TOPICS : TOPICS;
  if (!Object.prototype.hasOwnProperty.call(topics, topic)) {
    return res.status(400).json({
      error: `topic must be one of: ${Object.keys(topics).join(", ")}`,
    });
  }

  if (
    typeof nativeLanguage !== "string" ||
    !/^[\p{L} ()-]{2,30}$/u.test(nativeLanguage)
  ) {
    return res.status(400).json({ error: "nativeLanguage is not valid" });
  }

  if (!Array.isArray(history) || history.length > MAX_HISTORY) {
    return res.status(400).json({
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
      return res.status(400).json({
        error: `Each message needs a role and text of up to ${MAX_MESSAGE_CHARS} characters`,
      });
    }
  }

  if (history.length > 0 && history[history.length - 1].role !== "user") {
    return res.status(400).json({
      error: "The last message must be the learner's",
    });
  }

  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user_id)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return res.status(404).json({ error: "That user does not exist" });
    }

    if (!underLimit(user_id)) {
      return res.status(429).json({
        error:
          "That is a lot of messages for one hour. Take a break and try again later.",
      });
    }

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
      hskScope: chinese ? scopeFor(level) : null,
      topicDescription: topics[topic],
    });

    res.json({ ...result, persona: PERSONAS[language] || "Alex" });
  } catch (err) {
    console.error("Chat error:", err.message);

    if (err.message.startsWith("429")) {
      return res.status(429).json({
        error:
          "The assistant is very busy right now. Try again in a few minutes.",
      });
    }

    res.status(502).json({
      error: "The assistant is unavailable right now.",
    });
  }
});

router.get("/topics", (req, res) => {
  res.json(isChinese(req.query.language)
    ? Object.keys(CHINESE_TOPICS)
    : Object.keys(TOPICS));
});

module.exports = router;
