import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";

const pathways = [
  {
    title: "1. Pronunciation and tones",
    detail: "Master Pinyin initials, finals, the four tones, tone changes and clear pronunciation.",
    action: "PinyinTeacher",
    button: "Train pronunciation",
    icon: "🎧",
  },
  {
    title: "2. Structured Chinese course",
    detail: "Follow the level-by-level Mandarin curriculum, learn vocabulary and grammar, then complete lessons and quizzes.",
    action: "Languages",
    button: "Open the course",
    icon: "📚",
  },
  {
    title: "3. Characters and handwriting",
    detail: "Learn radicals, character components, stroke order, recognition, handwriting and recall.",
    action: "HanziHome",
    button: "Learn characters",
    icon: "汉",
  },
  {
    title: "4. Listening and speaking",
    detail: "Listen to model speech, repeat aloud, record your voice and practise useful spoken sentences.",
    action: "Teacher",
    button: "Speak with the teacher",
    icon: "🗣️",
  },
  {
    title: "5. Real conversations with AI",
    detail: "Practise conversations, answer follow-up questions, ask for corrections and retry improved sentences.",
    action: "ChatTab",
    button: "Start AI conversation",
    icon: "💬",
  },
  {
    title: "6. Reading and real-world Chinese",
    detail: "Build reading stamina with graded material and use the reading tools to study unfamiliar text.",
    action: "Books",
    button: "Explore reading",
    icon: "📖",
  },
  {
    title: "7. Writing and comprehension",
    detail: "Bring text or a page into the study tools, analyse it, learn from it and practise producing your own Chinese.",
    action: "Import",
    button: "Study a document",
    icon: "✍️",
  },
];

const milestones = [
  ["Beginner", "Pinyin, tones, survival phrases, basic sentence patterns, first characters and everyday listening."],
  ["Elementary", "Build reliable everyday communication, core grammar, reading fluency and a growing character base."],
  ["Intermediate", "Discuss familiar and unfamiliar topics, understand connected speech, read longer texts and write paragraphs."],
  ["Upper-intermediate", "Explain opinions, narrate experiences, follow authentic material and use more complex grammar."],
  ["Advanced", "Handle academic, professional and cultural topics, understand nuance, and write structured extended texts."],
  ["Mastery", "Develop flexible, natural communication across registers, accents, genres and demanding real-world situations."],
];

