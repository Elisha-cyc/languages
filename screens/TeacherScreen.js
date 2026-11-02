import { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { API_URL, NATIVE_LANGUAGE } from "../config";
import LanguagePicker from "../components/LanguagePicker";
import { speak, speakAndWait, stopSpeaking } from "../speech";
import { compareSpeech } from "../listen";
import { useVoice } from "../voice";
import { useQuietOnLeave } from "../useQuietOnLeave";

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

// Percent of the words that must be heard. Longer sentences are harder to say
// perfectly, so the bar is a little lower at the higher levels.
const PASS_BY_LEVEL = { Beginner: 80, Intermediate: 75, Advanced: 70 };
const SLOW = 0.7; // speaking speed of the teacher's model phrase

export default function TeacherScreen() {
  const [phase, setPhase] = useState("setup"); // setup, loading, lesson, done
  const [language, setLanguage] = useState("French");
  const [level, setLevel] = useState("Beginner");
  const [topic, setTopic] = useState(TOPICS.Beginner[0]);
  const [lesson, setLesson] = useState(null);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState("teaching"); // teaching, ready, listening, result
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [scores, setScores] = useState([]);
  const [error, setError] = useState(null);

  const voice = useVoice(language);
  const run = useRef(0); // numbers each teacher sequence so an old one can be dropped
  const nativeName = NATIVE_LANGUAGE || "English";

  // The teacher stops talking and the mic switches off when you leave
  useQuietOnLeave(() => {
    run.current++;
    stopSpeaking();
    voice.cancel();
  });

  // Choosing a level also switches to that level's first topic
  function chooseLevel(value) {
    setLevel(value);
    setTopic(TOPICS[value][0]);
  }

  async function start() {
    setError(null);
    setPhase("loading");
    try {
      const res = await fetch(`${API_URL}/teacher/lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, level, topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The teacher is unavailable");
      setLesson(data);
      setScores(data.steps.map(() => 0));
      setPhase("lesson");
      play(data, 0);
    } catch (e) {
      setError(e.message);
      setPhase("setup");
    }
  }

  // The teacher introduces the phrase, then says it slowly
  async function play(data, stepIndex) {
    const id = ++run.current;
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
    setStage("ready");
  }

  function hear(rate) {
    run.current++;
    stopSpeaking();
    speak(lesson.steps[index].phrase, language, rate ? { rate } : {});
  }

  function hearTip() {
    run.current++;
    stopSpeaking();
    speak(lesson.steps[index].tip, nativeName);
  }

  // Your turn: listen to the student
  function tryIt() {
    run.current++;
    stopSpeaking();
    setError(null);
    setStage("listening");
    voice.toggle({
      onText: (heard) => judge(heard),
      onError: (text) => {
        setError(text);
        setStage("ready");
      },
      onEnd: () =>
        setStage((current) => (current === "listening" ? "ready" : current)),
    });
  }

  async function judge(heard) {
    const step = lesson.steps[index];
    const check = compareSpeech(step.phrase, heard, language);
    const pass = check.score >= (PASS_BY_LEVEL[level] || 80);

    setAttempts((count) => count + 1);
    setResult({ heard, ...check, pass });
    setStage("result");
    setScores((current) =>
      current.map((best, i) =>
        i === index ? Math.max(best, check.score) : best,
      ),
    );

    // The teacher reacts out loud, and models the phrase again after a miss
    const id = ++run.current;
    if (pass) {
      await speakAndWait(step.praise, nativeName);
    } else {
      await speakAndWait(step.retry, nativeName);
      if (id !== run.current) return;
      await speakAndWait(step.phrase, language, { rate: SLOW });
    }
  }

  function next() {
    if (index + 1 >= lesson.steps.length) {
      finish();
    } else {
      play(lesson, index + 1);
    }
  }

  async function finish() {
    const id = ++run.current;
    stopSpeaking();
    voice.cancel();
    setPhase("done");
    if (lesson.closing) {
      await speakAndWait(lesson.closing, nativeName);
      if (id !== run.current) return;
    }
  }

  function again() {
    setPhase("lesson");
    play(lesson, 0);
  }

  function reset() {
    run.current++;
    stopSpeaking();
    voice.cancel();
    setLesson(null);
    setPhase("setup");
  }

  // ---------- Setup ----------
  if (phase === "setup" || phase === "loading") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Learn with a teacher</Text>
        <Text style={styles.note}>
          Your AI teacher explains a phrase, says it slowly, and you repeat it.
          The teacher listens and helps you try again.
        </Text>

        <Text style={styles.label}>Language</Text>
        <LanguagePicker value={language} onChange={setLanguage} />

        <Text style={styles.label}>Your level</Text>
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
          {TOPICS[level].map((value) => (
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
      scores.reduce((sum, value) => sum + value, 0) /
        Math.max(1, scores.length),
    );
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Lesson finished</Text>
        <Text style={styles.note}>
          {lesson.title} - you were understood {average}% of the time on
          average.
        </Text>
        {lesson.steps.map((step, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.phrase}>{step.phrase}</Text>
            <Text style={styles.meaning}>{step.meaning}</Text>
            <Text style={styles.small}>Best try: {scores[i]}%</Text>
          </View>
        ))}
        <Pressable style={styles.button} onPress={again}>
          <Text style={styles.buttonText}>Practice this lesson again</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={reset}>
          <Text style={styles.linkText}>Choose a new lesson</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ---------- The lesson ----------
  const step = lesson.steps[index];
  const canMove = result && (result.pass || attempts >= 2);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.small}>
        {lesson.teacher} - {lesson.title} - phrase {index + 1} of{" "}
        {lesson.steps.length}
      </Text>

      <View style={styles.card}>
        <Text
          style={[styles.phrase, step.phrase.length > 40 && styles.phraseLong]}
        >
          {step.phrase}
        </Text>
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
      {stage === "ready" && (
        <Text style={styles.prompt}>
          Your turn. Tap the microphone and repeat it.
        </Text>
      )}
      {stage === "listening" && (
        <Text style={styles.prompt}>Listening... say the phrase now.</Text>
      )}

      {result && stage === "result" && (
        <View style={[styles.card, result.pass ? styles.good : styles.bad]}>
          <Text style={styles.small}>
            I heard: {result.heard || "(nothing)"}
          </Text>
          <Text style={styles.resultText}>
            {result.pass ? step.praise : step.retry}
          </Text>
          {!result.pass && result.missed && result.missed.length > 0 && (
            <Text style={styles.small}>
              Words I did not catch: {result.missed.join(", ")}
            </Text>
          )}
          {!result.pass && step.tip ? (
            <Text style={styles.small}>Tip: {step.tip}</Text>
          ) : null}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

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

      {voice.available ? (
        <Pressable
          style={[styles.button, stage === "listening" && styles.buttonRec]}
          onPress={tryIt}
          disabled={stage === "teaching"}
        >
          <Text style={styles.buttonText}>
            {stage === "listening"
              ? "Stop"
              : result
                ? "🎤 Try again"
                : "🎤 Say it"}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.note}>
          Voice input is not available here, so I cannot listen to you. Try
          Chrome or Safari. You can still repeat the phrase out loud and
          continue.
        </Text>
      )}

      {(canMove || !voice.available) && (
        <Pressable style={styles.next} onPress={next}>
          <Text style={styles.nextText}>
            {result && !result.pass ? "Skip this phrase" : "Next"} ➜
          </Text>
        </Pressable>
      )}

      <Text style={styles.footnote}>
        I check that I understood the words you said. I cannot judge your accent
        or tones yet.
      </Text>

      <Pressable style={styles.link} onPress={reset}>
        <Text style={styles.linkText}>End lesson</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: "#f2f4f8" },
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
  bad: { borderColor: "#d98a2b", backgroundColor: "#fdf4e6" },
  phrase: { fontSize: 30, fontWeight: "bold", marginBottom: 6 },
  phraseLong: { fontSize: 22 },
  pronunciation: { fontSize: 18, color: "#2a6fdb", marginBottom: 4 },
  meaning: { fontSize: 17, color: "#444" },
  small: { color: "#667085", fontSize: 14, marginTop: 4 },
  resultText: { fontSize: 17, marginTop: 6 },
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
  buttonOff: { opacity: 0.7 },
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
