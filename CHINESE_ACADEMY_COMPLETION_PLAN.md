# Chinese Academy: product and curriculum completion plan

## Product promise

The Chinese Academy should be a self-contained Mandarin learning environment. A learner must be able to begin at absolute zero and progress through advanced Chinese without depending on a separate course, textbook, tutor, dictionary, or practice platform.

The product must teach and assess performance, not merely display vocabulary or generate explanations. Fluency is a learner outcome that requires sustained practice; the app must not promise a guaranteed time to fluency.

## Standards and scope

Use the published HSK 3.0 syllabus as the primary external coverage framework, while keeping the older HSK 2.0 content clearly labelled until it has been mapped and replaced. The official Chinese Tests Service describes HSK 3.0 as three stages and nine levels and specifies five skill areas: listening, speaking, reading, writing, and translation at advanced levels. Its syllabus organizes learning around tasks, topics, vocabulary, grammar, and Chinese characters.

Official reference: https://www.chinesetest.cn/HSK

The official service currently announces worldwide HSK 3.0 launch for 13 December 2026. Before that date, label the new syllabus as the published HSK 3.0 framework and avoid implying that the new exam rollout has already happened.

## Required learning outcomes

### Pronunciation and spoken language
- Pinyin initials, finals, syllable combinations, syllable structure and spelling rules.
- Four lexical tones, neutral tone, tone pairs, tone sandhi (including 不 and 一), and connected-speech changes.
- Articulation, aspiration contrasts, retroflex sounds, ü, rhythm, stress, pauses and natural intonation.
- Listening discrimination and production drills, minimal pairs, shadowing, dictation and spontaneous speech.
- Clear distinction between speech-to-text transcription and genuine pronunciation/tone assessment. Do not award a high pronunciation score from transcription similarity alone.

### Characters and vocabulary
- Simplified characters as the initial writing system, with traditional-character recognition as a later extension.
- Radicals, components, phonetic and semantic clues, stroke count, stroke order, structure and handwriting.
- Character recognition, sound-meaning links, compounds, collocations, measure words, word families and usage restrictions.
- Vocabulary taught in sentences and contexts, not as isolated translations.
- Spaced repetition driven by recall quality, error type and review history.

### Grammar and sentence building
- Word order, topic-comment structure, predicates, questions, negation, aspect, time, location, measure words and complements.
- Particles and functional words, including 的、地、得、了、过、着、把、被.
- Serial verbs, coverbs/prepositions, result/directional/potential complements, comparisons, disposal/passive constructions.
- Complex clauses, conjunctions, discourse markers, information structure, modality, register and pragmatics.
- Contrastive explanations for common learner errors, with many contextual examples and productive exercises.

### Listening and reading
- Carefully graded recordings at natural and learner-friendly speeds, multiple speakers and voices, and progressively varied accents.
- Word boundary recognition, reductions, implied meaning, speaker intention and inference.
- Graded dialogues, notices, messages, stories, articles, interviews, news, academic and professional texts.
- Character-by-character and phrase-by-phrase reading support, pinyin reveal controls, vocabulary capture and comprehension checks.
- Reading fluency and extensive-reading progression, not only multiple-choice tests.

### Speaking and writing
- Guided repetition, substitution drills, question-answer practice, role-play, narration, explanation, discussion, presentations and debate.
- AI conversation with level-aware vocabulary and grammar constraints, natural follow-up questions, interruption/recovery practice and actionable corrections.
- Sentence construction, dictation, handwriting, short messages, paragraphs, summaries, essays and formal writing.
- Feedback on grammar, word choice, coherence, tone/register, punctuation and character form.
- Revision loop: learner writes or speaks, receives corrections and explanations, then retries without seeing the model first.

### Cultural and pragmatic competence
- Greetings, address terms, politeness, social distance, turn-taking, indirectness, idioms, set phrases and context-sensitive language.
- Contemporary daily life, family, education, work, travel, food, media, history, literature and regional/cultural variation.
- Explain context and variation without presenting stereotypes as universal rules.

## Course architecture

Build a traceable curriculum for all three stages and nine bands. Each band must map its learning objectives to:
1. communicative tasks;
2. topics and situations;
3. vocabulary and collocations;
4. grammar and discourse functions;
5. characters and handwriting;
6. listening outcomes;
7. speaking outcomes;
8. reading outcomes;
9. writing outcomes;
10. assessment criteria and prerequisite knowledge.

Do not treat HSK level labels as the whole curriculum. Add practical language needed for real life even when a particular exam list does not cover it.

## Required lesson template

Every core lesson should contain:
1. measurable objectives and prerequisite review;
2. a short diagnostic retrieval warm-up;
3. clear teaching with examples and contrastive examples;
4. native-quality audio with replay, slow playback and transcript controls;
5. guided recognition and comprehension;
6. controlled practice with immediate explanations;
7. productive speaking and/or writing from memory;
8. AI feedback with correction reasons and a retry;
9. a short exit assessment;
10. automatic spaced-repetition scheduling and progress update.

A lesson is not complete merely because a user opened it. Mastery requires demonstrated recall and skill performance.

## AI tutor requirements

The tutor must know the learner's current band, completed lessons, active vocabulary, known grammar, recurring errors and review queue. It should:
- converse in Mandarin at the selected difficulty;
- adjust speed and complexity without making every exchange unnaturally simple;
- ask follow-up questions and keep the learner producing Chinese;
- correct errors selectively and explain why a correction is better;
- distinguish acceptable alternatives from actual errors;
- provide pinyin and English support on demand, then gradually fade it;
- create targeted drills from the learner's own mistakes;
- switch between conversation, pronunciation coach, grammar teacher, writing coach, reading guide and exam practice;
- save useful corrections and assign follow-up review.

