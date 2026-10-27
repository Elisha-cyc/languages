import { useState, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { API_URL, USER_ID } from "../config";
import HanziWriter from "../components/HanziWriter";

export default function HanziWriteScreen({ navigation, route }) {
  const { chars, blind, title } = route.params;
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState({}); // char -> mistakes

  const handleResult = useCallback((message) => {
    if (!message || message.type !== "complete") return;
    const mistakes = Number(message.mistakes) || 0;
    setResults((current) => ({ ...current, [message.char]: mistakes }));
    fetch(`${API_URL}/hanzi/written`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID, char: message.char, mistakes }),
    }).catch(() => {});
  }, []);

  if (index >= chars.length) {
    const perfect = Object.values(results).filter((m) => m === 0).length;
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Finished</Text>
        <Text style={styles.big}>
          {perfect} of {chars.length} written perfectly
        </Text>
        {chars.map((item) => (
          <Text key={item.char} style={styles.row}>
            {item.char} {item.pinyin}:{" "}
            {results[item.char] === undefined
              ? "skipped"
              : results[item.char] === 0
                ? "perfect"
                : `${results[item.char]} mistake(s)`}
          </Text>
        ))}
        <Pressable style={styles.button} onPress={() => navigation.popToTop()}>
          <Text style={styles.buttonText}>Back to the start</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={() => navigation.navigate("HanziTest")}
        >
          <Text style={styles.secondaryText}>Take a test</Text>
        </Pressable>
      </View>
    );
  }

  const item = chars[index];
  const done = results[item.char] !== undefined;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.counter}>
        {title || (blind ? "Write from memory" : "Practice writing")}:{" "}
        {index + 1} of {chars.length}
      </Text>

      {blind ? (
        <View style={styles.prompt}>
          <Text style={styles.promptLabel}>Write the character for</Text>
          <Text style={styles.promptMain}>{item.meaning}</Text>
          <Text style={styles.promptSub}>{item.pinyin}</Text>
        </View>
      ) : (
        <View style={styles.prompt}>
          <Text style={styles.promptLabel}>Trace and write</Text>
          <Text style={styles.promptMain}>
            {item.char} {item.pinyin}
          </Text>
          <Text style={styles.promptSub}>{item.meaning}</Text>
        </View>
      )}

      <HanziWriter
        key={item.char}
        char={item.char}
        mode="quiz"
        blind={blind}
        size={260}
        onResult={handleResult}
      />

      <Pressable style={styles.button} onPress={() => setIndex(index + 1)}>
        <Text style={styles.buttonText}>{done ? "Next" : "Skip"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f2f4f8",
    flexGrow: 1,
    alignItems: "center",
  },
  center: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#f2f4f8",
    alignItems: "center",
    justifyContent: "center",
  },
  counter: { fontSize: 15, color: "#666" },
  prompt: { alignItems: "center", marginTop: 10 },
  promptLabel: { fontSize: 14, color: "#666" },
  promptMain: { fontSize: 26, fontWeight: "bold", marginTop: 2 },
  promptSub: { fontSize: 18, color: "#2a6fdb", marginTop: 2 },
  title: { fontSize: 24, fontWeight: "bold" },
  big: { fontSize: 18, marginTop: 8, marginBottom: 12 },
  row: { fontSize: 18, marginTop: 4 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginTop: 16,
  },
  buttonText: { color: "white", fontSize: 17 },
  secondary: {
    backgroundColor: "#dbe7ff",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginTop: 10,
  },
  secondaryText: { color: "#2a6fdb", fontSize: 16 },
});
