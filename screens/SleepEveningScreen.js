import { useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { API_URL, USER_ID } from "../config";

export default function SleepEveningScreen({ navigation, route }) {
  const { sessionId, language } = route.params;
  const { data: questions, error } = useFetch(
    `/sleep/sessions/${sessionId}/evening?user=${USER_ID}`,
  );

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  async function submit(allAnswers) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `${API_URL}/sleep/sessions/${sessionId}/evening`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: USER_ID, answers: allAnswers }),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save the quiz");
      setResult(body);
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Results come first: after submitting, reloading the questions would answer "already taken"
  if (result) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Evening score</Text>
        <Text style={styles.score}>
          {result.score} / {result.total}
        </Text>
        <Text style={styles.note}>
          This is your starting point, so a low score is fine. Tomorrow's test
          shows how much you kept overnight.
        </Text>

        {result.missed.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Read these once more:</Text>
            {result.missed.map((m) => (
              <Text key={m.wordId} style={styles.item}>
                {m.word} = {m.correctAnswer}
              </Text>
            ))}
          </View>
        )}

        <Pressable
          style={styles.button}
          onPress={() =>
            navigation.replace("SleepNight", { sessionId, language })
          }
        >
          <Text style={styles.buttonText}>Continue to tonight's session</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (error) return <Message text={error} />;
  if (!questions) return <Message text="Loading..." />;
  if (!Array.isArray(questions))
    return <Message text={questions.error || "Could not load the quiz."} />;
  if (questions.length === 0)
    return <Message text="This session has no quiz." />;

  const question = questions[index];

  function pick(option) {
    if (submitting) return;
    const next = [...answers, { wordId: question.wordId, answer: option }];
    setAnswers(next);
    if (index < questions.length - 1) setIndex(index + 1);
    else submit(next);
  }

  return (
    <ScrollView contentContainerStyle={styles.centered}>
      <Text style={styles.counter}>
        Question {index + 1} of {questions.length}
      </Text>
      <Text style={styles.prompt}>{question.prompt}</Text>
      {question.pronunciation && (
        <Text style={styles.pron}>{question.pronunciation}</Text>
      )}
      <Text style={styles.note}>What does it mean?</Text>

      {question.options.map((option) => (
        <Pressable
          key={option}
          style={[styles.option, submitting && styles.disabled]}
          disabled={submitting}
          onPress={() => pick(option)}
        >
          <Text style={styles.optionText}>{option}</Text>
        </Pressable>
      ))}

      {submitting && <Text style={styles.note}>Saving...</Text>}
      {submitError && <Text style={styles.error}>{submitError}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  centered: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f4f8",
    padding: 16,
  },
  title: { fontSize: 24, fontWeight: "bold" },
  score: { fontSize: 48, fontWeight: "bold", color: "#2a6fdb", marginTop: 8 },
  counter: { fontSize: 16, color: "#666", marginBottom: 16 },
  prompt: { fontSize: 36, fontWeight: "bold", textAlign: "center" },
  pron: { fontSize: 18, color: "#666", marginTop: 4 },
  note: {
    fontSize: 15,
    color: "#555",
    marginVertical: 12,
    lineHeight: 22,
    textAlign: "center",
  },
  option: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#d5d9e0",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 10,
    minWidth: 280,
    alignItems: "center",
  },
  optionText: { fontSize: 18 },
  disabled: { opacity: 0.5 },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  cardTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 6 },
  item: { fontSize: 16, marginTop: 4 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: "white", fontSize: 18 },
  error: { marginTop: 12, color: "#c0392b", textAlign: "center" },
});