## Assessment and progression gates

Track listening, speaking, reading, writing, characters, vocabulary and grammar separately. Use diagnostic placement, lesson exit checks, periodic cumulative reviews, realistic performance tasks and level-end assessments.

Require evidence of retention over time. A learner should not unlock the next band solely by passing a single quiz. Include minimum thresholds for each skill and remedial paths for weak areas.

## Self-contained product requirements

The web experience must include the curriculum, audio, interactive practice, AI tutor, dictionary/glossary, grammar reference, character reference, graded reading library, writing workspace, review system, assessments and learner progress. Core lessons must not send learners to external websites to complete learning activities.

## Current repository baseline and honest gaps

The existing LinguaApp repository already has:
- an Expo/React Native application with web support;
- a Supabase-backed course engine and progress;
- Chinese HSK 2.0 vocabulary/course mapping in `server/hsk.js`;
- pinyin practice, character lessons and handwriting screens;
- an AI speaking partner, spoken teacher flow, speech input and text-to-speech;
- books/import/photo reading tools and progress tracking.

This is a strong starting point, not a finished advanced Chinese academy. The current Chinese course code explicitly uses the 2015 HSK 2.0 six-level vocabulary list. It must not be described as full HSK 3.0 or complete fluency coverage.

## Delivery sequence

1. Audit every current Chinese screen, API, table, lesson generator and assessment; identify what works on web and what is mobile-only.
2. Obtain and parse the official HSK 3.0 syllabus; create source-traceable vocabulary, characters, grammar, task and topic datasets for all nine bands.
3. Map existing HSK 2.0 content to the new framework, preserving useful work and clearly identifying missing content.
4. Build the complete curriculum and lesson-generation pipeline with quality checks and no empty or repeated lesson slots.
5. Strengthen listening and speaking: audio quality, connected speech, voice recording, pronunciation/tone diagnostics and realistic conversation tasks.
6. Complete character and writing instruction, including stroke order, handwriting evaluation and composition feedback.
7. Build graded reading, extensive listening, contextual vocabulary and integrated tasks.
8. Make AI tutor memory, error tracking, adaptive practice and spaced repetition reliable and privacy-conscious.
9. Add skill-specific placement and level-end assessments with progression gates.
10. Test the entire experience on desktop and mobile browsers, including real registration, persisted progress, audio, microphone permissions, AI failure states and accessibility.
11. Verify the deployed web app end-to-end before calling it complete.

## Definition of done

The Chinese Academy is ready to be called a self-contained beginner-to-advanced learning platform only when:
- all nine bands have reviewed, traceable coverage and complete lesson sequences;
- all required skills have teach-practise-assess loops;
- learners can complete all core learning activities inside the web app;
- AI practice gives useful, accurate corrections and remembers learning progress;
- progress is persisted and mastery gates work;
- no core pathway is a placeholder, dead link or unsupported promise;
- the deployed web experience passes end-to-end tests.


## Verified implementation baseline (checked 2026-11-09)

This section distinguishes the intended HSK 3.0 destination from the curriculum currently implemented in the repository.

- The current `server/hsk.js` and `server/hsk-vocabulary.json` implement the **2015 HSK 2.0 six-level vocabulary pathway**. The current app-level mapping is Beginner = HSK 1, Intermediate = HSK 2–3, Advanced = HSK 4–6.
- The Chinese course generator uses those HSK 2.0 word lists and grammar scopes. It is not yet an HSK 3.0 curriculum.
- The official Chinese Tests Service syllabus page identifies the HSK 3.0 components as tasks, topics, vocabulary, Chinese characters and grammar, and lists Levels 1–6 plus the combined Levels 7–9: https://www.chinesetest.cn/syllabus
- The official HSK 3.0 syllabus must be ingested as a new, separately versioned source. Do not relabel the existing HSK 2.0 dataset as HSK 3.0 or silently replace it.

### Live database snapshot

The connected production database was inspected on 2026-11-09:

- 3,500 legacy lesson slots exist: 415 are marked `ready` and 3,085 are marked `empty`. Empty legacy slots are generated on demand by the legacy lesson-maker; they are not proof of authored, reviewed lesson content.
- The legacy `words` table contains 3,319 word rows, but coverage is uneven across languages and levels.
- The newer multi-skill `course_lesson_content` table currently has zero cached lessons. It generates and caches complete lessons on demand.
- Course attempts, skill-progress rows, vocabulary-review rows, course enrolments and conversation-turn rows were empty at the time of the snapshot. This is an unused/untested live feature baseline, not proof that persistence works end-to-end with a real learner.

### Remaining curriculum release gates

1. Download and archive the exact official HSK 3.0 syllabus source; record publisher, version, publication date, effective date and checksum.
2. Extract and independently validate all nine levels' vocabulary, characters, grammar, topics and task requirements. Preserve the original HSK 2.0 pathway as a separately labelled legacy course.
3. Map each new HSK 3.0 item to a lesson sequence with prerequisites, spaced review and listening, speaking, reading and writing practice.
4. Add automated coverage reports that identify missing, duplicated, incorrectly levelled or unsupported items before release.
5. Generate representative lessons at each level, have qualified speakers/teachers review them, and record review status before describing the curriculum as complete.
6. Run a real learner journey for each supported language and level, including signup, placement, lesson generation, speaking/writing feedback, review, progress persistence and return-login recovery.
7. Verify live speech credentials and real browser microphone/audio behavior. Do not treat speech transcription as pronunciation scoring.
