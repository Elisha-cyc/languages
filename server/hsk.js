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
const CUMULATIVE_VOCABULARY = { 1: 150, 2: 300, 3: 600, 4: 1200, 5: 2500, 6: 5000 };
const GRAMMAR = {
  1: "basic word order; 是 and 有; 吗 questions; 谁/什么/哪儿/几; 的 possession; measure words; time and dates; 不 and 没",
  2: "comparisons with 比; 了 for completed actions; 过 experience; 在/正在 actions in progress; 因为…所以; result and direction complements; common 把 patterns",
  3: "把 and 被 in common contexts; potential and result complements; 一边…一边; 除了…以外; 如果…就; relative clauses with 的; connected short narratives",
  4: "把/被 structures; complex complements; not only…but also; although…still; conditional and concessive clauses; relative clauses; formal connectors",
  5: "advanced complement and aspect usage; emphasis and rhetorical patterns; formal connectors; fixed expressions and common idioms; register choice",
  6: "nuanced aspect and modality; rhetorical and embedded clauses; discourse cohesion; idiom and register; precise formal and spoken distinctions",
};

// Course map follows the six-level HSK 2.0 syllabus used by the 2015 list
// above. Speaking practice is included as extra study; the written HSK exam
// itself assesses listening, reading and (from HSK 3) writing.
const HSK_COURSE = {
  1: {
    title: "HSK 1 · Foundations",
    functions: ["Greetings and introductions", "Family, age, home and hobbies", "Numbers, dates and time", "Shopping, transport and simple requests", "Weather, directions and basic descriptions"],
    grammarTopics: ["Basic subject–verb–object order", "是, 有 and 在", "吗, 呢 and question words", "的 for possession", "Measure words and numbers", "Time words and dates", "不 and 没", "Simple adjective predicates"],
    skills: ["Listen for familiar words and short statements", "Read simple notices and sentences", "Recognize and write basic characters", "Speak in short everyday exchanges"],
    exam: "Listening and reading · 40 questions · about 40 minutes",
  },
  2: {
    title: "HSK 2 · Everyday communication",
    functions: ["Personal information and daily routines", "Shopping, travel and appointments", "Describe weather, places and feelings", "Ask for and give suggestions", "Compare choices and explain simple reasons"],
    grammarTopics: ["Past and completed actions with 了", "Experience with 过", "Actions in progress with 在/正在", "Comparisons with 比", "因为…所以 and other reason clauses", "Directional and result complements", "Time and frequency expressions", "Common 把 patterns"],
    skills: ["Follow short everyday conversations", "Read short messages and descriptions", "Build confidence with characters and handwriting", "Speak about plans, preferences and experiences"],
    exam: "Listening and reading · 60 questions · about 55 minutes",
  },
  3: {
    title: "HSK 3 · Connected communication",
    functions: ["Describe people, routines and experiences", "Ask about health, travel and entertainment", "Make comparisons and recommendations", "Express opinions, feelings and reasons", "Connect ideas and tell short stories"],
    grammarTopics: ["把 and 被 in common contexts", "Result and potential complements", "一边…一边 and 除了…以外", "如果…就 conditional sentences", "Relative clauses with 的", "Aspect and sequence in narratives", "Frequency, degree and emphasis", "Connectors for cause and contrast"],
    skills: ["Understand longer everyday conversations", "Read connected passages and find key details", "Arrange words into sentences", "Write characters and short responses", "Practice spoken descriptions and explanations"],
    exam: "Listening, reading and writing · 80 questions · about 90 minutes",
  },
  4: {
    title: "HSK 4 · Independent use",
    functions: ["Discuss study, work, society and personal goals", "Explain viewpoints and support them with reasons", "Handle common situations with more detail", "Summarize events and compare options"],
    grammarTopics: ["Expanded 把/被 and complements", "Complex aspect and modality", "Concessive and conditional clauses", "Not only…but also structures", "Relative clauses and sentence linking", "Formal connectors and discourse flow", "Idioms in familiar contexts", "Register and precise word choice"],
    skills: ["Follow longer conversations and short talks", "Read cloze, ordered sentences and passages", "Reorder words into correct sentences", "Write sentences from prompts and pictures", "Speak in organized explanations"],
    exam: "Listening, reading and writing · 100 questions · about 105 minutes",
  },
  5: {
    title: "HSK 5 · Fluent comprehension",
    functions: ["Discuss abstract and practical topics", "Understand detailed reports and narratives", "Present arguments and compare perspectives", "Adapt language to context and audience"],
    grammarTopics: ["Nuanced aspect and modality", "Advanced complements and result patterns", "Rhetorical emphasis and fixed expressions", "Complex sentence and paragraph connectors", "Idioms and collocations", "Formal and conversational register", "Cohesion across longer texts"],
    skills: ["Understand extended speech and interviews", "Read articles and longer passages", "Complete sentence and passage cloze tasks", "Write coherent short texts", "Speak with clear structure and supporting detail"],
    exam: "Listening, reading and writing · 100 questions · about 125 minutes",
  },
  6: {
    title: "HSK 6 · Advanced mastery",
    functions: ["Understand nuanced arguments and implied meaning", "Synthesize information across longer texts", "Express precise, well-supported positions", "Summarize narratives and informational content"],
    grammarTopics: ["Advanced aspect, modality and stance", "Embedded and rhetorical clauses", "Discourse cohesion and reference", "Idioms, collocations and register", "Fine distinctions in formal and spoken Chinese", "Concise paraphrase and summarization"],
    skills: ["Follow extended interviews and talks", "Read complex passages, cloze and sentence insertion", "Identify errors and relationships across a text", "Summarize a long narrative accurately", "Practice advanced discussion and presentations"],
    exam: "Listening, reading and writing · 101 questions · about 140 minutes",
  },
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
    courses: grades.map((grade) => ({ grade, ...HSK_COURSE[grade] })),
    totalWords: grades.reduce((sum, grade) => sum + gradeWords(grade).length, 0),
  };
}

