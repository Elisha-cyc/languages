import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { speak, stopSpeaking } from "../speech";
import { API_URL } from "../config";
import { useVoice } from "../voice";

const PASS = 70; // percent
const MAX_TRIES = 3;

export default function FlashcardScreen({ navigation, route }) {
  const { lessonId, language } = route.params;
  const { data: words, error } = useFetch(`/lessons/${lessonId}/words`);
  const voice = useVoice(language);

  const [index, setIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [result, setResult] = useState(null);
  const [tries, setTries] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [problem, setProblem] = useState(null);

  // Stop any speech or recording when the user leaves this screen
  useEffect(
    () => () => {
      stopSpeaking();
      voice.cancel();
    },
    [],
  );

  if (error) return <Message text={error} />;
  if (!words)
    return (
      <Message text="Preparing your lesson... this can take up to 30 seconds the first time." />
    );
  if (!Array.isArray(words))
    return <Message text={words.error || "Could not load this lesson."} />;
  if (words.length === 0)
    return <Message text="This lesson has no content yet." />;

  const isLast = index === words.length - 1;
  const card = words[index];
  const isSentence = card.word.length > 28;

  const passed = result && result.score >= PASS;
  const canMove = !voice.available || passed || tries >= MAX_TRIES || skipped;

  function nextCard() {
    stopSpeaking();
    voice.cancel();
    if (isLast) {
      navigation.replace("Quiz", { lessonId });
      return;
    }
    setShowMeaning(false);
    setResult(null);
    setTries(0);
    setSkipped(false);
    setProblem(null);
    setIndex(index + 1);
  }

  function sayIt() {
    setProblem(null);
    stopSpeaking();
    voice.toggle({
      onText: async (heard) => {
        try {
          const res = await fetch(`${API_URL}/speech/compare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language, target: card.word, heard }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not check that");
          setResult({ ...data, heard });
          setTries((count) => count + 1);
        } catch (e) {
          setProblem(e.message);
        }
      },
      onError: (message) => setProblem(message),
    });
  }

  const sayLabel =
    voice.state === "listening"
      ? Platform.OS === "web"
        ? "Listening... speak now"
        : "Recording... tap to stop"
      : voice.state === "working"
        ? "Checking..."
        : result
          ? "🎤 Try again"
          : "🎤 Say it";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.counter}>
        Card {index + 1} of {words.length}
      </Text>

      <Pressable
        style={styles.card}
        onPress={() => setShowMeaning(!showMeaning)}
      >
        <Text style={[styles.word, isSentence && styles.sentence]}>
          {card.word}
        </Text>
        {card.pronunciation && (
          <Text style={styles.pronunciation}>{card.pronunciation}</Text>
        )}
        {showMeaning && <Text style={styles.meaning}>{card.meaning}</Text>}
        {showMeaning && card.focus && (
          <Text style={styles.focus}>Key word: {card.focus}</Text>
        )}
        {!showMeaning && (
          <Text style={styles.hint}>Tap to see the meaning</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.listen}
        onPress={() => speak(card.word, language)}
      >
        <Text style={styles.listenText}>🔊 Listen</Text>
      </Pressable>

      {voice.available ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Now say it</Text>
          <Pressable
            style={[
              styles.sayButton,
              voice.state === "listening" && styles.sayOn,
              voice.state === "working" && styles.disabled,
            ]}
            disabled={voice.state === "working"}
            onPress={sayIt}
          >
            <Text style={styles.sayText}>{sayLabel}</Text>
          </Pressable>

          {problem && <Text style={styles.problem}>{problem}</Text>}

          {result && (
            <View style={[styles.result, passed ? styles.good : styles.bad]}>
              <Text style={styles.score}>
                {passed ? "Well done! " : "Almost. "}
                {result.score}%
              </Text>
              <Text style={styles.line}>
                I heard: {result.heard || "(nothing)"}
              </Text>
              {result.missed.length > 0 && (
                <Text style={styles.line}>
                  Different or missing: {result.missed.join(", ")}
                </Text>
              )}
              {result.tip && <Text style={styles.tip}>{result.tip}</Text>}
              <Text style={styles.note}>
                This compares what the speech recognizer heard with the
                sentence. It cannot judge your accent directly.
              </Text>
            </View>
          )}

          {!canMove && (
            <Pressable style={styles.skip} onPress={() => setSkipped(true)}>
              <Text style={styles.skipText}>Skip this one</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Text style={styles.note}>
          Voice practice needs Chrome on the web, or the phone app.
        </Text>
      )}

      <Pressable
        style={[styles.button, !canMove && styles.disabled]}
        disabled={!canMove}
        onPress={nextCard}
      >
        <Text style={styles.buttonText}>
          {isLast ? "Take the quiz" : "Next"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f4f8",
    padding: 16,
  },
  counter: { fontSize: 16, color: "#666", marginBottom: 16 },
  card: {
    width: "100%",
    maxWidth: 360,
    padding: 28,
    borderRadius: 16,
    backgroundColor: "white",
    alignItems: "center",
    elevation: 4,
  },
  word: { fontSize: 32, fontWeight: "bold", textAlign: "center" },
  sentence: { fontSize: 24, lineHeight: 32 },
  pronunciation: {
    fontSize: 17,
    color: "#666",
    marginTop: 6,
    textAlign: "center",
  },
  meaning: {
    fontSize: 20,
    marginTop: 14,
    color: "#2a6fdb",
    textAlign: "center",
  },
  focus: { fontSize: 15, marginTop: 10, color: "#555", textAlign: "center" },
  hint: { fontSize: 13, color: "#999", marginTop: 14 },
  listen: {
    marginTop: 16,
    backgroundColor: "#dbe7ff",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  listenText: { color: "#2a6fdb", fontSize: 18 },
  panel: {
    width: "100%",
    maxWidth: 360,
    marginTop: 16,
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  panelTitle: { fontSize: 15, fontWeight: "bold", textAlign: "center" },
  sayButton: {
    marginTop: 10,
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
  },
  sayOn: { backgroundColor: "#d9534f" },
  sayText: { color: "white", fontSize: 17 },
  problem: {
    marginTop: 10,
    color: "#c0392b",
    textAlign: "center",
    lineHeight: 20,
  },
  result: { marginTop: 12, borderRadius: 10, padding: 12, borderWidth: 1 },
  good: { backgroundColor: "#eef6ee", borderColor: "#b9dbb9" },
  bad: { backgroundColor: "#fff7e0", borderColor: "#ecd48f" },
  score: { fontSize: 18, fontWeight: "bold" },
  line: { fontSize: 15, marginTop: 4, lineHeight: 21 },
  tip: { fontSize: 15, marginTop: 8, color: "#2a6fdb", lineHeight: 21 },
  note: {
    fontSize: 12,
    color: "#777",
    marginTop: 8,
    lineHeight: 17,
    textAlign: "center",
  },
  skip: { marginTop: 10, padding: 8, alignItems: "center" },
  skipText: { color: "#666", fontSize: 14 },
  button: {
    marginTop: 16,
    backgroundColor: "#2a6fdb",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  buttonText: { color: "white", fontSize: 18 },
  disabled: { opacity: 0.4 },
});
