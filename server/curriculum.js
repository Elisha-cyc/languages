const LESSONS_PER_UNIT = 5; // 10 units x 5 lessons = 50 lessons per level

const LANGUAGES = [
  // Phase 1: Latin alphabet
  "French",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Swedish",
  "Polish",
  "Turkish",
  "Indonesian",
  "Swahili",
  // Phase 2: other writing systems
  "Russian",
  "Mandarin Chinese",
  "Japanese",
  "Korean",
  "Hindi",
  "Arabic",
  "Greek",
  "Hebrew",
  "Thai",
];

const LEVELS = [
  {
    name: "Beginner",
    cefr: "A1-A2",
    units: [
      "Greetings & introductions",
      "Numbers & time",
      "Family & people",
      "Food & drink",
      "Shopping & money",
      "Home & daily routine",
      "Getting around",
      "Weather & seasons",
      "Hobbies & free time",
      "Health & body",
    ],
  },
  {
    name: "Intermediate",
    cefr: "B1-B2",
    units: [
      "Travel & transport",
      "Work & careers",
      "Education",
      "Health & wellbeing",
      "Technology & media",
      "Culture & traditions",
      "Opinions & debates",
      "Past experiences & stories",
      "Plans & the future",
      "Environment & society",
    ],
  },
  {
    name: "Advanced",
    cefr: "C1-C2",
    units: [
      "Politics & government",
      "Business & economics",
      "Science & innovation",
      "Law & justice",
      "Literature & the arts",
      "Philosophy & ideas",
      "Media & rhetoric",
      "Idioms & nuance",
      "Formal & academic writing",
      "Global issues",
    ],
  },
];

// What kind of pronunciation help each non-Latin language needs.
// Languages not listed here don't get a pronunciation field.
const PRONUNCIATION_GUIDE = {
  Russian: 'Latin-letter transliteration',
  'Mandarin Chinese': 'pinyin with tone marks',
  Japanese: 'romaji',
  Korean: 'Revised Romanization',
  Hindi: 'Latin-letter transliteration',
  Arabic: 'Latin-letter transliteration',
  Greek: 'Latin-letter transliteration',
  Hebrew: 'Latin-letter transliteration',
  Thai: 'Latin-letter transliteration (Royal Thai General System)',
};

module.exports = { LESSONS_PER_UNIT, LANGUAGES, LEVELS, PRONUNCIATION_GUIDE };