function courseForLevel(level) {
  const scope = scopeFor(level);
  if (!scope) return null;
  return {
    standard: "HSK 2.0 · six-level syllabus (2015 vocabulary list)",
    label: scope.label,
    grades: scope.courses,
    totalWords: scope.totalWords,
    vocabularyPerGrade: scope.grades.map((grade) => ({
      grade,
      newWords: gradeWords(grade).length,
      cumulative: CUMULATIVE_VOCABULARY[grade],
    })),
    lessonCount: scope.grades.reduce(
      (sum, grade) => sum + Math.ceil(gradeWords(grade).length / WORDS_PER_LESSON),
      0,
    ),
    cumulativeTarget: CUMULATIVE_VOCABULARY[scope.grades[scope.grades.length - 1]],
    prerequisite: scope.grades[0] > 1 ? `Complete HSK ${scope.grades[0] - 1} first; earlier vocabulary is part of the cumulative standard.` : null,
  };
}

function lessonPlan(unitTitle, position, level) {
  const match = String(unitTitle || "").match(/^HSK ([1-6]) · Vocabulary (\d+)$/);
  const grade = Number(match?.[1]);
  const block = Number(match?.[2]);
  const gradePlan = HSK_COURSE[grade];
  if (!gradePlan || !Number.isInteger(position) || position < 1) return null;
  const sequence = (block - 1) * LESSONS_PER_UNIT + position - 1;
  return {
    grade,
    topic: gradePlan.functions[sequence % gradePlan.functions.length],
    grammar: gradePlan.grammarTopics[sequence % gradePlan.grammarTopics.length],
    outcomes: gradePlan.skills,
    writing: grade >= 3
      ? "Write a short sentence or response from memory, then compare it with the model."
      : "Copy one new Chinese sentence and pay attention to the characters and word order.",
    exam: gradePlan.exam,
    label: courseForLevel(level)?.label,
  };
}

module.exports = {
  HSK_LEVELS,
  WORDS_PER_LESSON,
  LESSONS_PER_UNIT,
  isChinese,
  gradesFor,
  GRAMMAR,
  HSK_COURSE,
  CUMULATIVE_VOCABULARY,
  courseForLevel,
  lessonPlan,
  gradeWords,
  unitSpecs,
  wordsForLesson,
  scopeFor,
};
