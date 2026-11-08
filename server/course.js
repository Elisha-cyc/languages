"use strict";

const express = require("express");
const { completeJson } = require("./aijson");
const supabase = require("./supabase");
const { LANGUAGES } = require("./curriculum");
const { isChinese, scopeFor, gradesFor } = require("./hsk");
const { ensureHskCurriculum } = require("./ensure-hsk-curriculum");
const { validateLesson, parseObject } = require("./course-validation");

const router = express.Router();
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const SKILLS = ["listening", "reading", "speaking", "writing", "review"];
const requests = new Map();

function allowed(userId) {
  const now = Date.now();
  const recent = (requests.get(userId) || []).filter((time) => now - time < 3600000);
  if (recent.length >= 12) { requests.set(userId, recent); return false; }
  recent.push(now);
  requests.set(userId, recent);
  if (requests.size > 5000) {
    for (const [id, times] of requests) {
      if (!times.some((time) => now - time < 3600000)) requests.delete(id);
    }
  }
  return true;
}

function clean(value, max = 300) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function stringArray(value, min, max, limit = 240) {
  if (!Array.isArray(value)) return [];
  const result = value.map((item) => clean(item, limit)).filter(Boolean).slice(0, max);
  return result.length >= min ? result : [];
}

function topicTokens(topic) {
  return clean(topic, 120).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
}

function topicMatchesUnit(topic, title) {
  const tokens = topicTokens(topic);
  const name = String(title || "").toLowerCase();
  const aliases = {
    greetings: ["greeting", "introduction", "introducing"],
    family: ["family", "people", "friend", "relationship"],
    food: ["food", "drink", "restaurant", "café", "cafe", "order"],
    shopping: ["shopping", "money", "price"],
    travel: ["travel", "transport", "direction", "getting", "around"],
    daily: ["daily", "routine", "free", "time"],
    education: ["education", "learning", "school", "study"],
    work: ["work", "career", "professional", "business"],
    health: ["health", "wellbeing"],
    technology: ["technology", "media", "modern"],
    culture: ["culture", "tradition"],
    opinions: ["opinion", "debate", "society"],
    stories: ["story", "experience", "memory"],
    plans: ["plan", "future"],
    environment: ["environment", "global", "world"],
    hobbies: ["hobby", "leisure"],
    weather: ["weather", "season"],
  };
  const haystack = name + " " + tokens.join(" ");
  let score = 0;
  for (const token of tokens) if (name.includes(token)) score += 2;
  for (const values of Object.values(aliases)) {
    if (values.some((value) => tokens.some((token) => token.includes(value) || value.includes(token))) &&
        values.some((value) => name.includes(value))) score += 3;
  }
  return score;
}

async function findCourseLesson(language, level, topic) {
  if (isChinese(language)) {
    await ensureHskCurriculum(supabase);
    const grades = gradesFor(level);
    const { data: units, error: unitError } = await supabase
      .from("units").select("id, title, position, levels!inner(name), languages!inner(name)")
      .eq("languages.name", "Mandarin Chinese").eq("levels.name", level)
      .order("position");
    if (unitError) throw unitError;
    const gradeUnits = (units || []).filter((unit) => {
      const match = unit.title.match(/^HSK ([1-6]) · Vocabulary/);
      return match && grades.includes(Number(match[1]));
    });
    const ids = gradeUnits.map((unit) => unit.id);
    if (!ids.length) throw new Error("The HSK units are not available for this level yet.");
    const { data: lessons, error: lessonError } = await supabase
      .from("lessons").select("id, unit_id, position").in("unit_id", ids).order("position");
    if (lessonError) throw lessonError;
    const lessonIds = (lessons || []).map((lesson) => lesson.id);
    const { data: contents, error: contentError } = await supabase
      .from("course_lesson_content").select("lesson_id").in("lesson_id", lessonIds);
    if (contentError) throw contentError;
    const used = new Set((contents || []).map((row) => row.lesson_id));
    const chosen = (lessons || []).find((lesson) => !used.has(lesson.id));
    if (!chosen) throw new Error("You have reached the available HSK lesson slots. More lessons are being prepared.");
    return { lessonId: chosen.id, curriculum: "HSK 2.0 · six-level vocabulary pathway" };
  }

  const { data: units, error: unitError } = await supabase
    .from("units").select("id, title, position, levels!inner(name), languages!inner(name)")
    .eq("languages.name", language).eq("levels.name", level).order("position");
  if (unitError) throw unitError;
  if (!units?.length) throw new Error("This language's course units are not available yet.");

  const ranked = [...units].sort((a, b) =>
    topicMatchesUnit(topic, b.title) - topicMatchesUnit(topic, a.title) || a.position - b.position);
  for (const unit of ranked) {
    const { data: lessons, error: lessonError } = await supabase
      .from("lessons").select("id, position").eq("unit_id", unit.id).order("position");
    if (lessonError) throw lessonError;
    const lessonIds = (lessons || []).map((lesson) => lesson.id);
    if (!lessonIds.length) continue;
    const { data: contents, error: contentError } = await supabase
      .from("course_lesson_content").select("lesson_id").in("lesson_id", lessonIds);
    if (contentError) throw contentError;
    const used = new Set((contents || []).map((row) => row.lesson_id));
    const chosen = (lessons || []).find((lesson) => !used.has(lesson.id));
    if (chosen) return { lessonId: chosen.id, curriculum: "CEFR-informed guided course" };
  }
  throw new Error("All lesson slots for this course are in use. Please choose another topic or level.");
}

