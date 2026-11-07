"use strict";

// Vocabulary is the incremental HSK 2.0 six-level list published by the
// Chinese Testing International website (2015 syllabus):
// https://old.chinesetest.cn/userfiles/file/HSK/HSK-2015.xlsx
const vocabulary = require("./hsk-vocabulary.json");

const HSK_LEVELS = {
  Beginner: [1],
  Intermediate: [2, 3],
  Advanced: [4, 5, 6],
};
const WORDS_PER_LESSON = 10;
const LESSONS_PER_UNIT = 5;
const WORDS_PER_UNIT = WORDS_PER_LESSON * LESSONS_PER_UNIT;
const GRAMMAR = {
  1: "basic word order; 是 and 有; 吗 questions; 谁/什么/哪儿/几; 的 possession; measure words; time and dates; 不 and 没",
  2: "comparisons with 比; 了 for completed actions; 过 experience; 在/正在 actions in progress; 因为…所以; result and direction complements; common 把 patterns",
  3: "把 and 被 in common contexts; potential and result complements; 一边…一边; 除了…以外; 如果…就; relative clauses with 的; connected short narratives",
  4: "把/被 structures; complex complements; not only…but also; although…still; conditional and concessive clauses; relative clauses; formal connectors",
  5: "advanced complement and aspect usage; emphasis and rhetorical patterns; formal connectors; fixed expressions and common idioms; register choice",
  6: "nuanced aspect and modality; rhetorical and embedded clauses; discourse cohesion; idiom and register; precise formal and spoken distinctions",
};

function isChinese(language) {
  return /chinese/i.test(String(language || ""));
}

function gradesFor(level) {
  return HSK_LEVELS[level] || [];
}

function gradeWords(grade) {
  return vocabulary[String(grade)] || [];
}

function unitSpecs(level) {
  const specs = [];
  for (const grade of gradesFor(level)) {
    const words = gradeWords(grade);
    for (let offset = 0; offset < words.length; offset += WORDS_PER_UNIT) {
      const block = Math.floor(offset / WORDS_PER_UNIT) + 1;
      specs.push({
        grade,
        block,
        words: words.slice(offset, offset + WORDS_PER_UNIT),
        title: `HSK ${grade} · Vocabulary ${block}`,
      });
    }
  }
  return specs;
}

function wordsForLesson(unitTitle, position) {
  const match = String(unitTitle || "").match(/^HSK ([1-6]) · Vocabulary (\d+)$/);
  if (!match || !Number.isInteger(position) || position < 1) return null;
  const [, gradeText, blockText] = match;
  const grade = Number(gradeText);
  const block = Number(blockText);
  const start = (block - 1) * WORDS_PER_UNIT + (position - 1) * WORDS_PER_LESSON;
  return gradeWords(grade).slice(start, start + WORDS_PER_LESSON);
}

function scopeFor(level) {
  const grades = gradesFor(level);
  if (!grades.length) return null;
  return {
    label: grades.length === 1 ? `HSK ${grades[0]}` : `HSK ${grades[0]}–${grades[grades.length - 1]}`,
    grades,
    vocabulary: grades.flatMap(gradeWords),
    grammar: grades.map((grade) => `HSK ${grade}: ${GRAMMAR[grade]}`).join("; "),
  };
}

module.exports = {
  HSK_LEVELS,
  WORDS_PER_LESSON,
  LESSONS_PER_UNIT,
  isChinese,
  gradesFor,
  GRAMMAR,
  gradeWords,
  unitSpecs,
  wordsForLesson,
  scopeFor,
};
