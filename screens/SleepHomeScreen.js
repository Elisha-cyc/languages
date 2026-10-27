import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
} from "react-native";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { API_URL, USER_ID } from "../config";
import LanguagePicker from "../components/LanguagePicker";

const percent = (score, total) =>
  total > 0 ? `${Math.round((100 * score) / total)}%` : "-";

const SOURCES = [
  {
    id: "lessons",
    title: "Our lessons",
    text: "Words from the lessons you passed most recently.",
  },
  {
    id: "book",
    title: "A free book",
    text: "Open a public-domain book and read a part with your tutor.",
  },
  {
    id: "own",
    title: "My own material",
    text: "Import a file, photograph a page, or paste text.",
  },
];

export default function SleepHomeScreen({ navigation }) {
  const [source, setSource] = useState("lessons");
  const [language, setLanguage] = useState("French");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { data, error: loadError } = useFetch(`/sleep/history?user=${USER_ID}`);

  async function prepare() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/sleep/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, language }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error || "Could not prepare tonight's session");
      navigation.navigate("SleepStudy", {
        sessionId: body.sessionId,
        language: body.language,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <Message text={loadError} />;
  if (!data) return <Message text="Loading..." />;
  if (!Array.isArray(data.results))
    return <Message text={data.error || "Could not load sleep mode."} />;

  const totals = data.results.reduce(
    (sum, night) => ({
      cued: sum.cued + night.cued_score,
      cuedTotal: sum.cuedTotal + night.cued_total,
      uncued: sum.uncued + night.uncued_score,
      uncuedTotal: sum.uncuedTotal + night.uncued_total,
    }),
    { cued: 0, cuedTotal: 0, uncued: 0, uncuedTotal: 0 },
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Sleep mode</Text>
      <Text style={styles.note}>
        An experiment, not a promise. Words you learned today are replayed very
        quietly while you sleep, and a morning test compares them with words
        that were not replayed. Research on this is mixed, especially without
        sleep monitoring at home, so your own results matter most.
      </Text>

      {data.pending && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            A session is waiting for its morning test
            {data.pending.label ? ` (${data.pending.label})` : ""}
          </Text>
          <Pressable
            style={styles.button}
            onPress={() =>
              navigation.navigate("SleepMorning", {
                sessionId: data.pending.id,
              })
            }
          >
            <Text style={styles.buttonText}>Take the morning test</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.heading}>
        Where should tonight's words come from?
      </Text>
      {SOURCES.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.source, source === item.id && styles.sourceOn]}
          onPress={() => setSource(item.id)}
        >
          <Text style={styles.sourceTitle}>{item.title}</Text>
          <Text style={styles.sourceText}>{item.text}</Text>
        </Pressable>
      ))}

      {source === "lessons" && (
        <View>
          <Text style={styles.label}>Language</Text>
          <LanguagePicker value={language} onChange={setLanguage} />
          <Pressable
            style={[styles.button, busy && styles.disabled]}
            disabled={busy}
            onPress={prepare}
          >
            <Text style={styles.buttonText}>Prepare tonight's session</Text>
          </Pressable>
        </View>
      )}

      {source === "book" && (
        <View>
          <Text style={styles.small}>
            Find a free book, tap an edition, and read a part with your tutor.
            Then press "Use this part for sleep mode" under the text. The AI
            picks the words, and you can check and remove any before bed.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate("Books", { title: "" })}
          >
            <Text style={styles.buttonText}>Find a free book</Text>
          </Pressable>
        </View>
      )}

      {source === "own" && (
        <View>
          <Text style={styles.small}>
            Bring in your material, then press "Use this part for sleep mode"
            under the text. The AI picks the words, and you can check and remove
            any before bed.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate("Import")}
          >
            <Text style={styles.buttonText}>Import a file</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate("Photo", { forTitle: false })}
          >
            <Text style={styles.secondaryText}>Photograph a page</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate("Tutor")}
          >
            <Text style={styles.secondaryText}>Paste text</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.heading}>Your results so far</Text>
      {data.results.length === 0 ? (
        <Text style={styles.note}>No completed nights yet.</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {data.results.length} night{data.results.length === 1 ? "" : "s"}
          </Text>
          <Text style={styles.line}>
            Replayed words: {totals.cued} of {totals.cuedTotal} (
            {percent(totals.cued, totals.cuedTotal)})
          </Text>
          <Text style={styles.line}>
            Words not replayed: {totals.uncued} of {totals.uncuedTotal} (
            {percent(totals.uncued, totals.uncuedTotal)})
          </Text>
          <Text style={styles.small}>
            A few words per night is a small sample. Differences of a word or
            two are normal variation, so look at the trend over many nights.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "bold" },
  note: {
    fontSize: 15,
    color: "#555",
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 22,
  },
  label: { fontSize: 14, color: "#555", marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "white", fontSize: 18 },
  secondary: {
    backgroundColor: "#dbe7ff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: { color: "#2a6fdb", fontSize: 16 },
  disabled: { opacity: 0.5 },
  error: { marginTop: 12, color: "#c0392b", textAlign: "center" },
  heading: { fontSize: 18, fontWeight: "bold", marginTop: 24, marginBottom: 6 },
  source: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#d5d9e0",
  },
  sourceOn: { borderColor: "#2a6fdb", backgroundColor: "#f3f7ff" },
  sourceTitle: { fontSize: 17, fontWeight: "bold" },
  sourceText: { fontSize: 14, color: "#555", marginTop: 2 },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  cardTitle: { fontSize: 16, fontWeight: "bold" },
  line: { fontSize: 16, marginTop: 6 },
  small: { fontSize: 13, color: "#666", marginTop: 10, lineHeight: 18 },
});