function buildLessonPrompt({ language, nativeLanguage, level, topic, hsk }) {
  const system = [
    "You are LinguaApp's expert language-course designer and experienced language teacher.",
    "Create a complete, accurate, teachable lesson for one learner. Return exactly one JSON object and no markdown.",
    "Teach " + language + "; explain in " + nativeLanguage + ". Learner level: " + level + ".",
    "Use natural contemporary language, culturally appropriate examples, and a clear progression from recognition to independent use.",
    "Do not invent fake rules. Explain the actual grammar of the target language. Avoid translating word-for-word when a natural translation is different.",
    "Train vocabulary, grammar, listening comprehension, reading comprehension, spoken production, written production and retrieval practice.",
    "Keep all target-language material appropriate for the learner's level. Include translations for all dialogue and reading material.",
    isChinese(language) ? "For Mandarin Chinese, use simplified characters and tone-marked pinyin for every vocabulary item and dialogue line. Explain tones accurately. Keep all content inside the assigned HSK band." : "",
    hsk ? "HSK scope: " + hsk.label + ". Allowed vocabulary pool (prioritise these words): " + hsk.vocabulary.slice(0, 180).join(", ") + ". Grammar range: " + hsk.grammar + ". Do not claim this is an official exam paper." : "",
  ].filter(Boolean).join("\n");
  const user = [
    "Build a complete " + level + " lesson about this topic: " + topic + ".",
    "Return this exact JSON shape:",
    '{"title":"...","objectives":["..."],"vocabulary":[{"term":"target-language word or phrase","pronunciation":"pinyin/transliteration or empty when not needed","meaning":"native-language meaning","example":"natural target-language example","exampleTranslation":"native-language translation"}],"grammar":[{"name":"grammar point","explanation":"clear explanation in native language","pattern":"reusable pattern","examples":[{"target":"target-language example","pronunciation":"pronunciation or empty","translation":"native-language translation"}]}],"dialogue":[{"speaker":"speaker label","text":"target-language line","pronunciation":"pronunciation or empty","translation":"native-language translation"}],"listening":{"instruction":"what to listen for","script":"a natural spoken dialogue or short talk in the target language","questions":[{"question":"question in native language","options":["A","B","C","D"],"answerIndex":0,"explanation":"why this is correct"}]},"reading":{"instruction":"reading strategy","text":"a level-appropriate target-language passage","translation":"natural full translation","questions":[{"question":"question in native language","options":["A","B","C","D"],"answerIndex":0,"explanation":"why this is correct"}]},"speaking":{"prompt":"a realistic open-ended speaking task","usefulPhrases":["..."],"modelAnswer":"a natural model response in target language with translation"},"writing":{"prompt":"a practical writing task","requirements":["..."],"modelAnswer":"a model response in target language with translation"},"review":[{"question":"question in native language","options":["A","B","C","D"],"answerIndex":0,"explanation":"why this is correct"}]}',
    "Requirements: 8–10 vocabulary items; 2 grammar points with at least 2 examples each; 6–8 dialogue turns; listening script 5–9 sentences; at least 3 listening questions; reading passage 100–180 target-language words at Beginner, 180–280 Intermediate, 250–400 Advanced; at least 3 reading questions; 4 review questions. Vary correct answer positions. No answer may be ambiguous.",
    "Model answers must be useful but not the only possible correct answers. Keep each section concise enough for a mobile learner.",
  ].join("\n");
  return { system, user };
}

