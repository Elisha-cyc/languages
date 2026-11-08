"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { makeQuestions, normalizeGeneratedQuestions } = require("./placement");

const words = (prefix, count = 8) => Array.from({ length: count }, (_, index) => ({
  id: prefix * 100 + index + 1,
  word: prefix + "-word-" + index,
  meaning: prefix + "-meaning-" + index,
  pronunciation: prefix + "-pronunciation-" + index,
}));

test("builds up to five distinct multiple-choice questions for a level", () => {
  const used = new Set();
  const result = makeQuestions(words(1), "Beginner", used);
  assert.equal(result.length, 5);
  assert.ok(result.every((item) => item.level === "Beginner"));
  assert.ok(result.every((item) => item.options.length === 4));
  assert.ok(result.every((item) => item.options[item.answerIndex] !== undefined));
  assert.equal(new Set(result.map((item) => item.id)).size, result.length);
});

test("does not reuse a vocabulary item across assessment levels", () => {
  const used = new Set();
  const first = makeQuestions(words(2), "Beginner", used);
  const second = makeQuestions(words(2), "Intermediate", used);
  assert.equal(first.length, 5);
  assert.equal(second.length, 3);
  assert.ok(second.every((item) => !first.some((prior) => prior.id === item.id)));
});

test("skips vocabulary without a usable prompt or meaning", () => {
  const used = new Set();
  const result = makeQuestions([
    { id: 1, word: "", meaning: "blank prompt" },
    { id: 2, word: "word", meaning: "" },
    ...words(3, 5),
  ], "Beginner", used);
  assert.equal(result.length, 5);
  assert.ok(result.every((item) => item.prompt && item.options[item.answerIndex]));
});

test("returns no questions when there are not enough distinct distractors", () => {
  const result = makeQuestions([
    { id: 1, word: "one", meaning: "same" },
    { id: 2, word: "two", meaning: "same" },
  ], "Beginner", new Set());
  assert.deepEqual(result, []);
});

test("accepts five valid AI-generated questions", () => {
  const raw = Array.from({ length: 5 }, (_, index) => ({
    prompt: "word " + index,
    pronunciation: "",
    options: ["meaning A", "meaning B", "meaning C", "meaning D"],
    answerIndex: index % 4,
  }));
  const result = normalizeGeneratedQuestions(raw, "Intermediate");
  assert.equal(result.length, 5);
  assert.equal(result[2].answerIndex, 2);
  assert.equal(result[0].level, "Intermediate");
});

test("rejects AI-generated questions with ambiguous or missing options", () => {
  const raw = Array.from({ length: 5 }, (_, index) => ({
    prompt: "word " + index,
    options: ["same", "same", "other", "last"],
    answerIndex: 0,
  }));
  assert.throws(() => normalizeGeneratedQuestions(raw, "Beginner"), /incomplete/i);
});

test("rejects AI-generated questions with invalid answer indexes", () => {
  const raw = Array.from({ length: 5 }, (_, index) => ({
    prompt: "word " + index,
    options: ["one", "two", "three", "four"],
    answerIndex: 4,
  }));
  assert.throws(() => normalizeGeneratedQuestions(raw, "Advanced"), /incomplete/i);
});
