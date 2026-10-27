import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>What do you want to do?</Text>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("Languages")}
      >
        <Text style={styles.buttonText}>Follow the curriculum</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("Chat")}
      >
        <Text style={styles.buttonText}>Talk to an AI partner</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("Books", { title: "" })}
      >
        <Text style={styles.buttonText}>Find a book by title</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("Import")}
      >
        <Text style={styles.buttonText}>Import a file</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("Photo", { forTitle: false })}
      >
        <Text style={styles.buttonText}>Read a page from a photo</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("Sleep")}
      >
        <Text style={styles.buttonText}>Sleep mode</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("Tutor")}
      >
        <Text style={styles.buttonText}>AI tutor: paste a text</Text>
      </Pressable>
      <Pressable
        style={styles.link}
        onPress={() => navigation.navigate("SpeechCheck")}
      >
        <Text style={styles.linkText}>Check speech on this device</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("HanziHome")}
      >
        <Text style={styles.buttonText}>汉字 Chinese characters</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f4f8",
    padding: 16,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 24 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 12,
    minWidth: 280,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 18 },
  link: { marginTop: 8, padding: 10 },
  linkText: { color: "#2a6fdb", fontSize: 15 },
});