async function generateLessonContent({ language, nativeLanguage, level, topic, hsk }) {
  const { system, user } = buildLessonPrompt({ language, nativeLanguage, level, topic, hsk });
  const reply = await completeJson([
    { role: "system", content: system }, { role: "user", content: user },
  ], 6500);
  return validateLesson(parseObject(reply), language, level);
}

async function saveVocabulary(userId, language, lessonId, vocabulary) {
  const rows = vocabulary.map((item) => ({
    user_id: userId, language, term: item.term, meaning: item.meaning,
    pronunciation: item.pronunciation || null, source_lesson_id: lessonId,
  }));
  if (!rows.length) return;
  const { error } = await supabase.from("vocabulary_reviews").upsert(rows, {
    onConflict: "user_id,language,term", ignoreDuplicates: true,
  });
  if (error) throw error;
}

router.get("/outline", async (req, res) => {
  const { language, level } = req.query || {};
  if (!LANGUAGES.includes(language) || !LEVELS.includes(level)) {
    return res.status(400).json({ error: "Choose a supported language and level." });
  }
  try {
    if (isChinese(language)) await ensureHskCurriculum(supabase);
    const { data, error } = await supabase.from("units")
      .select("id, title, position, languages!inner(name), levels!inner(name), lessons(id, title, position, course_lesson_content(lesson_id, title))")
      .eq("languages.name", language).eq("levels.name", level)
      .order("position");
    if (error) throw error;
    const { data: completed, error: progressError } = await supabase.from("progress")
      .select("lesson_id").eq("user_id", req.user.id);
    if (progressError) throw progressError;
    const done = new Set((completed || []).map((row) => row.lesson_id));
    const units = (data || []).filter((unit) =>
      !isChinese(language) || /^HSK [1-6] · Vocabulary \d+$/.test(unit.title)
    ).map((unit) => ({
      id: unit.id, title: unit.title, position: unit.position,
      lessons: (unit.lessons || []).sort((a,b) => a.position-b.position).map((lesson) => ({
        id: lesson.id, title: lesson.course_lesson_content?.[0]?.title || lesson.title,
        position: lesson.position, ready: Boolean(lesson.course_lesson_content?.length),
        completed: done.has(lesson.id),
      })),
    }));
    res.json(units);
  } catch (error) {
    console.error("Course outline failed:", error.message);
    res.status(502).json({ error: "Could not load the course outline." });
  }
});

