import { useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { API_URL } from "../config";

export default function ImportScreen({ navigation }) {
  const [language, setLanguage] = useState("French");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function pickFile() {
    setError(null);

    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    setLoading(true);

    try {
      const form = new FormData();
      if (asset.file) {
        form.append("file", asset.file); // web
      } else {
        form.append("file", {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
        }); // Android and iPhone
      }

      const res = await fetch(`${API_URL}/import`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not import that file");

      navigation.navigate("Tutor", {
        fullText: data.text,
        language,
        fileName: data.fileName,
        truncated: data.truncated,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import a file</Text>
      <Text style={styles.note}>
        PDF, Word (.docx) or text file, up to 10 MB.
      </Text>

      <Text style={styles.label}>Language of the file</Text>
      <TextInput
        style={styles.input}
        value={language}
        onChangeText={setLanguage}
      />

      <Pressable
        style={[styles.button, loading && styles.disabled]}
        disabled={loading}
        onPress={pickFile}
      >
        <Text style={styles.buttonText}>
          {loading ? "Reading your file..." : "Choose a file"}
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f2f4f8",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center" },
  note: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  label: { fontSize: 14, color: "#555", marginBottom: 4 },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#d5d9e0",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "white", fontSize: 18 },
  error: { marginTop: 16, color: "#c0392b", textAlign: "center" },
});
