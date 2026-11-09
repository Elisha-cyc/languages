"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { chatSystemPrompt } = require("./ai");

test("conversation coach adapts to the learner and teaches through dialogue", () => {
  const prompt = chatSystemPrompt({
    language: "French",
    nativeLanguage: "English",
    level: "Beginner",
    cefr: "A1",
    topic: "Introduce yourself",
    pronunciationGuide: "simple pronunciation spelling",
  });

  assert.match(prompt, /Match vocabulary, sentence length, grammar and speed/);
  assert.match(prompt, /Teach through conversation, not lectures/);
  assert.match(prompt, /Adapt dynamically/);
  assert.match(prompt, /Correct selectively/);
  assert.match(prompt, /recent conversation/);
  assert.match(prompt, /natural English translation/);
  assert.match(prompt, /single valid JSON object only/);
});

test("Chinese conversation coach stays within the supplied HSK scope", () => {
  const prompt = chatSystemPrompt({
    language: "Mandarin Chinese",
    nativeLanguage: "English",
    level: "Beginner",
    cefr: "A1",
    topic: "Free chat",
    hskScope: {
      label: "HSK 1",
      grammar: "Basic word order and 是",
    },
  });

  assert.match(prompt, /HSK 1/);
  assert.match(prompt, /Basic word order and 是/);
  assert.match(prompt, /Keep teaching vocabulary, grammar and corrections inside this HSK band/);
});