router.post("/lesson", async (req, res) => {
  const userId = req.user?.id;
  const { language, level } = req.body || {};
  const topic = clean(req.body?.topic, 120);
  const requestedLessonId = Number(req.body?.lessonId);
  if (!userId) return res.status(401).json({ error: "Please log in." });
  if (!LANGUAGES.includes(language)) return res.status(400).json({ error: "Choose a supported learning language." });
  if (!LEVELS.includes(level)) return res.status(400).json({ error: "Choose a course level." });
  if (topic.length < 3) return res.status(400).json({ error: "Enter a lesson topic." });
  if (!allowed(userId)) return res.status(429).json({ error: "You have reached the lesson-generation limit. Try again later." });

  try {
    let slot;
    if (Number.isInteger(requestedLessonId) && requestedLessonId > 0) {
      const { data: selected, error: selectedError } = await supabase.from("lessons")
        .select("id, units!inner(title, languages!inner(name), levels!inner(name))")
        .eq("id", requestedLessonId).maybeSingle();
      if (selectedError) throw selectedError;
      if (!selected || selected.units.languages.name !== language || selected.units.levels.name !== level) {
        return res.status(404).json({ error: "That lesson does not belong to this course." });
      }
      slot = { lessonId: selected.id, curriculum: isChinese(language) ? "HSK 2.0 · six-level vocabulary pathway" : "CEFR-informed guided course" };
    } else {
      slot = await findCourseLesson(language, level, topic);
    }
    const { data: cached, error: cacheError } = await supabase
      .from("course_lesson_content").select("title, content, curriculum_standard")
      .eq("lesson_id", slot.lessonId).maybeSingle();
    if (cacheError) throw cacheError;
    if (cached) {
      await saveVocabulary(userId, language, slot.lessonId, cached.content.vocabulary || []);
      await supabase.from("course_enrollments").upsert({
        user_id: userId, language, level, status: "active", last_activity_at: new Date().toISOString(),
      }, { onConflict: "user_id,language,level" });
      return res.json({ lesson: cached.content, lessonId: slot.lessonId, cached: true, curriculum: cached.curriculum_standard });
    }

    const nativeLanguage = req.user.nativeLanguage || "English";
    const hsk = isChinese(language) ? scopeFor(level) : null;
    const lesson = await generateLessonContent({ language, nativeLanguage, level, topic, hsk });
    const curriculum = hsk ? "HSK 2.0 · six-level vocabulary pathway" : slot.curriculum;
    const { error: insertError } = await supabase.from("course_lesson_content").upsert({
      lesson_id: slot.lessonId, language, level, topic, title: lesson.title,
      content: lesson, curriculum_standard: curriculum, updated_at: new Date().toISOString(),
    }, { onConflict: "lesson_id" });
    if (insertError) throw insertError;
    const { error: lessonUpdateError } = await supabase.from("lessons")
      .update({ title: lesson.title, status: "ready", format: "course" })
      .eq("id", slot.lessonId);
    if (lessonUpdateError) throw lessonUpdateError;
    await saveVocabulary(userId, language, slot.lessonId, lesson.vocabulary);
    const { error: enrollmentError } = await supabase.from("course_enrollments").upsert({
      user_id: userId, language, level, status: "active", last_activity_at: new Date().toISOString(),
    }, { onConflict: "user_id,language,level" });
    if (enrollmentError) throw enrollmentError;
    res.json({ lesson, lessonId: slot.lessonId, cached: false, curriculum });
  } catch (error) {
    console.error("Course lesson failed:", String(error.message).slice(0, 300));
    const busy = /429|rate limit/i.test(String(error.message));
    res.status(busy ? 429 : 502).json({ error: busy
      ? "The AI teacher is busy. Please try again shortly."
      : "The lesson could not be prepared completely. Please try again." });
  }
});

router.get("/units", async (req, res) => {
  const { language, level } = req.query || {};
  if (!LANGUAGES.includes(language) || !LEVELS.includes(level)) {
    return res.status(400).json({ error: "Choose a supported language and level." });
  }
  try {
    if (isChinese(language)) await ensureHskCurriculum(supabase);
    const { data: units, error } = await supabase.from("units")
      .select("id, title, position, lessons(id, position, title, course_lesson_content(lesson_id, title))")
      .eq("languages.name", language).eq("levels.name", level)
      .order("position");
    if (error) throw error;
    res.json((units || []).map((unit) => ({
      id: unit.id, title: unit.title, position: unit.position,
      lessons: (unit.lessons || []).map((lesson) => ({
        id: lesson.id, position: lesson.position, title: lesson.course_lesson_content?.[0]?.title || lesson.title,
        ready: Boolean(lesson.course_lesson_content?.length),
      })),
    })));
  } catch (error) {
    console.error("Course units failed:", error.message);
    res.status(502).json({ error: "Could not load the course outline." });
  }
});

router.get("/progress", async (req, res) => {
  const userId = req.user?.id;
  const { language, level } = req.query || {};
  if (!userId || !LANGUAGES.includes(language) || !LEVELS.includes(level)) {
    return res.status(400).json({ error: "A valid language and level are required." });
  }
  try {
    const [enrollment, skills, completions, due] = await Promise.all([
      supabase.from("course_enrollments").select("*").eq("user_id", userId).eq("language", language).eq("level", level).maybeSingle(),
      supabase.from("course_skill_progress").select("*").eq("user_id", userId).eq("language", language).eq("level", level),
      supabase.from("progress").select("lesson_id, completed_at, lessons!inner(unit_id, units!inner(language_id, level_id, languages!inner(name), levels!inner(name)))").eq("user_id", userId).eq("lessons.units.languages.name", language).eq("lessons.units.levels.name", level),
      supabase.from("vocabulary_reviews").select("term, meaning, pronunciation, due_at, repetitions").eq("user_id", userId).eq("language", language).lte("due_at", new Date().toISOString()).order("due_at").limit(100),
    ]);
    for (const item of [enrollment, skills, completions, due]) if (item.error) throw item.error;
    res.json({
      enrollment: enrollment.data,
      skills: skills.data || [],
      completedLessons: completions.data?.length || 0,
      dueVocabulary: due.data || [],
    });
  } catch (error) {
    console.error("Course progress failed:", error.message);
    res.status(502).json({ error: "Could not load your learning progress." });
  }
});

