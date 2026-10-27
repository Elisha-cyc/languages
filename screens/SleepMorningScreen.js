import { useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { API_URL, USER_ID } from "../config";

const percent = (score, total) =>
  total > 0 ? `${Math.round((100 * score) / total)}%` : "-";

// Shows the evening score and the change, when the evening quiz was taken
function overnight(group) {
  if (group.evening === null) return "";
  const diff = group.score - group.evening;
  return ` (evening ${group.evening}, change ${diff > 0 ? "+" : ""}${diff})`;
}

export default function SleepMorningScreen({ navigation, route }) {
  const { sessionId } = route.params;
  const { data: questions, error } = useFetch(
    `/sleep/sessions/${sessionId}/test?user=${USER_ID}`,
  );

  const [step, setStep] = useState("quiz"); // quiz, about
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [quality, setQuality] = useState(null);
  const [woke, setWoke] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_URL}/sleep/sessions/${sessionId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          answers,
          sleep_quality: quality,
          cues_woke_me: woke,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not grade the test");
      setResult(body);
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Results come first: after submitting, reloading the questions would answer "already taken"
  if (result) {
    const wrong = result.results.filter((r) => !r.correct);

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your results</Text>
        <View style={styles.card}>
          <Text style={styles.line}>
            Replayed words: {result.cued.score} of {result.cued.total} (
            {percent(result.cued.score, result.cued.total)})
            {overnight(result.cued)}
          </Text>
          <Text style={styles.line}>
            Words not replayed: {result.uncued.score} of {result.uncued.total} (
            {percent(result.uncued.score, result.uncued.total)})
            {overnight(result.uncued)}
          </Text>
        </View>
        <Text style={styles.note}>
          With about {result.cued.total} words in each group, a difference of
          one or two words is normal variation and proves nothing.
          Multiple-choice guessing adds noise too. Try several nights and watch
          the trend on the Sleep mode screen. If the sounds woke you, lower the
          volume or stop, because good sleep matters more than any app.
        </Text>

        {wrong.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review these:</Text>
            {wrong.map((r) => (
              <Text key={r.wordId} style={styles.item}>
                {r.word} = {r.correctAnswer}
              </Text>
            ))}
          </View>
        )}

        <Pressable style={styles.button} onPress={() => navigation.popToTop()}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (error) return <Message text={error} />;
  if (!questions) return <Message text="Loading..." />;
  if (!Array.isArray(questions))
    return <Message text={questions.error || "Could not load the test."} />;
  if (questions.length === 0)
    return <Message text="This session has no test." />;

  if (step === "about") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Two quick questions</Text>

        <Text style={styles.label}>How did you sleep?</Text>
        <View style={styles.chips}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, quality === value && styles.chipOn]}
              onPress={() => setQuality(value)}
            >
              <Text
                style={[
                  styles.chipText,
                  quality === value && styles.chipTextOn,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.small}>1 is badly, 5 is very well.</Text>

        <Text style={styles.label}>Did the sounds wake you up?</Text>
        <View style={styles.chips}>
          {[
            { label: "No", value: false },
            { label: "Yes", value: true },
          ].map((choice) => (
            <Pressable
              key={choice.label}
              style={[styles.chip, woke === choice.value && styles.chipOn]}
              onPress={() => setWoke(choice.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  woke === choice.value && styles.chipTextOn,
                ]}
              >
                {choice.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[
            styles.button,
            (quality === null || woke === null || submitting) &&
              styles.disabled,
          ]}
          disabled={quality === null || woke === null || submitting}
          onPress={submit}
        >
          <Text style={styles.buttonText}>
            {submitting ? "Checking..." : "See my results"}
          </Text>
        </Pressable>
        {submitError && <Text style={styles.error}>{submitError}</Text>}
      </ScrollView>
    );
  }

  const question = questions[index];

  function pick(option) {
    setAnswers([...answers, { wordId: question.wordId, answer: option }]);
    if (index < questions.length - 1) setIndex(index + 1);
    else setStep("about");
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
          style={styles.option}
          onPress={() => pick(option)}
        >
          <Text style={styles.optionText}>{option}</Text>
        </Pressable>
      ))}
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
  counter: { fontSize: 16, color: "#666", marginBottom: 16 },
  prompt: { fontSize: 36, fontWeight: "bold", textAlign: "center" },
  pron: { fontSize: 18, color: "#666", marginTop: 4 },
  note: { fontSize: 15, color: "#555", marginVertical: 12, lineHeight: 22 },
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
  label: { fontSize: 16, fontWeight: "bold", marginTop: 20, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#d5d9e0",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: "#2a6fdb", borderColor: "#2a6fdb" },
  chipText: { fontSize: 16, color: "#333" },
  chipTextOn: { color: "white" },
  small: { fontSize: 13, color: "#666", marginTop: 4 },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  cardTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 6 },
  line: { fontSize: 17, marginTop: 4 },
  item: { fontSize: 16, marginTop: 4 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: "white", fontSize: 18 },
  disabled: { opacity: 0.5 },
  error: { marginTop: 12, color: "#c0392b", textAlign: "center" },
});
