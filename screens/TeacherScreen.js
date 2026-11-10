import { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
} from "react-native";
import { API_URL, NATIVE_LANGUAGE } from "../config";
import LanguagePicker from "../components/LanguagePicker";
import { speak, speakAndWait, stopSpeaking } from "../speech";
import { compareSpeech } from "../listen";
import { useVoice } from "../voice";
import { useQuietOnLeave } from "../useQuietOnLeave";
import {
  canRecord,
  prepareRecorder,
  startRecording,
  BAR_COUNT,
} from "../recorder";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

// Each level has its own topics (the server accepts the same lists)
const TOPICS = {
  Beginner: [
    "Greetings",
    "Introducing yourself",
    "Polite words",
    "Numbers 1 to 10",
    "Food and drink",
    "Getting around",
  ],
  Intermediate: [
    "Ordering at a restaurant",
    "Shopping and prices",
    "Asking for directions",
    "Talking about your day",
    "Making plans with a friend",
    "At the doctor",
  ],
  Advanced: [
    "Job interview",
    "Giving and defending opinions",
    "Talking about the news",
    "Telling a story about the past",
    "Negotiating and persuading",
    "Culture and traditions",
  ],
};
const CHINESE_TOPICS = {
  Beginner: ["HSK 1 words and simple sentences", "HSK 1 greetings and introductions", "HSK 1 numbers, dates and time", "HSK 1 family, food and daily life", "HSK 1 question words and sentence order"],
  Intermediate: ["HSK 2–3 everyday conversations", "HSK 2–3 travel, shopping and directions", "HSK 2–3 experiences and plans", "HSK 2–3 comparisons and reasons", "HSK 2–3 connected sentences and short stories"],
  Advanced: ["HSK 4–6 extended conversation", "HSK 4–6 opinions and explanations", "HSK 4–6 news, culture and society", "HSK 4–6 formal and written Chinese", "HSK 4–6 idioms, nuance and argument"],
};
const topicsFor = (language, level) =>
  /chinese/i.test(language) ? CHINESE_TOPICS[level] : TOPICS[level];

const PERFECT = 95; // score from this up: "Perfect"
const GOOD = 80; // from this up: good enough to move on
const MAX_TRIES = 3; // after this many tries we move on and mark it for practice
const SLOW = 0.7; // speaking speed of the teacher's model phrase
const PAUSE_MS = 900; // short pause before the next phrase

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function verdictOf(score) {
  if (score >= PERFECT) return "perfect";
  if (score >= GOOD) return "good";
  return "practice";
}

const VERDICT_TEXT = {
  perfect: "✅ Perfect",
  good: "👍 Good",
  practice: "🔁 Needs more practice",
};