router.post("/attempt", async (req, res) => {
  const userId = req.user?.id;
  const { language, level, skill, lessonId } = req.body || {};
  const prompt = clean(req.body?.prompt, 700);
  const response = req.body?.response;
  const score = Number(req.body?.score);
  const feedback = req.body?.feedback;
  if (!userId || !LANGUAGES.includes(language) || !LEVELS.includes(level) ||
      !SKILLS.includes(skill) || !Number.isInteger(Number(lessonId)) ||
      !Number.isFinite(score) || score < 0 || score > 100 || !prompt || response == null) {
    return res.status(400).json({ error: "The practice attempt is incomplete or invalid." });
  }
  try {
    const { data: lesson, error: lessonError } = await supabase.from("course_lesson_content")
      .select("lesson_id").eq("lesson_id", Number(lessonId)).eq("language", language).eq("level", level).maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson) return res.status(404).json({ error: "That course lesson was not found." });

    const { error: attemptError } = await supabase.from("course_attempts").insert({
      user_id: userId, lesson_id: Number(lessonId), language, level, skill,
      prompt, response: typeof response === "string" ? { text: response.slice(0, 3000) } : response,
      score: Math.round(score), feedback: feedback && typeof feedback === "object" ? feedback : null,
    });
    if (attemptError) throw attemptError;

    const { data: old } = await supabase.from("course_skill_progress").select("*")
      .eq("user_id", userId).eq("language", language).eq("level", level).eq("skill", skill).maybeSingle();
    const now = new Date().toISOString();
    const { error: skillError } = await supabase.from("course_skill_progress").upsert({
      user_id: userId, language, level, skill,
      attempts: (old?.attempts || 0) + 1,
      total_score: (old?.total_score || 0) + Math.round(score),
      best_score: Math.max(old?.best_score || 0, Math.round(score)),
      last_score: Math.round(score), last_practiced_at: now, updated_at: now,
    }, { onConflict: "user_id,language,level,skill" });
    if (skillError) throw skillError;

    if (skill === "review" && score >= 70) {
      const { error: progressError } = await supabase.from("progress").upsert({
        user_id: userId, lesson_id: Number(lessonId), completed_at: now,
      }, { onConflict: "user_id,lesson_id" });
      if (progressError) throw progressError;
    }
    await supabase.from("course_enrollments").upsert({
      user_id: userId, language, level, status: "active", last_activity_at: now,
    }, { onConflict: "user_id,language,level" });
    res.json({ saved: true, score: Math.round(score), completed: skill === "review" && score >= 70 });
  } catch (error) {
    console.error("Course attempt failed:", String(error.message).slice(0, 250));
    res.status(502).json({ error: "Your practice result could not be saved. Please try again." });
  }
});

router.get("/review", async (req, res) => {
  const userId = req.user?.id;
  const language = req.query.language;
  if (!userId || !LANGUAGES.includes(language)) return res.status(400).json({ error: "Choose a supported language." });
  const { data, error } = await supabase.from("vocabulary_reviews")
    .select("term, meaning, pronunciation, due_at, repetitions, ease_factor, interval_days")
    .eq("user_id", userId).eq("language", language)
    .lte("due_at", new Date().toISOString()).order("due_at").limit(100);
  if (error) return res.status(502).json({ error: "Could not load vocabulary reviews." });
  res.json(data || []);
});

