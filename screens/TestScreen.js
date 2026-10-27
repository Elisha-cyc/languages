import { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { setTestResult } from "../testResult";

export default function TestScreen({ navigation, route }) {
  const {
    testId,
    title = "Test",
    intro,
    questions,
    passPercent = 70,
    compulsory = true,
  } = route.params;

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const passed = useRef(false);

  const total = questions.length;
  const percent = Math.round((100 * correct) / total);
  const ok = percent >= passPercent;
  const q = questions[index];

  useEffect(() => {
    navigation.setOptions({
      title,
      headerBackVisible: !compulsory,
      gestureEnabled: !compulsory,
    });
  }, []);

  // A compulsory test cannot be left until it is passed
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!compulsory || passed.current) return;
        e.preventDefault();
      }),
    [navigation, compulsory],
  );

  function pick(i) {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answer) setCorrect((c) => c + 1);
  }

  function next() {
    if (index + 1 < total) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    passed.current = ok;
    setTestResult({ id: testId, passed: ok, percent });
    setDone(true);
  }

  function retry() {
    setIndex(0);
    setPicked(null);
    setCorrect(0);
    setDone(false);
  }

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{ok ? "You passed!" : "Not yet"}</Text>
        <Text style={styles.score}>
          {correct} of {total} correct ({percent}%)
        </Text>
        <Text style={styles.note}>
          {ok
            ? "Well done. You can continue."
            : `You need ${passPercent}% to pass. Review and try again.`}
        </Text>
        {ok ? (
          <Pressable style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
            {!compulsory && (
              <Pressable
                style={styles.secondary}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.secondaryText}>Leave</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {index === 0 && intro && <Text style={styles.note}>{intro}</Text>}
      <Text style={styles.counter}>
        Question {index + 1} of {total}
      </Text>
      <Text style={styles.question}>{q.question}</Text>

      {q.options.map((option, i) => {
        const show = picked !== null;
        const style = [
          styles.option,
          show && i === q.answer && styles.right,
          show && i === picked && i !== q.answer && styles.wrong,
        ];
        return (
          <Pressable key={i} style={style} onPress={() => pick(i)}>
            <Text style={styles.optionText}>{option}</Text>
          </Pressable>
        );
      })}

      {picked !== null && (
        <>
          {q.explanation ? (
            <Text style={styles.explanation}>{q.explanation}</Text>
          ) : null}
          <Pressable style={styles.button} onPress={next}>
            <Text style={styles.buttonText}>
              {index + 1 < total ? "Next" : "Finish"}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 24,
  },
  score: { fontSize: 20, textAlign: "center", marginTop: 12 },
  note: {
    fontSize: 15,
    color: "#555",
    marginVertical: 12,
    lineHeight: 22,
    textAlign: "center",
  },
  counter: { fontSize: 14, color: "#666", marginBottom: 8 },
  question: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    lineHeight: 30,
  },
  option: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#d5d9e0",
  },
  optionText: { fontSize: 18 },
  right: { borderColor: "#3c9d5d", backgroundColor: "#eef6ee" },
  wrong: { borderColor: "#d9534f", backgroundColor: "#fdeeee" },
  explanation: { fontSize: 15, color: "#444", marginTop: 4, lineHeight: 22 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "white", fontSize: 18 },
  secondary: {
    backgroundColor: "#dbe7ff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: { color: "#2a6fdb", fontSize: 16 },
});
