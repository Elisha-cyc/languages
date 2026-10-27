import { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
} from "react-native";
import { API_URL, NATIVE_LANGUAGE, USER_ID } from "../config";
import { speak, stopSpeaking } from "../speech";
import { splitIntoParts } from "../chunks";
import LanguagePicker from "../components/LanguagePicker";

const MODES = [
  { id: "summary", label: "Summary" },
  { id: "key_facts", label: "Key facts" },
  { id: "read_explain", label: "Read & explain" },
  { id: "read_explain_teach", label: "Read, explain & teach" },
];

export default function TutorScreen({ navigation, route }) {
  const params = route.params || {};
  const parts = useMemo(
    () => (params.fullText ? splitIntoParts(params.fullText) : []),
    [params.fullText],
  );

  const [language, setLanguage] = useState(params.language || "French");
  const [text, setText] = useState(parts[0] || "");
  const [partIndex, setPartIndex] = useState(0);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [sleepBusy, setSleepBusy] = useState(false);
  const [error, setError] = useState(null);

  // Stop any speech when the user leaves this screen
  useEffect(() => stopSpeaking, []);

  // Load the chosen part and clear the old answer.
  // A book opened from the library also starts reading straight away.
  useEffect(() => {
    if (parts.length > 0) {
      setText(parts[partIndex]);
      setReply("");
      setError(null);
      if (params.autoRead) ask("read_explain", parts[partIndex]);
    }
  }, [partIndex, parts]);

  // `source` is the text to send; it defaults to what is in the text box
  async function ask(mode, source = text) {
    if (!source.trim()) {
      setError("Paste some text first.");
      return;
    }
    setLoading(true);
    setError(null);
    setReply("");

    try {
      const res = await fetch(`${API_URL}/ai/lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: source,
          mode,
          targetLanguage: language,
          nativeLanguage: NATIVE_LANGUAGE,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setReply(data.reply);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function makeSleepSession() {
    if (text.trim().length < 150) {
      setError("Use a longer text: at least a few full sentences.");
      return;
    }
    setSleepBusy(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/sleep/sessions/from-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          language,
          text,
          label: params.fileName || "Pasted text",
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Could not prepare the session");

      navigation.navigate("SleepStudy", {
        sessionId: data.sessionId,
        language: data.language,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSleepBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {params.fileName && (
        <Text style={styles.fileName}>{params.fileName}</Text>
      )}
      {params.truncated && (
        <Text style={styles.warning}>
          This file was long, so only the first part of it was loaded.
        </Text>
      )}

      {parts.length > 1 && (
        <View style={styles.partBar}>
          <Pressable
            style={[styles.partButton, partIndex === 0 && styles.disabled]}
            disabled={partIndex === 0}
            onPress={() => setPartIndex(partIndex - 1)}
          >
            <Text style={styles.partButtonText}>Previous</Text>
          </Pressable>
          <Text style={styles.partLabel}>
            Part {partIndex + 1} of {parts.length}
          </Text>
          <Pressable
            style={[
              styles.partButton,
              partIndex === parts.length - 1 && styles.disabled,
            ]}
            disabled={partIndex === parts.length - 1}
            onPress={() => setPartIndex(partIndex + 1)}
          >
            <Text style={styles.partButtonText}>Next</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.label}>Language of the text</Text>
      <LanguagePicker value={language} onChange={setLanguage} />

      <Text style={styles.label}>Text</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Je mange une pomme chaque matin."
      />

      <Pressable style={styles.listen} onPress={() => speak(text, language)}>
        <Text style={styles.listenText}>🔊 Listen to the text</Text>
      </Pressable>

      <View style={styles.modes}>
        {MODES.map((mode) => (
          <Pressable
            key={mode.id}
            style={[styles.button, loading && styles.disabled]}
            disabled={loading}
            onPress={() => ask(mode.id)}
          >
            <Text style={styles.buttonText}>{mode.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading && <Text style={styles.status}>The tutor is thinking...</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      {reply !== "" && <Text style={styles.reply}>{reply}</Text>}

      <View style={styles.sleepBox}>
        <Text style={styles.sleepTitle}>Learn this while you sleep</Text>
        <Text style={styles.sleepNote}>
          The AI picks useful words from the text above. You can check them and
          remove any that look wrong before bed. Read the text with your tutor
          first: sleep strengthens what you already know.
        </Text>
        <Pressable
          style={[styles.sleepButton, sleepBusy && styles.disabled]}
          disabled={sleepBusy}
          onPress={makeSleepSession}
        >
          <Text style={styles.sleepButtonText}>
            {sleepBusy ? "Picking words..." : "Use this part for sleep mode"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  fileName: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  warning: { fontSize: 14, color: "#9a6700", marginBottom: 8 },
  partBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  partButton: {
    backgroundColor: "#dbe7ff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  partButtonText: { color: "#2a6fdb", fontSize: 15 },
  partLabel: { fontSize: 15, color: "#555" },
  label: { fontSize: 14, color: "#555", marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  textArea: { minHeight: 120, maxHeight: 260, textAlignVertical: "top" },
  listen: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#dbe7ff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  listenText: { color: "#2a6fdb", fontSize: 15 },
  modes: { marginTop: 16 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "white", fontSize: 16 },
  status: { marginTop: 16, color: "#555" },
  error: { marginTop: 16, color: "#c0392b" },
  reply: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
  },
  sleepBox: {
    marginTop: 24,
    backgroundColor: "#eef2ff",
    borderRadius: 10,
    padding: 14,
  },
  sleepTitle: { fontSize: 16, fontWeight: "bold" },
  sleepNote: { fontSize: 13, color: "#555", marginTop: 6, lineHeight: 19 },
  sleepButton: {
    backgroundColor: "#4a4fdb",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  sleepButtonText: { color: "white", fontSize: 16 },
});
