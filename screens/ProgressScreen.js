import { useEffect, useState } from "react";
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
const SKILLS = ["listening", "reading", "speaking", "writing", "review"];

export default function ProgressScreen() {
  const [language, setLanguage] = useState("French");
  const [level, setLevel] = useState("Beginner");
  const [progress, setProgress] = useState(null);
  const [outline, setOutline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const query = "?language=" + encodeURIComponent(language) + "&level=" + encodeURIComponent(level);
    Promise.all([
      fetch(API_URL + "/course/progress" + query).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load progress.");
        return data;
      }),
      fetch(API_URL + "/course/outline" + query).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load the course outline.");
        return data;
      }),
    ])
      .then(([saved, units]) => {
        if (active) {
          setProgress(saved);
          setOutline(Array.isArray(units) ? units : []);
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Could not load your progress.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [language, level]);

  const totalLessons = outline.reduce((sum, unit) => sum + (unit.lessons || []).length, 0);
  const completed = progress?.completedLessons || 0;
  const percent = totalLessons ? Math.min(100, Math.round(completed * 100 / totalLessons)) : 0;
  const skills = new Map((progress?.skills || []).map((item) => [item.skill, item]));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Your learning progress</Text>
        <Text style={styles.muted}>Choose a language and level to see your course activity.</Text>
        <LanguagePicker
          value={language}
          onChange={setLanguage}
          options={NATIVE_OPTIONS.filter((item) => item !== "English")}
          title="Target language"
        />
        <View style={styles.levels}>
          {LEVELS.map((item) => (
            <Pressable key={item} onPress={() => setLevel(item)} style={[styles.levelButton, level === item && styles.levelActive]}>
              <Text style={[styles.levelText, level === item && styles.levelTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2a6fdb" style={{ marginTop: 28 }} />
      ) : error ? (
        <View style={styles.card}><Text style={styles.error}>{error}</Text></View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{language} · {level}</Text>
            <View style={styles.summary}>
              <Text style={styles.big}>{percent}%</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.metric}>{completed} lessons completed</Text>
                <Text style={styles.muted}>out of {totalLessons} in this course level</Text>
              </View>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: percent + "%" }]} /></View>
            <Text style={styles.muted}>{progress?.enrollment ? "You are enrolled in this course." : "Start a guided lesson to begin tracking your course activity."}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Skill development</Text>
            {SKILLS.map((skill) => {
              const item = skills.get(skill);
              const score = item?.best_score || 0;
              return (
                <View key={skill} style={styles.skillRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.skillName}>{skill.charAt(0).toUpperCase() + skill.slice(1)}</Text>
                    <View style={styles.trackSmall}><View style={[styles.fill, { width: score + "%" }]} /></View>
                  </View>
                  <Text style={styles.skillScore}>{item ? score + "%" : "Not practised"}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vocabulary due for review</Text>
            <Text style={styles.dueCount}>{(progress?.dueVocabulary || []).length}</Text>
            <Text style={styles.muted}>words ready for spaced-repetition review</Text>
            {(progress?.dueVocabulary || []).slice(0, 8).map((item) => (
              <View key={item.term} style={styles.wordRow}>
                <Text style={styles.word}>{item.term}</Text>
                <Text style={styles.meaning}>{item.meaning}</Text>
              </View>
            ))}
            {!progress?.dueVocabulary?.length ? <Text style={styles.muted}>No reviews are due right now. Keep learning to build your review list.</Text> : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: "#f2f4f8", gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, borderWidth: 1, borderColor: "#dce2ea" },
  title: { fontSize: 24, fontWeight: "700", color: "#172033", marginBottom: 6 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#172033", marginBottom: 14 },
  muted: { color: "#667085", fontSize: 14, lineHeight: 21 },
  error: { color: "#b42318", fontSize: 14 },
  levels: { flexDirection: "row", gap: 8, marginTop: 14 },
  levelButton: { flex: 1, borderWidth: 1, borderColor: "#d5dce6", borderRadius: 9, paddingVertical: 10, alignItems: "center" },
  levelActive: { backgroundColor: "#eaf1ff", borderColor: "#2a6fdb" },
  levelText: { color: "#475467", fontSize: 13, fontWeight: "600" },
  levelTextActive: { color: "#2a6fdb" },
  summary: { flexDirection: "row", alignItems: "center", gap: 16 },
  big: { fontSize: 38, fontWeight: "800", color: "#2a6fdb" },
  metric: { fontSize: 16, fontWeight: "700", color: "#344054" },
  track: { height: 9, borderRadius: 9, backgroundColor: "#e7ebf2", overflow: "hidden", marginVertical: 14 },
  trackSmall: { height: 6, borderRadius: 6, backgroundColor: "#e7ebf2", overflow: "hidden", marginTop: 7 },
  fill: { height: "100%", backgroundColor: "#2a6fdb", borderRadius: 9 },
  skillRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  skillName: { color: "#344054", fontWeight: "600" },
  skillScore: { color: "#667085", fontSize: 13, minWidth: 90, textAlign: "right" },
  dueCount: { fontSize: 32, fontWeight: "800", color: "#2a6fdb" },
  wordRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#edf0f4" },
  word: { fontWeight: "700", color: "#172033", flex: 1 },
  meaning: { color: "#667085", flex: 1, textAlign: "right" },
});