router.post("/review", async (req, res) => {
  const userId = req.user?.id;
  const { language } = req.body || {};
  const term = clean(req.body?.term, 80);
  const quality = Number(req.body?.quality);
  if (!userId || !LANGUAGES.includes(language) || !term || !Number.isInteger(quality) || quality < 0 || quality > 5) {
    return res.status(400).json({ error: "Review rating must be between 0 and 5." });
  }
  try {
    const { data: old, error } = await supabase.from("vocabulary_reviews").select("*")
      .eq("user_id", userId).eq("language", language).eq("term", term).maybeSingle();
    if (error) throw error;
    if (!old) return res.status(404).json({ error: "That vocabulary item was not found." });
    let repetitions = old.repetitions;
    let interval = old.interval_days;
    let ease = Number(old.ease_factor);
    if (quality < 3) { repetitions = 0; interval = 1; }
    else {
      if (repetitions === 0) interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.max(1, Math.round(interval * ease));
      repetitions += 1;
    }
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    const now = new Date();
    const due = new Date(now.getTime() + interval * 86400000).toISOString();
    const { error: saveError } = await supabase.from("vocabulary_reviews").update({
      repetitions, interval_days: interval, ease_factor: ease,
      due_at: due, last_reviewed_at: now.toISOString(), last_quality: quality,
      updated_at: now.toISOString(),
    }).eq("user_id", userId).eq("language", language).eq("term", term);
    if (saveError) throw saveError;
    res.json({ term, repetitions, intervalDays: interval, dueAt: due });
  } catch (error) {
    console.error("Vocabulary review failed:", String(error.message).slice(0, 200));
    res.status(502).json({ error: "Could not save that vocabulary review." });
  }
});

router.post("/feedback", async (req, res) => {
  const userId = req.user?.id;
  const { language, level, kind } = req.body || {};
  const prompt = clean(req.body?.prompt, 700);
  const response = clean(req.body?.response, 1600);
  const modelAnswer = clean(req.body?.modelAnswer, 1200);
  if (!userId) return res.status(401).json({ error: "Please log in." });
  if (!LANGUAGES.includes(language) || !LEVELS.includes(level) ||
      !["speaking", "writing"].includes(kind)) {
    return res.status(400).json({ error: "Invalid feedback request." });
  }
  if (!prompt || !response) return res.status(400).json({ error: "Your answer is empty." });
  if (!allowed(userId)) return res.status(429).json({ error: "Feedback limit reached. Try again later." });
  const nativeLanguage = req.user.nativeLanguage || "English";
  const system = [
    "You are a fair, supportive language assessor. Give specific, actionable feedback, not empty praise.",
    "Assess a " + level + " learner writing or speaking " + language + ". Explain in " + nativeLanguage + ".",
    "Judge communication, grammar, vocabulary, naturalness and task completion at the stated level.",
    "A transcript is not an acoustic pronunciation assessment. Never claim to have heard accent, intonation or pronunciation from text alone.",
    'Return JSON only: {"score":0,"strengths":["..."],"corrections":[{"original":"...","corrected":"...","explanation":"..."}],"nextPractice":"...","improvedExample":"..."}. Score is a formative practice estimate, not an official exam score.',
  ].join("\n");
  const user = [
    "Task: " + kind + ".", "<prompt>" + prompt + "</prompt>",
    "<learner_answer>" + response + "</learner_answer>",
    modelAnswer ? "<optional_model_answer>" + modelAnswer + "</optional_model_answer>" : "",
    "Correct only meaningful errors. If the answer is already good, explain what works and suggest one improvement.",
  ].filter(Boolean).join("\n");
  try {
    const reply = await completeJson([
      { role: "system", content: system }, { role: "user", content: user },
    ], 1800);
    const raw = parseObject(reply);
    const score = Number(raw.score);
    if (!Number.isFinite(score) || !Array.isArray(raw.strengths) ||
        !Array.isArray(raw.corrections)) throw new Error("The feedback response was incomplete.");
    res.json({
      score: Math.max(0, Math.min(100, Math.round(score))),
      strengths: stringArray(raw.strengths, 1, 5, 240),
      corrections: raw.corrections.slice(0, 6).map((item) => ({
        original: clean(item?.original, 240), corrected: clean(item?.corrected, 240),
        explanation: clean(item?.explanation, 320),
      })).filter((item) => item.corrected && item.explanation),
      nextPractice: clean(raw.nextPractice, 400),
      improvedExample: clean(raw.improvedExample, 500),
      scoreNote: "This is AI-generated formative feedback, not an official language-proficiency score.",
    });
  } catch (error) {
    console.error("Course feedback failed:", String(error.message).slice(0, 250));
    const busy = /429|rate limit/i.test(String(error.message));
    res.status(busy ? 429 : 502).json({ error: busy
      ? "The AI assessor is busy. Try again shortly."
      : "Feedback could not be prepared. Please try again." });
  }
});

module.exports = router;
module.exports.validateLesson = validateLesson;
module.exports.parseObject = parseObject;
