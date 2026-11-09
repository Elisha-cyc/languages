import { StyleSheet, Text, ScrollView, View, Pressable } from "react-native";
import { useAuth } from "../auth";

const actions = [
  { icon: "🗣️", title: "AI conversation", detail: "Speak naturally and practise", route: "ChatTab", featured: true },
  { icon: "📚", title: "My learning path", detail: "Structured lessons for 20 languages", route: "Languages" },
  { icon: "🎓", title: "AI teacher", detail: "Learn, listen and repeat", route: "Teacher" },
  { icon: "📈", title: "My progress", detail: "See your learning activity", route: "Progress" },
  { icon: "🇨🇳", title: "Chinese Academy", detail: "Mandarin from beginner onwards", route: "ChineseAcademy" },
  { icon: "汉", title: "Chinese characters", detail: "Read and practise writing", route: "HanziHome" },
  { icon: "📖", title: "Reading library", detail: "Explore books with your tutor", route: "Books" },
  { icon: "🌙", title: "Sleep learning", detail: "Review and reinforce vocabulary", route: "Sleep" },
];

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const firstName = user?.name?.trim()?.split(/\s+/)[0] || "Learner";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topline}>
        <View>
          <Text style={styles.eyebrow}>YOUR LANGUAGE JOURNEY</Text>
          <Text style={styles.hello}>Hello, {firstName} 👋</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text></View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroEyebrow}>A LITTLE PRACTICE EVERY DAY</Text>
        <Text style={styles.heroTitle}>Your next language breakthrough starts here.</Text>
        <Text style={styles.heroCopy}>Learn step by step, build confidence, and practise with your AI conversation partner.</Text>
        <Pressable style={styles.heroButton} onPress={() => navigation.navigate("Languages")}>
          <Text style={styles.heroButtonText}>Continue learning  →</Text>
        </Pressable>
        <Text style={styles.heroMark}>你好 · Bonjour · Hola</Text>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Your learning space</Text>
        <Text style={styles.sectionHint}>Choose what you want to work on</Text>
      </View>

      <View style={styles.grid}>
        {actions.map((item) => (
          <Pressable
            key={item.title}
            onPress={() => item.route === "Books" ? navigation.navigate("Books", { title: "" }) : navigation.navigate(item.route)}
            style={({ pressed }) => [styles.card, item.featured && styles.featuredCard, pressed && styles.cardPressed]}
          >
            <View style={[styles.iconBox, item.featured && styles.featuredIcon]}><Text style={styles.icon}>{item.icon}</Text></View>
            <Text style={[styles.cardTitle, item.featured && styles.featuredTitle]}>{item.title}</Text>
            <Text style={[styles.cardDetail, item.featured && styles.featuredDetail]}>{item.detail}</Text>
            <Text style={[styles.arrow, item.featured && styles.featuredTitle]}>↗</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.footer}>Small steps. Real progress. One language at a time.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f6fb" },
  container: { padding: 20, paddingBottom: 36 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 22 },
  eyebrow: { color: "#727b96", fontSize: 10, fontWeight: "800", letterSpacing: 1.8 },
  hello: { color: "#171d35", fontSize: 28, fontWeight: "800", marginTop: 5 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#e5e9ff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d5dcff" },
  avatarText: { color: "#4b5ed1", fontWeight: "800", fontSize: 18 },
  hero: { backgroundColor: "#171d3c", borderRadius: 26, padding: 23, overflow: "hidden", minHeight: 250 },
  heroGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "#394b9b", opacity: 0.38, right: -78, top: -95 },
  heroEyebrow: { color: "#aab8ff", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: "white", fontSize: 25, lineHeight: 31, fontWeight: "800", marginTop: 12, maxWidth: 330 },
  heroCopy: { color: "#c6cbe0", fontSize: 14, lineHeight: 21, marginTop: 9, maxWidth: 360 },
  heroButton: { alignSelf: "flex-start", backgroundColor: "#aebaff", paddingHorizontal: 17, paddingVertical: 11, borderRadius: 14, marginTop: 18 },
  heroButtonText: { color: "#1b2450", fontSize: 13, fontWeight: "800" },
  heroMark: { color: "#aab3d4", fontSize: 12, marginTop: 17, letterSpacing: 1.5 },
  sectionHeading: { marginTop: 27, marginBottom: 13 },
  sectionTitle: { color: "#1b2038", fontSize: 20, fontWeight: "800" },
  sectionHint: { color: "#7c8297", fontSize: 13, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: { width: "48.2%", minHeight: 150, backgroundColor: "white", borderRadius: 20, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: "#e8eaf2" },
  featuredCard: { backgroundColor: "#eef0ff", borderColor: "#cbd1ff" },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  iconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#f0f2f8", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  featuredIcon: { backgroundColor: "#dce1ff" },
  icon: { fontSize: 21 },
  cardTitle: { color: "#202640", fontSize: 14, fontWeight: "800" },
  featuredTitle: { color: "#3546aa" },
  cardDetail: { color: "#7b8194", fontSize: 11, lineHeight: 16, marginTop: 5, paddingRight: 2 },
  featuredDetail: { color: "#5965a6" },
  arrow: { color: "#a0a6b7", fontSize: 16, position: "absolute", right: 14, top: 15 },
  footer: { color: "#969bad", textAlign: "center", fontSize: 12, marginTop: 10 },
});
