import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { API_URL } from "../config";
import LanguagePicker, { NATIVE_OPTIONS } from "../components/LanguagePicker";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export default function PlacementScreen({ navigation }) {
  const [language, setLanguage] = useState("French");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function start() {
    setLoading(true);
    setError("");
    setQuestions([]);
    setAnswers({});
    setIndex(0);
    setFinished(false);
    setSaving(false);
    setSaveError("");
    try {
      const response = await fetch(
        API_URL + "/placement/questions?language=" + encodeURIComponent(language),
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start the assessment.");
      if (!Array.isArray(data.questions) || data.questions.length < 6) {
        throw new Error("There are not enough questions for this language yet.");
      }
      setQuestions(data.questions);
    } catch (e) {
      setError(e.message || "Could not start the assessment.");
    } finally {
      setLoading(false);
    }
  }

  const question = questions[index];
  const selected = question ? answers[question.id] : undefined;

  function choose(optionIndex) {
    if (!question || selected !== undefined) return;
    setAnswers((old) => ({ ...old, [question.id]: optionIndex }));
  }

  async function next() {
    if (index + 1 < questions.length) {
      setIndex((value) => value + 1);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(API_URL + "/placement/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, level: recommended }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your recommended course.");
      setFinished(true);
    } catch (e) {
      setSaveError(e.message || "Could not save your recommended course.");
    } finally {
      setSaving(false);
    }
  }

  const results = LEVELS.map((level) => {
    const group = questions.filter((item) => item.level === level);
    const correct = group.filter((item) => answers[item.id] === item.answerIndex).length;
    return { level, total: group.length, correct, ratio: group.length ? correct / group.length : 0 };
  });
  let recommended = "Beginner";
  for (const result of results) {
    if (result.total >= 3 && result.ratio >= 0.7) recommended = result.level;
    else break;
  }
  const answered = Object.keys(answers).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!questions.length ? (
        <View style={styles.card}>
          <Text style={styles.title}>Find your starting level</Text>
          <Text style={styles.copy}>
            Answer a short vocabulary check across beginner, intermediate and advanced material.
            LinguaApp will recommend a sensible place to start.
          </Text>
          <Text style={styles.label}>Language you want to learn</Text>
          <LanguagePicker
            value={language}
            onChange={setLanguage}
            options={NATIVE_OPTIONS.filter((item) => item !== "English")}
            title="Target language"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <Pressable style={styles.primary} disabled={loading} onPress={start}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Start assessment</Text>}
          </Pressable>
        </View>
      ) : finished ? (
        <View style={styles.card}>
          <Text style={styles.title}>Your placement result</Text>
          <Text style={styles.level}>{recommended}</Text>
          <Text style={styles.copy}>
            Based on your answers, we recommend starting at {recommended}. Your course enrollment has been saved. This is a short
            vocabulary diagnostic, not an official CEFR or HSK examination.
          </Text>
          {results.map((result) => (
            <View key={result.level} style={styles.resultRow}>
              <Text style={styles.resultName}>{result.level}</Text>
              <Text style={styles.resultScore}>
                {result.total ? result.correct + " / " + result.total : "Not enough questions"}
              </Text>
            </View>
          ))}
          <Pressable
            style={styles.primary}
            onPress={() => navigation.navigate("Units", { language, level: recommended })}
          >
            <Text style={styles.primaryText}>Start learning at {recommended}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={start}>
            <Text style={styles.secondaryText}>Take the assessment again</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.progressRow}>
            <Text style={styles.label}>{question.level}</Text>
            <Text style={styles.label}>{index + 1} of {questions.length}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: ((index + 1) / questions.length * 100) + "%" }]} />
          </View>
          <Text style={styles.prompt}>What does this mean?</Text>
          <Text style={styles.word}>{question.prompt}</Text>
          {question.pronunciation ? <Text style={styles.pronunciation}>{question.pronunciation}</Text> : null}
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isCorrect = question.answerIndex === optionIndex;
            return (
              <Pressable
                key={optionIndex}
                onPress={() => choose(optionIndex)}
                style={[
                  styles.option,
                  isSelected && styles.selected,
                  selected !== undefined && isCorrect && styles.correct,
                  selected !== undefined && isSelected && !isCorrect && styles.incorrect,
                ]}
              >
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            );
          })}
          {selected !== undefined ? (
            <Pressable style={styles.primary} disabled={saving} onPress={next}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{index + 1 === questions.length ? "Save my result" : "Next question"}</Text>}
            </Pressable>
          ) : null}
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <Text style={styles.small}>{answered} answered</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, backgroundColor: "#f2f4f8" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#dce2ea" },
  title: { fontSize: 25, fontWeight: "700", color: "#172033", marginBottom: 10 },
  copy: { fontSize: 15, lineHeight: 23, color: "#5d6675", marginBottom: 18 },
  label: { fontSize: 14, color: "#667085", fontWeight: "600" },
  error: { color: "#b42318", marginTop: 12 },
  primary: { backgroundColor: "#2a6fdb", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 18 },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { padding: 14, alignItems: "center", marginTop: 8 },
  secondaryText: { color: "#2a6fdb", fontWeight: "600" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  track: { height: 7, backgroundColor: "#e5eaf2", borderRadius: 8, overflow: "hidden", marginBottom: 24 },
  fill: { height: 7, backgroundColor: "#2a6fdb", borderRadius: 8 },
  prompt: { fontSize: 15, color: "#667085", marginBottom: 8 },
  word: { fontSize: 28, fontWeight: "700", color: "#172033", marginBottom: 6 },
  pronunciation: { fontSize: 16, color: "#2a6fdb", marginBottom: 18 },
  option: { borderWidth: 1, borderColor: "#d5dce6", borderRadius: 10, padding: 14, marginBottom: 10 },
  selected: { borderColor: "#2a6fdb", backgroundColor: "#eef4ff" },
  correct: { borderColor: "#238636", backgroundColor: "#edf7ef" },
  incorrect: { borderColor: "#b42318", backgroundColor: "#fff0ef" },
  optionText: { fontSize: 16, color: "#243044" },
  resultRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#edf0f4" },
  resultName: { fontSize: 15, color: "#344054", fontWeight: "600" },
  resultScore: { fontSize: 15, color: "#667085" },
  level: { fontSize: 32, fontWeight: "800", color: "#2a6fdb", marginVertical: 8 },
  small: { color: "#667085", fontSize: 12, marginTop: 14, textAlign: "right" },
});
