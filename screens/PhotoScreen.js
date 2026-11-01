import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { API_URL } from "../config";
import { appendAsset } from "../upload";

export default function PhotoScreen({ navigation, route }) {
  const forTitle = route.params?.forTitle === true;

  const [language, setLanguage] = useState("French");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function readPhoto(asset) {
    if (!asset?.uri) {
      setError("No photo was selected.");
      return;
    }

    setPreview(asset.uri);
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("language", language);
      await appendAsset(form, "file", asset, "photo.jpg", "image/jpeg");

      const res = await fetch(`${API_URL}/ocr`, {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not read that photo.");
      }

      if (!data.text || !data.text.trim()) {
        throw new Error("No readable text was found in that photo.");
      }

      if (forTitle) {
        const title = data.text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join(" ")
          .slice(0, 100);

        if (!title) {
          throw new Error("Could not identify a book title.");
        }

        navigation.navigate("Books", { title, language });
        return;
      }

      navigation.navigate("Tutor", {
        fullText: data.text,
        language,
        fileName: data.fileName || "Scanned page",
        truncated: Boolean(data.truncated),
      });
    } catch (e) {
      setError(e.message || "Could not read that photo.");
    } finally {
      setLoading(false);
    }
  }

  async function takePhoto() {
    setError(null);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setError("Camera permission is needed to take a photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]) {
        await readPhoto(result.assets[0]);
      }
    } catch (e) {
      setError(e.message || "Could not open the camera.");
    }
  }

  async function choosePhoto() {
    setError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]) {
        await readPhoto(result.assets[0]);
      }
    } catch (e) {
      setError(e.message || "Could not open your photo library.");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {forTitle ? "Scan a book cover" : "Read a page from a photo"}
      </Text>

      <Text style={styles.note}>
        {forTitle
          ? "Photograph the front cover. We will search for the title."
          : "Works best with a flat, well-lit, printed page."}
      </Text>

      <Text style={styles.label}>Language of the text</Text>

      <TextInput
        style={styles.input}
        value={language}
        onChangeText={setLanguage}
        placeholder="For example, French"
        editable={!loading}
      />

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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  note: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
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
  buttonText: {
    color: "white",
    fontSize: 18,
  },
  secondary: {
    backgroundColor: "#dbe7ff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: {
    color: "#2a6fdb",
    fontSize: 18,
  },
  disabled: {
    opacity: 0.5,
  },
  preview: {
    height: 160,
    marginTop: 16,
  },
  loading: {
    alignItems: "center",
    marginTop: 8,
  },
  error: {
    marginTop: 16,
    color: "#c0392b",
    textAlign: "center",
  },
});
