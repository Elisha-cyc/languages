import { useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { API_URL, USER_ID } from "../config";

const TESTS = [
  {
    type: "meaning",
    title: "What does it mean?",
    question: "What does this character mean?",
  },
  {
    type: "pinyin",
    title: "What is the pinyin?",
    question: "Which pinyin is this character?",
  },
  {
    type: "strokes",
    title: "How many strokes?",
    question: "How many strokes does it have?",
  },
];

export default function HanziTestScreen({ navigation }) {
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function start(item) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/hanzi/test?user=${USER_ID}&type=${item.type}&count=10`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the test");
      setTest(item);
      setQuestions(data);
      setIndex(0);
      setAnswers([]);
      setResult(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function startWriting() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/hanzi/practice?user=${USER_ID}&count=5`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start");
      navigation.navigate("HanziWrite", {
        chars: data,
        blind: true,
        title: "Write from memory",
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function answer(option) {
    const next = [...answers, { char: questions[index].char, answer: option }];
    setAnswers(next);

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/hanzi/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          type: test.type,
          answers: next,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not grade the test");
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Results
  if (result) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          {result.score} of {result.total} correct
        </Text>
        {result.results.map((r) => (
          <View
            key={r.char}
            style={[styles.row, r.correct ? styles.good : styles.bad]}
          >
            <Text style={styles.rowChar}>{r.char}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowMain}>
                {r.pinyin} · {r.meaning}
              </Text>
              {!r.correct && (
                <Text style={styles.rowSub}>
                  You chose {r.answer}. Correct: {r.expected}
                </Text>
              )}
            </View>
          </View>
        ))}
        <Pressable style={styles.button} onPress={() => setTest(null)}>
          <Text style={styles.buttonText}>Another test</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={() => navigation.popToTop()}
        >
          <Text style={styles.secondaryText}>Back to the start</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // A question
  if (test && questions.length > 0) {
    const q = questions[index];
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.counter}>
          Question {index + 1} of {questions.length}
        </Text>
        <Text style={styles.question}>{test.question}</Text>
        <Text style={styles.big}>{q.char}</Text>
        {q.options.map((option) => (
          <Pressable
            key={option}
            style={[styles.option, busy && styles.disabled]}
            disabled={busy}
            onPress={() => answer(option)}
          >
            <Text style={styles.optionText}>{option}</Text>
          </Pressable>
        ))}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    );
  }

  // The menu
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Test yourself</Text>
      <Text style={styles.note}>
        Tests use the characters you have learned. Learn at least 4 first.
      </Text>

      {TESTS.map((item) => (
        <Pressable
          key={item.type}
          style={[styles.button, busy && styles.disabled]}
          disabled={busy}
          onPress={() => start(item)}
        >
          <Text style={styles.buttonText}>{item.title}</Text>
        </Pressable>
      ))}
      <Pressable
        style={[styles.button, styles.writeButton, busy && styles.disabled]}
        disabled={busy}
        onPress={startWriting}
      >
        <Text style={styles.buttonText}>Write from memory</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "bold" },
  note: { fontSize: 15, color: "#555", marginTop: 8, marginBottom: 8 },
  counter: { fontSize: 15, color: "#666", textAlign: "center" },
  question: { fontSize: 17, textAlign: "center", marginTop: 8 },
  big: { fontSize: 100, textAlign: "center", marginVertical: 12 },
  option: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  optionText: { fontSize: 18, textAlign: "center" },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  writeButton: { backgroundColor: "#4a4fdb" },
  buttonText: { color: "white", fontSize: 17 },
  secondary: {
    backgroundColor: "#dbe7ff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: { color: "#2a6fdb", fontSize: 16 },
  disabled: { opacity: 0.5 },
  error: { marginTop: 14, color: "#c0392b", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  good: { backgroundColor: "#eef6ee", borderColor: "#b9dbb9" },
  bad: { backgroundColor: "#fdeeee", borderColor: "#f0b9b9" },
  rowChar: { fontSize: 36, width: 56 },
  rowText: { flex: 1 },
  rowMain: { fontSize: 16 },
  rowSub: { fontSize: 14, color: "#a33", marginTop: 2 },
});
