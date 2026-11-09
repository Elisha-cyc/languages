import { StyleSheet, Text, ScrollView, View, Pressable } from "react-native";
import { useAuth } from "../auth";
import Tile from "../components/Tile";

function QuickAction({ icon, title, subtitle, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.quickAction}>
      <View style={styles.quickIcon}><Text style={styles.quickEmoji}>{icon}</Text></View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topLine}>
        <View>
          <Text style={styles.brand}>LINGUA<Text style={styles.brandAccent}>APP</Text></Text>
          <Text style={styles.greeting}>Welcome back, {user.name}</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>{String(user.name || "L").slice(0, 1).toUpperCase()}</Text></View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroEyebrow}>YOUR NEXT CHAPTER STARTS HERE</Text>
        <Text style={styles.heroTitle}>A little practice.{ "\n" }A lot of progress.</Text>
        <Text style={styles.heroText}>Build real confidence in another language, one conversation at a time.</Text>
        <Pressable accessibilityRole="button" style={styles.heroButton} onPress={() => navigation.navigate("Languages")}>
          <Text style={styles.heroButtonText}>Continue learning  →</Text>
        </Pressable>
        <View style={styles.heroMark}><Text style={styles.heroMarkText}>言</Text></View>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Your learning space</Text>
        <Text style={styles.sectionCaption}>Everything you need, in one place</Text>
      </View>
      <View style={styles.quickGrid}>
        <QuickAction icon="🎙️" title="AI speaking" subtitle="Talk naturally" onPress={() => navigation.navigate("ChatTab")} />
        <QuickAction icon="🎓" title="My courses" subtitle="Follow your path" onPress={() => navigation.navigate("Languages")} />
        <QuickAction icon="✍️" title="Writing" subtitle="Characters & text" onPress={() => navigation.navigate("HanziHome")} />
        <QuickAction icon="📊" title="My progress" subtitle="See your growth" onPress={() => navigation.navigate("Progress")} />
      </View>

      <Text style={styles.sectionTitle}>Explore more</Text>
      <Tile icon="🇨🇳" title="Chinese Academy" text="Your Mandarin pathway, from first sounds to advanced study" onPress={() => navigation.navigate("ChineseAcademy")} />
      <Tile icon="🗣️" title="Pronunciation studio" text="Train pinyin, sounds and tones aloud" onPress={() => navigation.navigate("PinyinTeacher")} />
      <Tile icon="📖" title="Reading library" text="Explore books and learn from real texts" onPress={() => navigation.navigate("Books", { title: "" })} />
      <Tile icon="🌙" title="Sleep learning" text="Review words and lessons in a calm routine" onPress={() => navigation.navigate("Sleep")} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7fb" },
  container: { padding: 18, paddingBottom: 34 },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  brand: { color: "#152c48", fontSize: 13, fontWeight: "900", letterSpacing: 2.2 },
  brandAccent: { color: "#2b9fbd" },
  greeting: { color: "#142943", fontSize: 24, fontWeight: "900", marginTop: 7 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#dff5fb", borderWidth: 1, borderColor: "#b9eaf4", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#12627b", fontSize: 18, fontWeight: "900" },
  hero: { minHeight: 226, backgroundColor: "#102b49", borderRadius: 24, padding: 22, overflow: "hidden", marginBottom: 24 },
  heroGlow: { position: "absolute", width: 190, height: 190, borderRadius: 95, right: -46, top: 26, backgroundColor: "#1c7895", opacity: 0.35 },
  heroEyebrow: { color: "#8dddf1", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle: { color: "#fff", fontSize: 29, lineHeight: 35, fontWeight: "900", marginTop: 12, maxWidth: 260 },
  heroText: { color: "#d3e4f2", fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 280 },
  heroButton: { backgroundColor: "#a8e8f5", paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, alignSelf: "flex-start", marginTop: 16 },
  heroButtonText: { color: "#10324e", fontSize: 13, fontWeight: "900" },
  heroMark: { position: "absolute", right: 23, top: 70, width: 82, height: 82, borderRadius: 41, borderWidth: 1, borderColor: "rgba(191,244,255,0.45)", alignItems: "center", justifyContent: "center" },
  heroMarkText: { color: "#c6f5ff", fontSize: 42, fontWeight: "300" },
  sectionHead: { marginBottom: 13 },
  sectionTitle: { color: "#172e49", fontSize: 19, fontWeight: "900", marginBottom: 5, marginTop: 5 },
  sectionCaption: { color: "#718096", fontSize: 12 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 18 },
  quickAction: { width: "48.5%", backgroundColor: "#fff", borderRadius: 17, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e6edf4", minHeight: 136 },
  quickIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#eaf7fb", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  quickEmoji: { fontSize: 20 },
  quickTitle: { color: "#19334f", fontSize: 14, fontWeight: "900" },
  quickSubtitle: { color: "#7b8797", fontSize: 11, marginTop: 4 },
});
