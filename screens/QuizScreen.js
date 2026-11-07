import { useState } from "react";
import { ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { API_URL } from "../config";
import { speak } from "../speech";

export default function QuizScreen({ navigation, route }) {
  const { lessonId } = route.params || {};
  const { data: questions, error } = useFetch(`/lessons/${lessonId}/quiz`);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState(null);
  const [visiblePrompts, setVisiblePrompts] = useState({});
  const { language } = route.params || {};
  const audioFirst = /chinese/i.test(String(language || ""));

  if (error) return <Message text={error} />;
  if (!questions) return <Message text="Loading your review…" />;
  if (!Array.isArray(questions)) return <Message text={questions.error || "Could not load this review."} />;
  if (!questions.length) return <Message text="This lesson needs more vocabulary before it can make a quiz." />;

  const allAnswered = questions.every((question) => answers[question.wordId] !== undefined);

  async function submit() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setProblem(null);
    try {
      const response = await fetch(`${API_URL}/lessons/${lessonId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((question) => ({
            wordId: question.wordId,
            answer: answers[question.wordId],
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check your answers.");
      setResult(data);
    } catch (err) {
      setProblem(err.message || "Could not reach the course server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>{result ? "Lesson review" : "Check what you learned"}</Text>
      <Text style={styles.subtitle}>
        {result
          ? `${result.score} of ${result.total} correct · ${result.passed ? "Lesson complete" : "Review the answers and try again"}`
          : `Choose the meaning for each Chinese word or sentence. Answer all ${questions.length} questions.`}
      </Text>

      {questions.map((question, index) => {
        const checked = result?.results?.find((item) => item.wordId === question.wordId);
        return (
          <View key={question.wordId} style={styles.questionCard}>
            <Text style={styles.number}>Question {index + 1}</Text>
            {audioFirst && !visiblePrompts[question.wordId] && !result ? (
              <View style={styles.audioFirst}>
                <Text style={styles.audioHint}>Listen and choose the meaning</Text>
                <Pressable style={styles.listen} onPress={() => speak(question.prompt, language)}>
                  <Text style={styles.listenText}>🔊 Play Chinese audio</Text>
                </Pressable>
                <Pressable onPress={() => setVisiblePrompts((current) => ({ ...current, [question.wordId]: true }))}>
                  <Text style={styles.revealText}>Show the Chinese text</Text>
                </Pressable>
              </View>
            ) : <Text style={styles.prompt}>{question.prompt}</Text>}
            {question.pronunciation && (!audioFirst || visiblePrompts[question.wordId] || result) ? <Text style={styles.pinyin}>{question.pronunciation}</Text> : null}
            {question.options.map((option) => {
              const selected = answers[question.wordId] === option;
              const correct = checked && option === checked.correctAnswer;
              const wrong = checked && selected && !checked.correct;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: Boolean(result) }}
                  disabled={Boolean(result)}
                  onPress={() => setAnswers((current) => ({ ...current, [question.wordId]: option }))}
                  style={[styles.option, selected && styles.selected, correct && styles.correct, wrong && styles.incorrect]}
                >
                  <Text style={[styles.optionText, (selected || correct) && styles.selectedText]}>{option}</Text>
                </Pressable>
              );
            })}
            {checked && !checked.correct ? <Text style={styles.answer}>Answer: {checked.correctAnswer}</Text> : null}
          </View>
        );
      })}

      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      {result ? (
        <Pressable style={styles.submit} onPress={() => navigation.goBack()}>
          <Text style={styles.submitText}>{result.passed ? "Continue learning" : "Back to lesson"}</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={!allAnswered || submitting}
          style={[styles.submit, (!allAnswered || submitting) && styles.disabled]}
          onPress={submit}
        >
          <Text style={styles.submitText}>{submitting ? "Checking…" : "Check answers"}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 18, backgroundColor: "#f2f4f8", alignItems: "center" },
  title: { fontSize: 26, fontWeight: "800", color: "#172b4d", textAlign: "center", marginTop: 8 },
  subtitle: { maxWidth: 520, color: "#58677d", fontSize: 15, lineHeight: 22, textAlign: "center", marginVertical: 12 },
  questionCard: { width: "100%", maxWidth: 520, backgroundColor: "white", padding: 16, borderRadius: 16, marginVertical: 7, elevation: 2 },
  number: { color: "#65758b", fontSize: 13, fontWeight: "700", marginBottom: 7 },
  prompt: { color: "#172b4d", fontSize: 24, fontWeight: "700", textAlign: "center" },
  pinyin: { color: "#66758a", fontSize: 15, textAlign: "center", marginBottom: 6 },
  audioFirst: { alignItems: "center", paddingVertical: 8 },
  audioHint: { color: "#58677d", fontSize: 15, marginBottom: 8 },
  listen: { backgroundColor: "#e9f0ff", borderRadius: 22, paddingVertical: 11, paddingHorizontal: 18, marginBottom: 5 },
  listenText: { color: "#2a6fdb", fontSize: 16, fontWeight: "700" },
  revealText: { color: "#2a6fdb", fontSize: 14, padding: 9 },
  option: { minHeight: 46, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10, marginTop: 8, borderWidth: 1, borderColor: "#d9e0ea", borderRadius: 11 },
  selected: { backgroundColor: "#e9f0ff", borderColor: "#3675dd" },
  correct: { backgroundColor: "#e7f7ec", borderColor: "#299450" },
  incorrect: { backgroundColor: "#fff0ed", borderColor: "#ce5747" },
  optionText: { color: "#26364d", fontSize: 16, lineHeight: 22 },
  selectedText: { fontWeight: "700" },
  answer: { color: "#9b4539", marginTop: 10, fontSize: 14 },
  problem: { color: "#b34235", margin: 10, textAlign: "center" },
  submit: { backgroundColor: "#2a6fdb", minWidth: 220, alignItems: "center", padding: 15, borderRadius: 13, marginVertical: 18 },
  submitText: { color: "white", fontSize: 17, fontWeight: "700" },
  disabled: { opacity: 0.45 },
});
