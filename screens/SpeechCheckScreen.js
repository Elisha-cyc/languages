import { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { speak, stopSpeaking, voiceReport } from "../speech";
import { useQuietOnLeave } from "../useQuietOnLeave";

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
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  useQuietOnLeave(stopSpeaking);

  const refreshVoices = useCallback(async () => {
    setRefreshing(true);
    try {
      setReport(await voiceReport({ refresh: true }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    refreshVoices();
    return () => stopSpeaking();
  }, [isFocused, refreshVoices]);

  async function play(language) {
    setResults((current) => ({ ...current, [language]: "Playing..." }));
    const outcome = await speak(SAMPLES[language], language);
    setResults((current) => ({
      ...current,
      [language]: outcome.ok ? "Played. Did you hear it?" : outcome.reason,
    }));
  }

  if (!report || refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.note}>Checking the voices on this device...</Text>
      </View>
    );
  }

  const withVoice = report.rows.filter((row) => row.voice).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Speech check</Text>
      <Text style={styles.note}>
        {report.cloudReady
          ? `Online speech is configured for all ${report.rows.length} languages. People do not need to download phone voices, but they do need an internet connection.`
          : `This device reports ${report.total} voices, and has a voice for ${withVoice} of our ${report.rows.length} languages. Online speech is not available right now.`}
      </Text>
      <Text style={styles.help}>
        If online speech is ready, LinguaApp uses it for every supported
        language. Otherwise, this device needs its own installed voice for each
        language. Return here and refresh after changing phone settings.
      </Text>
      <Pressable style={styles.refresh} onPress={refreshVoices}>
        <Text style={styles.refreshText}>Refresh voice list</Text>
      </Pressable>
      {report.total === 0 && !report.cloudReady && (
        <Text style={styles.warning}>
          {Platform.OS === "web"
            ? "No voices were reported. In Chrome the list can take a moment to load, so refresh this screen."
            : "This phone did not report any installed voices. Follow the steps below to add speech voices in system settings."}
        </Text>
      )}

      {report.rows.map((row) => (
        <View key={row.language} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.language}>
              {row.voice || report.cloudReady ? "✓" : "✗"} {row.language}
            </Text>
            <Text style={styles.sub}>
              {row.voice || (report.cloudReady ? "Online voice" : "No voice found")}
            </Text>
            {results[row.language] && (
              <Text style={styles.result}>{results[row.language]}</Text>
            )}
          </View>
          <Pressable style={styles.play} onPress={() => play(row.language)}>
            <Text style={styles.playText}>Play</Text>
          </Pressable>
        </View>
      ))}

      {!report.cloudReady && (
        <>
          <Text style={styles.heading}>Install a missing phone voice</Text>
          {Platform.OS === "android" ? (
            <Text style={styles.help}>
              Android: open Settings → Accessibility → Text-to-speech output (on
              some phones: System or General management → Text-to-speech output).
              Choose Speech Services by Google, tap its settings button, then
              Install voice data and download the language. Come back and refresh.
            </Text>
          ) : Platform.OS === "ios" ? (
            <Text style={styles.help}>
              iPhone: open Settings → Accessibility → Spoken Content → Voices.
              Pick the language and download a voice. Come back and refresh. Turn
              off Silent Mode if you cannot hear speech.
            </Text>
          ) : (
            <Text style={styles.help}>
              Windows: Settings → Time and language → Speech → Manage voices. Add
              a voice, then reload the page. Chrome may also provide online voices.
            </Text>
          )}
        </>
      )}
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
  refresh: {
    alignSelf: "flex-start",
    backgroundColor: "#dbe7ff",
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  refreshText: { color: "#2a6fdb", fontWeight: "600" },
});
