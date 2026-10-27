import { useState, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { API_URL, USER_ID } from "../config";
import { speak, stopSpeaking } from "../speech";
import HanziWriter from "../components/HanziWriter";

export default function HanziLessonScreen({ navigation, route }) {
  const { lessonId } = route.params;
  const { data, error } = useFetch(`/hanzi/lessons/${lessonId}`);
  const [index, setIndex] = useState(0);

  useEffect(() => stopSpeaking, []);

  if (error) return <Message text={error} />;
  if (!data) return <Message text="Loading..." />;
  if (!Array.isArray(data.chars))
    return <Message text={data.error || "Could not load this lesson."} />;

  const item = data.chars[index];
  const isLast = index === data.chars.length - 1;

  async function finish() {
    stopSpeaking();
    try {
      await fetch(`${API_URL}/hanzi/learned`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          chars: data.chars.map((c) => c.char),
        }),
      });
    } catch (e) {
      // progress is saved again next time
    }
    navigation.replace("HanziWrite", {
      title: data.title,
      blind: false,
      chars: data.chars.map(({ char, pinyin, meaning }) => ({
        char,
        pinyin,
        meaning,
      })),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.counter}>
        {data.title}: {index + 1} of {data.chars.length}
      </Text>

      <View style={styles.card}>
        <Text style={styles.big}>{item.char}</Text>
        <Text style={styles.pinyin}>{item.pinyin}</Text>
        <Text style={styles.meaning}>{item.meaning}</Text>
        <Text style={styles.small}>
          {item.strokes} stroke{item.strokes === 1 ? "" : "s"}
          {item.parts ? `  ·  ${item.parts}` : ""}
        </Text>
        <Text style={styles.tip}>{item.tip}</Text>

        <Pressable
          style={styles.listen}
          onPress={() => speak(item.char, "Mandarin Chinese")}
        >
          <Text style={styles.listenText}>🔊 Listen</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Watch how to write it</Text>
      <HanziWriter key={item.char} char={item.char} mode="animate" size={240} />

      <Text style={styles.heading}>Words with {item.char}</Text>
      {item.words.map((word) => (
        <Pressable
          key={word.zh}
          style={styles.word}
          onPress={() => speak(word.zh, "Mandarin Chinese")}
        >
          <Text style={styles.wordZh}>{word.zh}</Text>
          <Text style={styles.wordSub}>
            {word.pinyin} · {word.en} 🔊
          </Text>
        </Pressable>
      ))}

      <View style={styles.nav}>
        <Pressable
          style={[styles.navButton, index === 0 && styles.disabled]}
          disabled={index === 0}
          onPress={() => setIndex(index - 1)}
        >
          <Text style={styles.navText}>Previous</Text>
        </Pressable>
        <Pressable
          style={styles.next}
          onPress={() => {
            stopSpeaking();
            isLast ? finish() : setIndex(index + 1);
          }}
        >
          <Text style={styles.nextText}>
            {isLast ? "Practice writing" : "Next"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  counter: { fontSize: 15, color: "#666", textAlign: "center" },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 20,
    marginTop: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  big: { fontSize: 88 },
  pinyin: { fontSize: 24, color: "#2a6fdb" },
  meaning: { fontSize: 20, marginTop: 4 },
  small: { fontSize: 14, color: "#666", marginTop: 8 },
  tip: {
    fontSize: 15,
    color: "#555",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 22,
  },
  listen: {
    marginTop: 12,
    backgroundColor: "#dbe7ff",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  listenText: { color: "#2a6fdb", fontSize: 16 },
  heading: {
    fontSize: 17,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 4,
    textAlign: "center",
  },
  word: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  wordZh: { fontSize: 22 },
  wordSub: { fontSize: 14, color: "#666", marginTop: 2 },
  nav: { flexDirection: "row", marginTop: 20 },
  navButton: {
    flex: 1,
    backgroundColor: "#dbe7ff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
  },
  navText: { color: "#2a6fdb", fontSize: 16 },
  next: {
    flex: 2,
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  nextText: { color: "white", fontSize: 17 },
  disabled: { opacity: 0.5 },
});
