import { useState, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { speak, stopSpeaking, voiceReport } from "../speech";

const SAMPLES = {
  French: "Bonjour, comment allez-vous ?",
  Spanish: "Hola, ¿cómo estás?",
  German: "Hallo, wie geht es dir?",
  Italian: "Ciao, come stai?",
  Portuguese: "Olá, como você está?",
  Dutch: "Hallo, hoe gaat het met je?",
  Swedish: "Hej, hur mår du?",
  Polish: "Cześć, jak się masz?",
  Turkish: "Merhaba, nasılsın?",
  Indonesian: "Halo, apa kabar?",
  Swahili: "Habari, hujambo?",
  Russian: "Привет, как дела?",
  "Mandarin Chinese": "你好，你好吗？",
  Japanese: "こんにちは、お元気ですか？",
  Korean: "안녕하세요, 잘 지내세요?",
  Hindi: "नमस्ते, आप कैसे हैं?",
  Arabic: "مرحبا، كيف حالك؟",
  Greek: "Γεια σας, τι κάνετε;",
  Hebrew: "שלום, מה שלומך?",
  Thai: "สวัสดี สบายดีไหม",
};

export default function SpeechCheckScreen() {
  const [report, setReport] = useState(null);
  const [results, setResults] = useState({});

  useEffect(() => {
    voiceReport().then(setReport);
    return () => stopSpeaking();
  }, []);

  async function play(language) {
    setResults((current) => ({ ...current, [language]: "Playing..." }));
    const outcome = await speak(SAMPLES[language], language);
    setResults((current) => ({
      ...current,
      [language]: outcome.ok ? "Played. Did you hear it?" : outcome.reason,
    }));
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Text>Checking the voices on this device...</Text>
      </View>
    );
  }

  const withVoice = report.rows.filter((row) => row.voice).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Speech check</Text>
      <Text style={styles.note}>
        This device reports {report.total} voices, and has a voice for{" "}
        {withVoice} of our {report.rows.length} languages.
      </Text>
      {report.total === 0 && (
        <Text style={styles.warning}>
          No voices were reported. In Chrome the list can take a moment to load,
          so reload the page and open this screen again.
        </Text>
      )}

      {report.rows.map((row) => (
        <View key={row.language} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.language}>
              {row.voice ? "✓" : "✗"} {row.language}
            </Text>
            <Text style={styles.sub}>{row.voice || "No voice found"}</Text>
            {results[row.language] && (
              <Text style={styles.result}>{results[row.language]}</Text>
            )}
          </View>
          <Pressable style={styles.play} onPress={() => play(row.language)}>
            <Text style={styles.playText}>Play</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.heading}>If a language has no voice</Text>
      <Text style={styles.help}>
        Windows: Settings, Time and language, Speech, Manage voices, then add
        the language and restart the browser. Chrome often adds its own online
        voices too, which need internet.
      </Text>
      <Text style={styles.help}>
        Android: Settings, System, Languages, Text-to-speech output, then
        install the voice data for the language.
      </Text>
      <Text style={styles.help}>
        iPhone: Settings, Accessibility, Spoken Content, Voices, then download
        one. The silent switch also mutes speech.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f4f8",
  },
  title: { fontSize: 24, fontWeight: "bold" },
  note: {
    fontSize: 15,
    color: "#555",
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 22,
  },
  warning: {
    fontSize: 14,
    color: "#9a6700",
    backgroundColor: "#fff7e0",
    borderRadius: 8,
    padding: 10,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  rowText: { flex: 1 },
  language: { fontSize: 16, fontWeight: "bold" },
  sub: { fontSize: 13, color: "#666", marginTop: 2 },
  result: { fontSize: 13, color: "#2a6fdb", marginTop: 4 },
  play: {
    backgroundColor: "#dbe7ff",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  playText: { color: "#2a6fdb", fontSize: 15 },
  heading: { fontSize: 18, fontWeight: "bold", marginTop: 24, marginBottom: 6 },
  help: { fontSize: 14, color: "#555", lineHeight: 21, marginTop: 6 },
});