function ActionCard({ item, onPress }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardIcon}>{item.icon}</Text>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDetail}>{item.detail}</Text>
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.cardButton}>
          <Text style={styles.cardButtonText}>{item.button}  →</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ChineseAcademyScreen({ navigation }) {
  const open = (route) => {
    if (route === "ChatTab") {
      navigation.navigate("Home", { screen: "ChatTab" });
      return;
    }
    navigation.navigate(route);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>YOUR PERSONAL MANDARIN SCHOOL</Text>
        <Text style={styles.heroTitle}>中文 Chinese Academy</Text>
        <Text style={styles.heroText}>
          One guided path from your first sounds to confident, independent Chinese.
          Learn a skill, practise it, get feedback, review it and use it in real communication.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Placement")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Check my starting level  →</Text>
        </Pressable>
        <Text style={styles.heroNote}>
          Starting from zero? Choose the beginner course after your placement check.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Your seven learning pathways</Text>
      <Text style={styles.sectionIntro}>
        All core skills work together. Do not skip listening and speaking while studying characters and grammar.
      </Text>
      {pathways.map((item) => (
        <ActionCard key={item.title} item={item} onPress={() => open(item.action)} />
      ))}

      <Text style={styles.sectionTitle}>The complete progression</Text>
      <Text style={styles.sectionIntro}>
        Progress is based on what you can actually understand and do, not just lessons opened or words seen.
      </Text>
      {milestones.map(([title, detail], index) => (
        <View key={title} style={styles.milestone}>
          <View style={styles.milestoneNumber}><Text style={styles.milestoneNumberText}>{index + 1}</Text></View>
          <View style={styles.milestoneBody}>
            <Text style={styles.milestoneTitle}>{title}</Text>
            <Text style={styles.milestoneDetail}>{detail}</Text>
          </View>
        </View>
      ))}

      <View style={styles.method}>
        <Text style={styles.methodTitle}>The daily learning cycle</Text>
        <Text style={styles.methodText}>1. Learn a small, connected lesson.</Text>
        <Text style={styles.methodText}>2. Listen to natural model audio and notice sounds and tones.</Text>
        <Text style={styles.methodText}>3. Speak or write from memory, without copying.</Text>
        <Text style={styles.methodText}>4. Get corrections and understand why they are needed.</Text>
        <Text style={styles.methodText}>5. Review older material with spaced repetition.</Text>
        <Text style={styles.methodText}>6. Use the new language in an AI conversation or reading task.</Text>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Progress")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>View learning progress  →</Text>
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>
        This academy is the learning home and connects to existing LinguaApp tools. Full HSK 3.0 syllabus coverage,
        advanced writing assessment and reliable pronunciation scoring still need to be completed and verified;
        this screen does not claim those capabilities are already finished.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40, backgroundColor: "#f4f6fb" },
  hero: { backgroundColor: "#142b4a", borderRadius: 22, padding: 22, marginBottom: 24 },
  eyebrow: { color: "#9dc5ff", fontSize: 11, fontWeight: "800", letterSpacing: 1.3, marginBottom: 10 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 10 },
  heroText: { color: "#e5edf8", fontSize: 15, lineHeight: 23 },
  primaryButton: { backgroundColor: "#f3c969", paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, alignSelf: "flex-start", marginTop: 18 },
  primaryButtonText: { color: "#142b4a", fontWeight: "800", fontSize: 14 },
  heroNote: { color: "#c7d5e7", fontSize: 12, marginTop: 12, lineHeight: 18 },
  sectionTitle: { color: "#172b46", fontSize: 21, fontWeight: "900", marginTop: 10, marginBottom: 6 },
  sectionIntro: { color: "#59677a", fontSize: 14, lineHeight: 21, marginBottom: 13 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: "row", borderWidth: 1, borderColor: "#e5eaf1" },
  cardIcon: { fontSize: 25, width: 42, paddingTop: 2 },
  cardBody: { flex: 1 },
  cardTitle: { color: "#172b46", fontSize: 16, fontWeight: "800", marginBottom: 5 },
  cardDetail: { color: "#59677a", fontSize: 13, lineHeight: 20 },
  cardButton: { alignSelf: "flex-start", marginTop: 11, backgroundColor: "#eaf1ff", borderRadius: 9, paddingVertical: 9, paddingHorizontal: 12 },
  cardButtonText: { color: "#2459a6", fontWeight: "800", fontSize: 13 },
  milestone: { flexDirection: "row", alignItems: "flex-start", marginBottom: 13, backgroundColor: "#fff", borderRadius: 13, padding: 13 },
  milestoneNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#eaf1ff", alignItems: "center", justifyContent: "center", marginRight: 11 },
  milestoneNumberText: { color: "#2459a6", fontWeight: "900" },
  milestoneBody: { flex: 1 },
  milestoneTitle: { color: "#172b46", fontWeight: "800", fontSize: 15, marginBottom: 3 },
  milestoneDetail: { color: "#59677a", fontSize: 13, lineHeight: 19 },
  method: { backgroundColor: "#fff", borderRadius: 16, padding: 17, marginTop: 12, borderWidth: 1, borderColor: "#e5eaf1" },
  methodTitle: { color: "#172b46", fontWeight: "900", fontSize: 18, marginBottom: 10 },
  methodText: { color: "#44546a", fontSize: 14, lineHeight: 22 },
  secondaryButton: { backgroundColor: "#142b4a", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, alignSelf: "flex-start", marginTop: 14 },
  secondaryButtonText: { color: "#fff", fontWeight: "800" },
  disclaimer: { color: "#788395", fontSize: 11, lineHeight: 17, marginTop: 18 },
});
