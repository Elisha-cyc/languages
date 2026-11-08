"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateLesson, parseObject } = require("./course-validation");

function question(index = 0) {
  return {
    question: "Choose the correct meaning.",
    options: ["one", "two", "three", "four"],
    answerIndex: index,
    explanation: "The context makes this answer correct.",
  };
}

function lessonFixture() {
  return {
    title: "At the café",
    objectives: ["Order politely", "Understand prices", "Ask a follow-up question"],
    vocabulary: Array.from({ length: 8 }, (_, i) => ({
      term: "word " + i, pronunciation: "", meaning: "meaning " + i,
      example: "example " + i, exampleTranslation: "translation " + i,
    })),
    grammar: [{
      name: "Polite requests", explanation: "Use this pattern for polite requests.",
      pattern: "Could I have + noun?",
      examples: [{ target: "Could I have tea?", pronunciation: "", translation: "May I have tea?" }],
    }],
    dialogue: Array.from({ length: 6 }, (_, i) => ({
      speaker: i % 2 ? "Server" : "Customer", text: "Line " + i,
      pronunciation: "", translation: "Translated line " + i,
    })),
    listening: {
      instruction: "Listen for the order.", script: "A customer orders tea.",
      questions: [question(0), question(1), question(2)],
    },
    reading: {
      instruction: "Read for details.", text: "A short café notice.",
      translation: "A short café notice in English.",
      questions: [question(1), question(2), question(3)],
    },
    speaking: {
      prompt: "Order a drink and ask its price.",
      usefulPhrases: ["I would like tea.", "How much is it?", "Thank you."],
      modelAnswer: "I would like tea, please.",
    },
    writing: {
      prompt: "Write a short order.", requirements: ["Use a polite phrase", "Ask a question"],
      modelAnswer: "I would like tea, please.",
    },
    review: [question(0), question(1), question(2), question(3)],
  };
}

test("accepts a complete multi-skill lesson", () => {
  const lesson = validateLesson(lessonFixture(), "French", "Beginner");
  assert.equal(lesson.vocabulary.length, 8);
  assert.equal(lesson.dialogue.length, 6);
  assert.equal(lesson.listening.questions.length, 3);
  assert.equal(lesson.reading.questions.length, 3);
  assert.equal(lesson.review.length, 4);
});

test("rejects a lesson missing listening comprehension", () => {
  const raw = lessonFixture();
  raw.listening.questions = [];
  assert.throws(() => validateLesson(raw, "French", "Beginner"), /incomplete/i);
});

test("rejects a lesson missing its writing task", () => {
  const raw = lessonFixture();
  raw.writing.prompt = "";
  assert.throws(() => validateLesson(raw, "French", "Beginner"), /incomplete/i);
});

test("rejects ambiguous or malformed multiple-choice questions", () => {
  const raw = lessonFixture();
  raw.review[0].options = ["one", "two"];
  assert.throws(() => validateLesson(raw, "French", "Beginner"), /incomplete/i);
});

test("parses JSON returned inside a markdown code fence", () => {
  assert.deepEqual(parseObject('' + String.fromCharCode(96).repeat(3) + 'json\n{"ok":true}\n' + String.fromCharCode(96).repeat(3)), { ok: true });
});