export default function TeacherScreen() {
  const [phase, setPhase] = useState("setup"); // setup, loading, lesson, done
  const [language, setLanguage] = useState("French");
  const [level, setLevel] = useState("Beginner");
  const [topic, setTopic] = useState(TOPICS.Beginner[0]);
  const [lesson, setLesson] = useState(null);
  const [index, setIndex] = useState(0);
  // teaching, listening, checking, ready (waiting for the mic tap), feedback
  const [stage, setStage] = useState("teaching");
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [results, setResults] = useState([]); // best score + verdict per phrase
  const [error, setError] = useState(null);
  const [scoring, setScoring] = useState(false); // true when Azure scores the voice
  const [recorderMode, setRecorderMode] = useState(false); // true when we record the voice ourselves
  const [levels, setLevels] = useState(() => new Array(BAR_COUNT).fill(0)); // live sound bars
  const [classroomInput, setClassroomInput] = useState("");
  const [classroomMessages, setClassroomMessages] = useState([]);
  const [classroomBusy, setClassroomBusy] = useState(false);
  const [classroomError, setClassroomError] = useState(null);
  const [learnerProfile, setLearnerProfile] = useState(null);

  const voice = useVoice(language);
  const run = useRef(0); // numbers each teacher sequence so an old one can be dropped
  const recording = useRef(null);
  const handled = useRef(false); // one result per try
  const scoringRef = useRef(false); // true: we record the voice ourselves
  const azureRef = useRef(false); // true: Azure scores it, otherwise speech-to-text
  const heardVoice = useRef(false); // did the microphone pick up a voice this try?
  const listenStartedAt = useRef(0);
  const lessonRef = useRef(null);
  const nativeName = NATIVE_LANGUAGE || "English";

  function cancelRecording() {
    if (recording.current) {
      recording.current.cancel();
      recording.current = null;
    }
  }

  // The teacher stops talking and the mic switches off when you leave
  useQuietOnLeave(() => {
    run.current++;
    stopSpeaking();
    voice.cancel();
    cancelRecording();
  });

  // Safari on iPhone only lets a page speak if speech started from a tap.
  // The lesson is fetched first (which takes a few seconds), so start a silent
  // utterance now, while we are still inside the tap.
  function unlockSpeech() {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.speechSynthesis &&
      typeof SpeechSynthesisUtterance !== "undefined"
    ) {
      try {
        const silent = new SpeechSynthesisUtterance(" ");
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
      } catch (e) {
        // speech just stays as it was
      }
    }
  }

  // Choosing a level also switches to that level's first topic
  function chooseLevel(value) {
    setLevel(value);
    setTopic(topicsFor(language, value)[0]);
  }

  function chooseLanguage(value) {
    setLanguage(value);
    setTopic(topicsFor(value, level)[0]);
  }

  async function start() {
    setClassroomMessages([]);
    setClassroomInput("");
    setLearnerProfile(null);
    // Keep speech unlock and recorder preparation inside the original user tap.
    unlockSpeech();
    prepareRecorder();
    setClassroomError(null);
    try {
      const profileResponse = await fetch(`${API_URL}/teacher/profile?language=${encodeURIComponent(language)}&level=${encodeURIComponent(level)}`);
      const profileData = await profileResponse.json();
      if (profileResponse.ok) setLearnerProfile(profileData.profile || null);
    } catch (profileError) {
      console.warn("Could not load teacher learning profile:", profileError.message);
    }
    setError(null);
    setPhase("loading");

    // Can this browser record? (then we record and show the live wave)
    // Can the server score pronunciation? (otherwise speech-to-text checks the words)
    const recordable = canRecord();
    let canScore = false;
    try {
      if (recordable) {
        const res = await fetch(`${API_URL}/pronounce/status`);
        canScore = res.ok && (await res.json()).enabled === true;
      }
    } catch (e) {
      canScore = false;
    }
    scoringRef.current = recordable;
    azureRef.current = canScore;
    setRecorderMode(recordable);
    setScoring(canScore);

    try {
      const res = await fetch(`${API_URL}/teacher/lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, level, topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The teacher is unavailable");
      begin(data);
    } catch (e) {
      setError(e.message);
      setPhase("setup");
    }
  }

  function begin(data) {
    lessonRef.current = data;
    setLesson(data);
    setResults(data.steps.map(() => ({ best: 0, verdict: "practice" })));
    setPhase("lesson");
    play(data, 0);
  }

  // ---------- One phrase: teach, listen, score, react, move on ----------

  // The teacher introduces the phrase, then says it slowly
  async function play(data, stepIndex) {
    const id = ++run.current;
    cancelRecording();
    voice.cancel();
    setIndex(stepIndex);
    setStage("teaching");
    setResult(null);
    setAttempts(0);
    setError(null);

    const step = data.steps[stepIndex];
    const intro =
      stepIndex === 0 && data.greeting
        ? `${data.greeting} ${step.teach}`
        : step.teach;

    await speakAndWait(intro, nativeName);
    if (id !== run.current) return;
    await speakAndWait(step.phrase, language, { rate: SLOW });
    if (id !== run.current) return;
    listen(data, stepIndex, 0, id);
  }

  // Your turn. With pronunciation scoring the mic opens by itself and closes
  // when you stop talking; without it you tap the mic.
  async function listen(data, stepIndex, attempt, id) {
    if (id !== run.current) return;
    setAttempts(attempt);
    setResult(null);
    handled.current = false;

    if (!scoringRef.current) {
      setStage("ready");
      return;
    }

    setStage("listening");
    heardVoice.current = false;
    listenStartedAt.current = Date.now();
    try {
      recording.current = await startRecording({
        onLevels: (bars) => {
          if (Math.max(...bars) > 0.15) heardVoice.current = true;
          setLevels(bars);
        },
        onAutoStop: (blob) => {
          recording.current = null;
          checkRecording(data, stepIndex, attempt, id, blob);
        },
      });
    } catch (e) {
      setError(
        "I could not use the microphone. Allow it in your browser settings, then tap the microphone button.",
      );
      setStage("ready");
    }
  }

  async function checkRecording(data, stepIndex, attempt, id, blob) {
    if (handled.current || id !== run.current) return;
    handled.current = true;
    const step = data.steps[stepIndex];

    if (!blob) {
      return giveFeedback(data, stepIndex, attempt, id, {
        none: true,
        score: 0,
        words: [],
      });
    }

    // Whisper is the reliable word-recognition fallback when Azure
    // pronunciation assessment is unavailable or does not recognise a language.
    // Azure's TTS voice list is broader than its pronunciation-assessment support.
    async function compareWithTranscription() {
      const form = new FormData();
      form.append("language", language);
      form.append("audio", blob, "speech.wav");
      const res = await fetch(`${API_URL}/speech/transcribe`, {
        method: "POST",
        body: form,
      });
      if (res.status === 422) {
        if (id !== run.current) return;
        return giveFeedback(data, stepIndex, attempt, id, {
          none: true,
          score: 0,
          words: [],
        });
      }
      const transcriptData = await res.json();
      if (!res.ok) {
        throw new Error(transcriptData.error || "Speech recognition failed.");
      }
      if (id !== run.current) return;
      const transcript = String(transcriptData.text || "").trim();
      if (!transcript) {
        return giveFeedback(data, stepIndex, attempt, id, {
          none: true,
          score: 0,
          words: [],
        });
      }
      const check = compareSpeech(step.phrase, transcript, language);
      return giveFeedback(data, stepIndex, attempt, id, {
        score: check.score,
        words: (check.missed || []).map((word) => ({ word, score: 0 })),
        heard: transcript,
        wordsOnly: true,
      });
    }

    setStage("checking");
    if (!azureRef.current) {
      try {
        return await compareWithTranscription();
      } catch (e) {
        if (id !== run.current) return;
        setError(e.message || "I could not check what you said. Tap the microphone to try again.");
        setStage("ready");
        return;
      }
    }

    let outcome;
    try {
      const res = await fetch(
        `${API_URL}/pronounce/check?language=${encodeURIComponent(language)}&text=${encodeURIComponent(step.phrase)}`,
        {
          method: "POST",
          headers: { "Content-Type": "audio/wav" },
          body: blob,
        },
      );
      if (!res.ok) throw new Error("Pronunciation assessment is unavailable for this language.");
      outcome = await res.json();
    } catch (e) {
      if (id !== run.current) return;
      // Do not leave learners stuck when Azure rejects a language or recording.
      try {
        return await compareWithTranscription();
      } catch (fallbackError) {
        if (id !== run.current) return;
        setError(fallbackError.message || "I could not check what you said. Please try again.");
        setStage("ready");
        return;
      }
    }
    if (id !== run.current) return;

    if (!outcome.heard) {
      try {
        return await compareWithTranscription();
      } catch (e) {
        if (id !== run.current) return;
        setError(e.message || "I could not recognise your speech. Please try again.");
        setStage("ready");
        return;
      }
    }

    if (!outcome.supported) {
      // This language gave no scores: compare the words that were recognised
      const check = compareSpeech(step.phrase, outcome.recognized, language);
      return giveFeedback(data, stepIndex, attempt, id, {
        score: check.score,
        words: (check.missed || []).map((word) => ({ word, score: 0 })),
        heard: outcome.recognized,
        wordsOnly: true,
      });
    }

    return giveFeedback(data, stepIndex, attempt, id, {
      score: outcome.score,
      accuracy: outcome.accuracy,
      fluency: outcome.fluency,
      completeness: outcome.completeness,
      words: outcome.words || [],
      heard: outcome.recognized,
    });
  }

  // The teacher reacts out loud, then the lesson moves on by itself
  async function giveFeedback(data, stepIndex, attempt, id, outcome) {
    const step = data.steps[stepIndex];
    const verdict = outcome.none ? "practice" : verdictOf(outcome.score);
    const triesLeft = attempt + 1 < MAX_TRIES;

    setResult({
      ...outcome,
      verdict,
      last: verdict === "practice" && !triesLeft,
    });
    setStage("feedback");
    setResults((current) =>
      current.map((entry, k) =>
        k === stepIndex && outcome.score >= entry.best
          ? {
              best: outcome.score,
              verdict: outcome.none ? entry.verdict : verdictOf(outcome.score),
            }
          : entry,
      ),
    );

    if (verdict === "perfect") {
      await speakAndWait(step.perfect || step.praise, nativeName);
    } else if (verdict === "good") {
      await speakAndWait(step.praise, nativeName);
    } else {
      await speakAndWait(step.retry, nativeName);
      if (id !== run.current) return;
      // Say the weakest words slowly, then the whole phrase again
      const weak = (outcome.words || [])
        .filter((word) => word.score < 75)
        .slice(0, 2);
      for (const word of weak) {
        await speakAndWait(word.word, language, { rate: SLOW });
        if (id !== run.current) return;
      }
      await speakAndWait(step.phrase, language, { rate: SLOW });
    }
    if (id !== run.current) return;

    if (verdict === "practice" && triesLeft) {
      listen(data, stepIndex, attempt + 1, id); // another try
      return;
    }

    await sleep(PAUSE_MS);
    if (id !== run.current) return;
    next(data, stepIndex);
  }

  function next(data, stepIndex) {
    if (stepIndex + 1 >= data.steps.length) {
      finish(data);
    } else {
      play(data, stepIndex + 1);
    }
  }

  async function finish(data) {
    const id = ++run.current;
    cancelRecording();
    stopSpeaking();
    voice.cancel();
    setPhase("done");
    // Save evidence from this lesson so the teacher can plan the next one.
    const evidence = data.steps.map((step, index) => ({
      phrase: step.phrase,
      score: results[index]?.best || 0,
    })).filter((item) => item.score > 0);
    if (evidence.length) {
      fetch(`${API_URL}/teacher/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, level, topic: data.topic || topic, results: evidence }),
      }).then(async (response) => {
        const saved = await response.json();
        if (response.ok && saved.profile) setLearnerProfile(saved.profile);
        else if (!response.ok) console.warn("Teacher progress was not saved:", saved.error);
      }).catch((saveError) => console.warn("Teacher progress save failed:", saveError.message));
    }
    if (data.closing) {
      await speakAndWait(data.closing, nativeName);
      if (id !== run.current) return;
    }
  }

  // Pause the phrase drill and let the learner have a real back-and-forth with
  // the teacher. The same lesson context and recent dialogue are sent to AI.
  async function askTeacher() {
    const question = classroomInput.trim();
    if (!question || classroomBusy || !lesson) return;
    const prior = classroomMessages.slice(-12).map((message) => ({
      role: message.role,
      content: message.role === "assistant"
        ? `Teacher explanation: ${message.explanation}\nModel: ${message.model}\nPractice: ${message.practicePrompt}`
        : message.content,
    }));
    const id = ++run.current;
    cancelRecording();
    voice.cancel();
    stopSpeaking();
    setStage("ready");
    setClassroomMessages((current) => [...current, { role: "user", content: question }]);
    setClassroomInput("");
    setClassroomBusy(true);
    setClassroomError(null);
    try {
      const step = lesson.steps[index];
      const response = await fetch(`${API_URL}/teacher/classroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, level, topic: lesson.topic || topic, question, currentPhrase: step?.phrase, currentMeaning: step?.meaning, history: prior }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your teacher could not answer just now.");
      if (id !== run.current) return;
      setClassroomMessages((current) => [...current, { role: "assistant", ...data }]);
      await speakAndWait(data.explanation, nativeName);
      if (id !== run.current) return;
      await speakAndWait(data.model, language, { rate: SLOW });
    } catch (e) {
      if (id === run.current) setClassroomError(e.message || "Could not reach your teacher. Please try again.");
    } finally {
      if (id === run.current) setClassroomBusy(false);
    }
  }

  // ---------- Buttons ----------

  function hear(rate) {
    cancelRecording();
    run.current++;
    stopSpeaking();
    setStage("ready");
    speak(lesson.steps[index].phrase, language, rate ? { rate } : {});
  }

  function hearTip() {
    cancelRecording();
    run.current++;
    stopSpeaking();
    setStage("ready");
    speak(lesson.steps[index].tip, nativeName);
  }

  // The microphone button
  async function micTap() {
    if (stage === "listening" && recording.current) {
      // "Done": stop now instead of waiting for silence
      const active = recording.current;
      recording.current = null;
      const blob = await active.stop();
      checkRecording(lesson, index, attempts, run.current, blob);
      return;
    }

    // Without scoring, "Done" just stops the browser's listening; its own
    // callbacks then deliver the result and the lesson carries on
    if (stage === "listening" && !scoringRef.current) {
      voice.toggle({});
      return;
    }

    stopSpeaking();
    setError(null);

    if (scoringRef.current) {
      const id = ++run.current;
      listen(lesson, index, attempts, id);
      return;
    }

    // Without scoring: listen with the browser, then compare the words
    run.current++;
    setStage("listening");
    const id = run.current;
    const attempt = attempts;
    voice.toggle({
      onText: (heard) => {
        const step = lesson.steps[index];
        const check = compareSpeech(step.phrase, heard, language);
        giveFeedback(lesson, index, attempt, id, {
          score: check.score,
          words: (check.missed || []).map((word) => ({ word, score: 0 })),
          heard,
          wordsOnly: true,
        });
      },
      onError: (text) => {
        setError(text);
        setStage("ready");
      },
      onEnd: () =>
        setStage((current) => (current === "listening" ? "ready" : current)),
    });
  }

  function skip() {
    cancelRecording();
    voice.cancel();
    run.current++;
    stopSpeaking();
    next(lesson, index);
  }

  function restart(data) {
    unlockSpeech();
    prepareRecorder();
    begin(data);
  }

  function practiceWeak() {
    const weak = lesson.steps.filter(
      (_, k) => results[k] && results[k].verdict === "practice",
    );
    restart({ ...lesson, steps: weak, greeting: "" });
  }

  function reset() {
    run.current++;
    stopSpeaking();
    voice.cancel();
    cancelRecording();
    setLesson(null);
    setClassroomMessages([]);
    setClassroomInput("");
    setClassroomBusy(false);
    setPhase("setup");
  }

  // ---------- Setup ----------
  if (phase === "setup" || phase === "loading") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Learn with a teacher</Text>
        <Text style={styles.note}>
          Your AI teacher explains each phrase, says it slowly, then listens to
          you, scores your pronunciation and moves on by itself. After you tap
          Start, everything is spoken automatically.
        </Text>

        <Text style={styles.label}>Language</Text>
        <LanguagePicker value={language} onChange={chooseLanguage} />

        <Text style={styles.label}>Your level</Text>
        {/chinese/i.test(language) && (
          <Text style={styles.note}>Chinese curriculum: Beginner = HSK 1 · Intermediate = HSK 2–3 · Advanced = HSK 4–6. The lessons include HSK words, grammar, pinyin and tones.</Text>
        )}
        <View style={styles.chips}>
          {LEVELS.map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, level === value && styles.chipOn]}
              onPress={() => chooseLevel(value)}
            >
              <Text
                style={[styles.chipText, level === value && styles.chipTextOn]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Topic</Text>
        <View style={styles.chips}>
          {topicsFor(language, level).map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, topic === value && styles.chipOn]}
              onPress={() => setTopic(value)}
            >
              <Text
                style={[styles.chipText, topic === value && styles.chipTextOn]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, phase === "loading" && styles.buttonOff]}
          onPress={start}
          disabled={phase === "loading"}
        >
          {phase === "loading" ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Start the lesson</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  // ---------- Finished ----------
  if (phase === "done") {
    const average = Math.round(
      results.reduce((sum, entry) => sum + entry.best, 0) /
        Math.max(1, results.length),
    );
    const weakCount = results.filter(
      (entry) => entry.verdict === "practice",
    ).length;

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Lesson finished</Text>
        <Text style={styles.note}>
          {lesson.title} - average score {average}/100.
          {weakCount === 0
            ? " Every phrase was good or perfect."
            : ` ${weakCount} phrase${weakCount === 1 ? " needs" : "s need"} more practice.`}
        </Text>
        {lesson.steps.map((step, i) => {
          const entry = results[i] || { best: 0, verdict: "practice" };
          return (
            <View
              key={i}
              style={[
                styles.card,
                entry.verdict === "perfect" && styles.good,
                entry.verdict === "practice" && styles.bad,
              ]}
            >
              <Text style={styles.phrase}>{step.phrase}</Text>
              <Text style={styles.meaning}>{step.meaning}</Text>
              <Text style={styles.small}>
                {VERDICT_TEXT[entry.verdict]} - best {entry.best}/100
              </Text>
            </View>
          );
        })}
        {weakCount > 0 && (
          <Pressable style={styles.button} onPress={practiceWeak}>
            <Text style={styles.buttonText}>
              Practice the ones that need work
            </Text>
          </Pressable>
        )}
        <Pressable
          style={weakCount > 0 ? styles.next : styles.button}
          onPress={() => restart(lesson)}
        >
          <Text style={weakCount > 0 ? styles.nextText : styles.buttonText}>
            Practice the whole lesson again
          </Text>
        </Pressable>
        <Pressable style={styles.link} onPress={reset}>
          <Text style={styles.linkText}>Choose a new lesson</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ---------- The lesson ----------
  const step = lesson.steps[index];
  const busy =
    stage === "teaching" || stage === "checking" || stage === "feedback";
  const slowAnswer = result && result.verdict === "practice";

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.classroomHeader}>
        <View style={styles.teacherAvatar}><Text style={styles.teacherAvatarText}>👩‍🏫</Text></View>
        <View style={styles.classroomHeaderText}>
          <Text style={styles.classroomEyebrow}>LINGUA CLASSROOM · IN SESSION</Text>
          <Text style={styles.classroomTitle}>{lesson.teacher}, your teacher</Text>
          <Text style={styles.small}>{lesson.title} · {index + 1} of {lesson.steps.length}</Text>
        </View>
      </View>
      <Text style={styles.boardLabel}>TODAY'S LESSON</Text>

      <View style={styles.card}>
        <Text style={styles.phrase}>{step.phrase}</Text>
        {step.pronunciation ? (
          <Text style={styles.pronunciation}>{step.pronunciation}</Text>
        ) : null}
        <Text style={styles.meaning}>{step.meaning}</Text>
      </View>

      {stage === "teaching" && (
        <View style={styles.status}>
          <ActivityIndicator />
          <Text style={styles.statusText}>{lesson.teacher} is speaking...</Text>
        </View>
      )}
      {stage === "listening" && (
        <View>
          <Text style={styles.prompt}>
            {!recorderMode
              ? "🎤 Listening... say the phrase now"
              : heardVoice.current
                ? "🎙 I can hear you..."
                : "🎤 Waiting for your voice... say the phrase now"}
            {attempts > 0 ? ` (try ${attempts + 1} of ${MAX_TRIES})` : ""}
          </Text>
          {recorderMode &&
            !heardVoice.current &&
            Date.now() - listenStartedAt.current > 4000 && (
              <Text style={styles.error}>
                I cannot hear anything. Check that the microphone is allowed for
                this page and that you are not muted.
              </Text>
            )}
        </View>
      )}
      {stage === "checking" && (
        <View style={styles.status}>
          <ActivityIndicator />
          <Text style={styles.statusText}>Checking your pronunciation...</Text>
        </View>
      )}
      {stage === "ready" && (
        <Text style={styles.prompt}>
          Your turn. Tap the microphone and say it.
        </Text>
      )}

      {result && (
        <View
          style={[
            styles.card,
            result.verdict === "perfect" && styles.good,
            result.verdict === "good" && styles.okay,
            result.verdict === "practice" && styles.bad,
          ]}
        >
          <Text style={styles.verdict}>
            {result.none
              ? "❌ I did not hear you"
              : result.verdict === "practice"
                ? "❌ Not correct yet"
                : "✅ Correct!"}
          </Text>
          {!result.none && (
            <Text style={styles.score}>
              {VERDICT_TEXT[result.verdict]} - {result.score}/100
            </Text>
          )}

          {result.words && result.words.length > 0 && !result.wordsOnly && (
            <View style={styles.chips}>
              {result.words.map((word, i) => (
                <View
                  key={i}
                  style={[
                    styles.wordChip,
                    word.score >= GOOD
                      ? styles.wordGood
                      : word.score >= 60
                        ? styles.wordOkay
                        : styles.wordBad,
                  ]}
                >
                  <Text style={styles.wordText}>
                    {word.word} {word.score}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {result.accuracy != null && (
            <Text style={styles.small}>
              Accuracy {result.accuracy} - Fluency {result.fluency} -
              Completeness {result.completeness}
            </Text>
          )}
          {result.wordsOnly && result.words.length > 0 && (
            <Text style={styles.small}>
              Words I did not catch:{" "}
              {result.words.map((word) => word.word).join(", ")}
            </Text>
          )}
          {result.heard ? (
            <Text style={styles.small}>I heard: {result.heard}</Text>
          ) : null}
          {slowAnswer && step.tip ? (
            <Text style={styles.small}>Tip: {step.tip}</Text>
          ) : null}
          {slowAnswer && result.last ? (
            <Text style={styles.small}>
              Let us move on. This phrase will be marked for more practice.
            </Text>
          ) : null}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.classroomPanel}>
        <Text style={styles.classroomPanelTitle}>Ask your teacher</Text>
        {learnerProfile ? (
          <View style={styles.profileCard}>
            <Text style={styles.profileTitle}>Your teacher's learning notes</Text>
            <Text style={styles.classroomHint}>Completed classroom lessons: {learnerProfile.lessonCount || 0}</Text>
            {learnerProfile.lastTopic ? <Text style={styles.classroomHint}>Last studied: {learnerProfile.lastTopic}</Text> : null}
            {learnerProfile.needsReview?.length ? <Text style={styles.classroomHint}>To revisit: {learnerProfile.needsReview.slice(-3).join(" · ")}</Text> : <Text style={styles.classroomHint}>Your teacher is still gathering evidence about what you know.</Text>}
          </View>
        ) : null}
        <Text style={styles.classroomHint}>Ask why a phrase is used, request another example, or tell your teacher what you do not understand.</Text>
        {classroomMessages.slice(-6).map((message, messageIndex) => (
          <View key={messageIndex} style={[styles.classroomBubble, message.role === "user" ? styles.studentBubble : styles.teacherBubble]}>
            <Text style={styles.classroomSpeaker}>{message.role === "user" ? "YOU" : lesson.teacher.toUpperCase()}</Text>
            {message.role === "user" ? (
              <Text style={styles.classroomBody}>{message.content}</Text>
            ) : (
              <>
                <Text style={styles.classroomBody}>{message.explanation}</Text>
                <Text style={styles.classroomModel}>{message.model}</Text>
                <Text style={styles.classroomTranslation}>{message.translation}</Text>
                {message.pronunciation ? <Text style={styles.classroomHint}>Pronunciation: {message.pronunciation}</Text> : null}
                {message.correction ? <Text style={styles.classroomHint}>Correction: {message.correction.original} → {message.correction.corrected}. {message.correction.reason}</Text> : null}
                <Text style={styles.classroomPractice}>Your turn: {message.practicePrompt}</Text>
                {message.practiceTranslation ? <Text style={styles.classroomHint}>{message.practiceTranslation}</Text> : null}
              </>
            )}
          </View>
        ))}
        <TextInput style={styles.classroomInput} value={classroomInput} onChangeText={setClassroomInput} placeholder="Ask a question or say what is confusing you..." multiline maxLength={700} editable={!classroomBusy} />
        <Pressable style={[styles.classroomSend, classroomBusy && styles.buttonOff]} onPress={askTeacher} disabled={classroomBusy || !classroomInput.trim()}>
          {classroomBusy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Ask teacher ↗</Text>}
        </Pressable>
        {classroomError ? <Text style={styles.error}>{classroomError}</Text> : null}
      </View>

      <View style={styles.row}>
        <Pressable style={styles.round} onPress={() => hear(0)}>
          <Text style={styles.roundText}>🔊 Hear it</Text>
        </Pressable>
        <Pressable style={styles.round} onPress={() => hear(SLOW)}>
          <Text style={styles.roundText}>🐢 Slowly</Text>
        </Pressable>
        <Pressable style={styles.round} onPress={hearTip}>
          <Text style={styles.roundText}>💡 Tip</Text>
        </Pressable>
      </View>

      {scoring || voice.available ? (
        <Pressable
          style={[
            styles.button,
            stage === "listening" && styles.buttonRec,
            busy && styles.buttonOff,
          ]}
          onPress={micTap}
          disabled={busy}
        >
          {stage === "listening" && recorderMode && (
            <View style={styles.wave}>
              {levels.map((value, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    { height: 4 + Math.round(value * 40) },
                  ]}
                />
              ))}
            </View>
          )}
          <Text style={styles.buttonText}>
            {stage === "listening"
              ? recorderMode
                ? "⏹ Tap when you are done"
                : "⏹ Done"
              : result && !result.none
                ? "🎤 Try again"
                : "🎤 Say it"}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.note}>
          Voice input is not available here, so I cannot listen to you. Try
          Chrome or Safari. You can still repeat the phrase out loud and tap
          Skip.
        </Text>
      )}

      <Pressable style={styles.next} onPress={skip}>
        <Text style={styles.nextText}>Skip this phrase ➜</Text>
      </Pressable>

      <Text style={styles.footnote}>
        {scoring
          ? "Scores come from a cloud pronunciation check that compares you with native speakers. 95 and above is Perfect, 80 and above is Good. It may not catch every tone mistake."
          : "I check the words you said. Accent and tone scoring is not switched on yet."}
      </Text>

      <Pressable style={styles.link} onPress={reset}>
        <Text style={styles.linkText}>End lesson</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: "#f2f4f8" },
  classroomHeader: { flexDirection: "row", alignItems: "center", backgroundColor: "#17324d", borderRadius: 18, padding: 16, marginBottom: 16 },
  teacherAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginRight: 13 },
  teacherAvatarText: { fontSize: 34 },
  classroomHeaderText: { flex: 1 },
  classroomEyebrow: { color: "#a9d9e8", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  classroomTitle: { color: "#fff", fontSize: 19, fontWeight: "800", marginTop: 3 },
  boardLabel: { color: "#68798c", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 3 },
  profileCard: { backgroundColor: "#eaf1f8", borderRadius: 12, padding: 12, marginBottom: 12 },
  profileTitle: { color: "#17324d", fontWeight: "800", marginBottom: 4 },
  classroomPanel: { backgroundColor: "#fff", borderRadius: 16, padding: 15, marginTop: 16, borderWidth: 1, borderColor: "#d9dee7" },
  classroomPanelTitle: { fontSize: 19, fontWeight: "800", color: "#18324d" },
  classroomHint: { color: "#667085", fontSize: 13, lineHeight: 19, marginTop: 5 },
  classroomBubble: { borderRadius: 13, padding: 12, marginTop: 10 },
  studentBubble: { backgroundColor: "#eaf2ff", alignSelf: "flex-end", maxWidth: "92%" },
  teacherBubble: { backgroundColor: "#f3f6f8", alignSelf: "stretch" },
  classroomSpeaker: { fontSize: 10, color: "#6b7b8c", fontWeight: "800", marginBottom: 5, letterSpacing: 0.8 },
  classroomBody: { color: "#27384a", fontSize: 15, lineHeight: 22 },
  classroomModel: { color: "#173f75", fontSize: 21, fontWeight: "800", marginTop: 9 },
  classroomTranslation: { color: "#526273", fontSize: 14, marginTop: 3 },
  classroomPractice: { color: "#176b61", fontWeight: "700", marginTop: 10, lineHeight: 20 },
  classroomInput: { minHeight: 76, borderWidth: 1, borderColor: "#cbd5df", borderRadius: 11, padding: 12, marginTop: 13, textAlignVertical: "top", color: "#243447" },
  classroomSend: { backgroundColor: "#176b83", paddingVertical: 13, borderRadius: 11, alignItems: "center", marginTop: 9 },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 8 },
  note: { color: "#555", lineHeight: 21, marginBottom: 12 },
  label: { marginTop: 14, marginBottom: 6, color: "#555", fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#c9cfd9",
    backgroundColor: "white",
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: "#2a6fdb", borderColor: "#2a6fdb" },
  chipText: { color: "#333" },
  chipTextOn: { color: "white" },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 18,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#d9dee7",
  },
  good: { borderColor: "#2e9e5b", backgroundColor: "#eaf7ef" },
  okay: { borderColor: "#6aa84f", backgroundColor: "#f1f8ea" },
  bad: { borderColor: "#d98a2b", backgroundColor: "#fdf4e6" },
  phrase: { fontSize: 30, fontWeight: "bold", marginBottom: 6 },
  pronunciation: { fontSize: 18, color: "#2a6fdb", marginBottom: 4 },
  meaning: { fontSize: 17, color: "#444" },
  verdict: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  score: { fontSize: 16, color: "#444", marginBottom: 8 },
  wave: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    marginBottom: 8,
  },
  waveBar: {
    width: 5,
    marginHorizontal: 1.5,
    borderRadius: 3,
    backgroundColor: "white",
  },
  small: { color: "#667085", fontSize: 14, marginTop: 4 },
  wordChip: {
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  wordGood: { backgroundColor: "#cfeedd" },
  wordOkay: { backgroundColor: "#fbe7b8" },
  wordBad: { backgroundColor: "#f6c9c4" },
  wordText: { fontSize: 15 },
  status: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  statusText: { marginLeft: 10, color: "#555" },
  prompt: { fontSize: 17, marginVertical: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", marginVertical: 8 },
  round: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#c9cfd9",
    backgroundColor: "white",
    marginRight: 8,
    marginBottom: 8,
  },
  roundText: { fontSize: 15 },
  button: {
    marginTop: 12,
    backgroundColor: "#2a6fdb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonRec: { backgroundColor: "#c0392b" },
  buttonOff: { opacity: 0.6 },
  buttonText: { color: "white", fontSize: 18 },
  next: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a6fdb",
    backgroundColor: "white",
  },
  nextText: { color: "#2a6fdb", fontSize: 17 },
  link: { padding: 14, alignItems: "center" },
  linkText: { color: "#2a6fdb", fontSize: 15 },
  footnote: { marginTop: 18, color: "#8a93a3", fontSize: 13, lineHeight: 18 },
  error: { color: "#c0392b", marginTop: 10 },
});
