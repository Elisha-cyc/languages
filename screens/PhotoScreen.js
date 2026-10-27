import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { API_URL } from "../config";
import { appendAsset } from "../upload";
import WebCamera from "../components/WebCamera";
import LanguagePicker from "../components/LanguagePicker";

export default function PhotoScreen({ navigation }) {
  const [language, setLanguage] = useState("French");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  async function readPhoto(asset) {
    setPreview(asset.uri);
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("language", language); // text fields first, then the file
      await appendAsset(form, "file", asset, "photo.jpg", "image/jpeg");

      const res = await fetch(`${API_URL}/ocr`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read that photo");

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

  async function takePhoto() {
    setError(null);

    // On the web, open our own camera view: the picker would only show a file chooser
    if (Platform.OS === "web") {
      setCameraOpen(true);
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is needed to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) await readPhoto(result.assets[0]);
  }

  async function choosePhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) await readPhoto(result.assets[0]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Read a page from a photo</Text>
      <Text style={styles.note}>
        Works best with a flat, well-lit, printed page.
      </Text>

      <Text style={styles.label}>Language of the text</Text>
      <View style={{ marginBottom: 20 }}>
        <LanguagePicker value={language} onChange={setLanguage} />
      </View>

      <Pressable
        style={[styles.button, loading && styles.disabled]}
        disabled={loading}
        onPress={takePhoto}
      >
        <Text style={styles.buttonText}>Take a photo</Text>
      </Pressable>
      <Pressable
        style={[styles.secondary, loading && styles.disabled]}
        disabled={loading}
        onPress={choosePhoto}
      >
        <Text style={styles.secondaryText}>Choose from gallery</Text>
      </Pressable>

      {preview && (
        <Image
          source={{ uri: preview }}
          style={styles.preview}
          resizeMode="contain"
        />
      )}

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.note}>
            Reading the text... the first scan in a language can take a minute.
          </Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <WebCamera
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(asset) => {
          setCameraOpen(false);
          readPhoto(asset);
        }}
      />
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
    marginBottom: 16,
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
  buttonText: { color: "white", fontSize: 18 },
  secondary: {
    backgroundColor: "#dbe7ff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: { color: "#2a6fdb", fontSize: 18 },
  disabled: { opacity: 0.5 },
  preview: { height: 160, marginTop: 16 },
  loading: { alignItems: "center", marginTop: 8 },
  error: { marginTop: 16, color: "#c0392b", textAlign: "center" },
});
