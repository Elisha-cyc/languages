import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useAuth } from "../auth";
import Tile from "../components/Tile";
import LanguagePicker, { NATIVE_OPTIONS } from "../components/LanguagePicker";

export default function ProfileScreen({ navigation }) {
  const { user, logout, setNative } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
      </View>

      <Tile
        icon="🔊"
        title="Check speech on this device"
        text="See which languages have a voice"
        onPress={() => navigation.navigate("SpeechCheck")}
      />

      <Text style={styles.username}>Explanations in</Text>
      <LanguagePicker
        value={user.nativeLanguage || "English"}
        onChange={(language) => setNative(language).catch(() => {})}
        options={NATIVE_OPTIONS}
        title="Your language"
      />

      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  name: { fontSize: 22, fontWeight: "bold" },
  username: { fontSize: 15, color: "#666", marginTop: 4 },
  logout: {
    backgroundColor: "#fdeeee",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },
  logoutText: { color: "#c0392b", fontSize: 17 },
});
