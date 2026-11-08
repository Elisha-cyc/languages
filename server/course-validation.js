"use strict";

function clean(value, max = 300) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function stringArray(value, min, max, limit = 240) {
  if (!Array.isArray(value)) return [];
  const result = value.map((item) => clean(item, limit)).filter(Boolean).slice(0, max);
  return result.length >= min ? result : [];
}

function parseObject(reply) {
  const fence = new RegExp(String.fromCharCode(96) + "{3}(?:json)?", "gi");
  const source = String(reply || "").replace(/^\uFEFF/, "").replace(fence, "").trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI did not return a complete JSON object.");
  return JSON.parse(source.slice(start, end + 1));
}

function validateLesson(raw, language, level) {
  if (!raw || typeof raw !== "object") throw new Error("The lesson was not valid.");
  const vocabulary = (Array.isArray(raw.vocabulary) ? raw.vocabulary : []).map((item) => ({
    term: clean(item?.term, 80), pronunciation: clean(item?.pronunciation, 100),
    meaning: clean(item?.meaning, 180), example: clean(item?.example, 240),
    exampleTranslation: clean(item?.exampleTranslation, 240),
  })).filter((item) => item.term && item.meaning && item.example);
  const dialogue = (Array.isArray(raw.dialogue) ? raw.dialogue : []).map((item) => ({
    speaker: clean(item?.speaker, 40), text: clean(item?.text, 260),
    pronunciation: clean(item?.pronunciation, 140), translation: clean(item?.translation, 260),
  })).filter((item) => item.speaker && item.text && item.translation);
  const grammar = (Array.isArray(raw.grammar) ? raw.grammar : []).map((item) => ({
    name: clean(item?.name, 100), explanation: clean(item?.explanation, 600),
    pattern: clean(item?.pattern, 160),
    examples: (Array.isArray(item?.examples) ? item.examples : []).map((example) => ({
      target: clean(example?.target, 240), pronunciation: clean(example?.pronunciation, 140),
      translation: clean(example?.translation, 240),
    })).filter((example) => example.target && example.translation).slice(0, 4),
  })).filter((item) => item.name && item.explanation && item.pattern && item.examples.length >= 2);
  const questions = (value) => (Array.isArray(value) ? value : []).map((item) => ({
    question: clean(item?.question, 280), options: stringArray(item?.options, 3, 4, 180),
    answerIndex: Number.isInteger(item?.answerIndex) ? item.answerIndex : -1,
    explanation: clean(item?.explanation, 300),
  })).filter((item) => item.question && item.options.length === 4 &&
    item.answerIndex >= 0 && item.answerIndex < 4 && item.explanation).slice(0, 6);
  const lesson = {
    title: clean(raw.title, 100), level, language,
    objectives: stringArray(raw.objectives, 3, 6), vocabulary: vocabulary.slice(0, 12),
    grammar, dialogue: dialogue.slice(0, 8),
    listening: {
      instruction: clean(raw.listening?.instruction, 260),
      script: clean(raw.listening?.script, 1400),
      questions: questions(raw.listening?.questions),
    },
    reading: {
      instruction: clean(raw.reading?.instruction, 260),
      text: clean(raw.reading?.text, 1800),
      translation: clean(raw.reading?.translation, 1800),
      questions: questions(raw.reading?.questions),
    },
    speaking: {
      prompt: clean(raw.speaking?.prompt, 500),
      usefulPhrases: stringArray(raw.speaking?.usefulPhrases, 3, 6),
      modelAnswer: clean(raw.speaking?.modelAnswer, 900),
    },
    writing: {
      prompt: clean(raw.writing?.prompt, 500),
      requirements: stringArray(raw.writing?.requirements, 2, 5),
      modelAnswer: clean(raw.writing?.modelAnswer, 1000),
    },
    review: questions(raw.review),
  };
  if (!lesson.title || lesson.objectives.length < 3 || lesson.vocabulary.length < 6 ||
      lesson.grammar.length < 2 || lesson.dialogue.length < 4 ||
      !lesson.listening.script || lesson.listening.questions.length < 3 ||
      !lesson.reading.text || lesson.reading.questions.length < 3 ||
      !lesson.speaking.prompt || !lesson.writing.prompt || lesson.review.length < 4) {
    throw new Error("The lesson was incomplete. Please generate it again.");
  }
  return lesson;
}


function isSequentiallyUnlocked(orderedIds, completedIds, lessonId) {
  const target = Number(lessonId);
  const index = orderedIds.indexOf(target);
  if (index < 0) return false;
  const done = new Set(Array.from(completedIds || []).map(Number));
  if (done.has(target)) return true;
  return orderedIds.slice(0, index).every((id) => done.has(Number(id)));
}

module.exports = { validateLesson, parseObject, isSequentiallyUnlocked };
