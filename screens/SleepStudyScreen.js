import { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { API_URL, USER_ID, NATIVE_LANGUAGE } from "../config";
import { speak, speakAndWait, stopSpeaking } from "../speech";

const ROUNDS = 2;
const COUNTDOWN_SECONDS = 15;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SleepStudyScreen({ navigation, route }) {
  const { sessionId, language } = route.params;
  const { data, error } = useFetch(
    `/sleep/sessions/${sessionId}?user=${USER_ID}`,
  );

  const [removed, setRemoved] = useState([]);
  const [removing, setRemoving] = useState(null);
  const [removeError, setRemoveError] = useState(null);
  const [handsFree, setHandsFree] = useState(true);
  const [phase, setPhase] = useState("idle"); // idle, playing, counting
  const [current, setCurrent] = useState(null);
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  const runId = useRef(0);
  const started = useRef(false);
  const wordsRef = useRef([]);

  // Stop everything when the user leaves
  useEffect(
    () => () => {
      runId.current++;
      stopSpeaking();
    },
    [],
  );

  // Start reading as soon as the words are loaded
  useEffect(() => {
    if (!data || !Array.isArray(data.words) || started.current || !handsFree)
      return;
    started.current = true;
    wordsRef.current = data.words.filter((w) => !removed.includes(w.id));
    playAll();
  }, [data]);

  function stopAuto() {
    runId.current++;
    stopSpeaking();
    setPhase("idle");
    setCurrent(null);
  }

  async function playAll() {
    const id = ++runId.current;
    setPhase("playing");

    for (let round = 0; round < ROUNDS; round++) {
      for (const item of [...wordsRef.current]) {
        if (id !== runId.current) return;
        if (!wordsRef.current.some((w) => w.id === item.id)) continue; // removed meanwhile

        setCurrent(item.id);
        await speakAndWait(item.word, language);
        if (id !== runId.current) return;
        await pause(700);
        await speakAndWait(item.meaning, NATIVE_LANGUAGE);
        await pause(1500);
      }
    }

    if (id !== runId.current) return;
    setCurrent(null);

    for (let s = COUNTDOWN_SECONDS; s > 0; s--) {
      if (id !== runId.current) return;
      setPhase("counting");
      setSeconds(s);
      await pause(1000);
    }

    if (id !== runId.current) return;
    stopSpeaking();
    navigation.navigate("SleepNight", { sessionId, language });
  }

  function toggleHandsFree() {
    if (handsFree) {
      setHandsFree(false);
      stopAuto();
    } else {
      setHandsFree(true);
      playAll();
    }
  }

  async function removeWord(item) {
    setRemoving(item.id);
    setRemoveError(null);
    try {
      const res = await fetch(
        `${API_URL}/sleep/sessions/${sessionId}/items/${item.id}?user=${USER_ID}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not remove that word");
      setRemoved((ids) => [...ids, item.id]);
    } catch (e) {
      setRemoveError(e.message);
    } finally {
      setRemoving(null);
    }
  }

  if (error) return <Message text={error} />;
  if (!data) return <Message text="Loading..." />;
  if (!Array.isArray(data.words))
    return <Message text={data.error || "Could not load the session."} />;

  const words = data.words.filter((w) => !removed.includes(w.id));
  wordsRef.current = words;
  const fromText = data.source === "text";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Review before bed</Text>
      {data.label && <Text style={styles.label}>From: {data.label}</Text>}

      {phase === "playing" && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Reading your words aloud. You can put the phone down and listen.
          </Text>
          <Pressable style={styles.bannerButton} onPress={stopAuto}>
            <Text style={styles.bannerButtonText}>Stop</Text>
          </Pressable>
        </View>
      )}

      {phase === "counting" && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Starting tonight's replay in {seconds} seconds. Sleep well.
          </Text>
          <Pressable style={styles.bannerButton} onPress={stopAuto}>
            <Text style={styles.bannerButtonText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.toggle} onPress={toggleHandsFree}>
        <Text style={styles.toggleText}>
          Hands-free: {handsFree ? "on" : "off"}
        </Text>
      </Pressable>

      <Text style={styles.note}>
        All {words.length} words get the same review. Tonight only some of them
        will be replayed softly while you sleep.
      </Text>

      {fromText && (
        <Text style={styles.warning}>
          The AI picked these words from your text and can make mistakes. If a
          word or meaning looks wrong, remove it now.
        </Text>
      )}
      {removeError && <Text style={styles.error}>{removeError}</Text>}

      {words.map((item) => (
        <View
          key={item.id}
          style={[styles.row, current === item.id && styles.rowOn]}
        >
          <View style={styles.rowText}>
            <Text style={styles.word}>{item.word}</Text>
            {item.pronunciation && (
              <Text style={styles.sub}>{item.pronunciation}</Text>
            )}
            <Text style={styles.meaning}>{item.meaning}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              style={styles.listen}
              onPress={() => {
                stopAuto();
                speak(item.word, language);
              }}
            >
              <Text style={styles.listenText}>🔊</Text>
            </Pressable>
            {fromText && (
              <Pressable
                style={[styles.remove, removing === item.id && styles.disabled]}
                disabled={removing !== null}
                onPress={() => removeWord(item)}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}

      <Pressable
        style={styles.button}
        onPress={() => {
          stopAuto();
          navigation.navigate("SleepEvening", { sessionId, language });
        }}
      >
        <Text style={styles.buttonText}>Take the evening quiz</Text>
      </Pressable>
      <Text style={styles.small}>
        The quiz gives each word a starting score, so tomorrow's test can show
        how much you kept overnight. Skipping it is fine.
      </Text>
      <Pressable
        style={styles.secondary}
        onPress={() => {
          stopAuto();
          navigation.navigate("SleepNight", { sessionId, language });
        }}
      >
        <Text style={styles.secondaryText}>Go to sleep now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "bold" },
  label: { fontSize: 14, color: "#666", marginTop: 4 },
  banner: {
    backgroundColor: "#eef2ff",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  bannerText: { fontSize: 15, color: "#333", lineHeight: 21 },
  bannerButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#dbe7ff",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  bannerButtonText: { color: "#2a6fdb", fontSize: 14 },
  toggle: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "#dbe7ff",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  toggleText: { color: "#2a6fdb", fontSize: 14 },
  note: {
    fontSize: 15,
    color: "#555",
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 22,
  },
  warning: {
    fontSize: 14,
    color: "#9a6700",
    backgroundColor: "#fff7e0",
    borderRadius: 8,
    padding: 10,
    lineHeight: 20,
  },
  error: { marginTop: 8, color: "#c0392b" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  rowOn: { borderColor: "#2a6fdb", backgroundColor: "#f3f7ff" },
  rowText: { flex: 1 },
  word: { fontSize: 20, fontWeight: "bold" },
  sub: { fontSize: 15, color: "#666" },
  meaning: { fontSize: 16, color: "#2a6fdb", marginTop: 2 },
  actions: { alignItems: "flex-end" },
  listen: {
    backgroundColor: "#dbe7ff",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  listenText: { fontSize: 18 },
  remove: { marginTop: 8, paddingVertical: 4, paddingHorizontal: 8 },
  removeText: { color: "#c0392b", fontSize: 14 },
  disabled: { opacity: 0.5 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "white", fontSize: 18 },
  small: { fontSize: 13, color: "#666", marginTop: 10, lineHeight: 18 },
  secondary: {
    backgroundColor: "#dbe7ff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryText: { color: "#2a6fdb", fontSize: 16 },
});
