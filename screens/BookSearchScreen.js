import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { API_URL } from "../config";
import { SPEECH_LANGUAGES } from "../speech";
import LanguagePicker from "../components/LanguagePicker";

const CLIENT_TIMEOUT_MS = 45 * 1000;
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

// Compare titles without accents, capitals or punctuation
function titleKey(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s.,;:!?'"()\-]+/g, "");
}

const IDLE = { status: "idle", items: [], message: null };

export default function BookSearchScreen({ navigation, route }) {
  const params = route.params || {};
  const [language, setLanguage] = useState(
    SPEECH_LANGUAGES.includes(params.language) ? params.language : "French",
  );
  const [level, setLevel] = useState("Beginner");
  const [title, setTitle] = useState(params.title || "");
  const [free, setFree] = useState(IDLE);
  const [wiki, setWiki] = useState(IDLE);
  const [details, setDetails] = useState(IDLE);
  const [opening, setOpening] = useState(null);
  const [error, setError] = useState(null);
  const latest = useRef(0); // numbers each search, so an old answer cannot overwrite a newer one

  async function load(url, setState, searchId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      if (!Array.isArray(data)) {
        throw new Error(
          "The server is running old code. Stop it and start it again with npm start.",
        );
      }
      if (searchId === latest.current) {
        setState({ status: "done", items: data, message: null });
      }
    } catch (e) {
      const message =
        e.name === "AbortError"
          ? "This is taking too long. Try again in a moment."
          : e.message;
      if (searchId === latest.current) {
        setState({ status: "error", items: [], message });
      }
    } finally {
      clearTimeout(timer);
    }
  }

  function search(searchTitle = title) {
    const text = searchTitle.trim();
    if (text.length < 2) {
      setError("Type a book title first, or press Browse all books.");
      return;
    }
    setError(null);

    const searchId = ++latest.current;
    const query = `title=${encodeURIComponent(text)}&language=${encodeURIComponent(language)}`;

    setFree({ status: "loading", items: [], message: null });
    setWiki({ status: "loading", items: [], message: null });
    setDetails({ status: "loading", items: [], message: null });

    // The searches run side by side and each fills in when it is ready
    load(`${API_URL}/books/free?${query}`, setFree, searchId);
    load(`${API_URL}/wiki/search?${query}`, setWiki, searchId);
    load(`${API_URL}/books/search?${query}`, setDetails, searchId);
  }

  // Lists every readable book in this language, with no typing
  function browse() {
    setError(null);
    const searchId = ++latest.current;
    setWiki(IDLE);
    setDetails(IDLE);
    setFree({ status: "loading", items: [], message: null });
    load(
      `${API_URL}/books/browse?language=${encodeURIComponent(language)}`,
      setFree,
      searchId,
    );
  }

  // A title that came from scanning a cover is searched straight away
  useEffect(() => {
    if (params.title) search(params.title);
  }, []);

  function openInTutor(data, label) {
    navigation.navigate("Tutor", {
      fullText: data.text,
      language,
      fileName: label,
      truncated: false,
      autoRead: true,
    });
  }

  async function readBook(book) {
    setOpening(`free-${book.id}`);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/books/${book.id}/text?section=1`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load that book");
      openInTutor(
        data,
        `${data.title} (section ${data.section} of ${data.sections})`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setOpening(null);
    }
  }

  async function readWiki(item) {
    setOpening(`wiki-${item.title}`);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/wiki/text?language=${encodeURIComponent(language)}&title=${encodeURIComponent(item.title)}&section=1`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load that text");
      openInTutor(
        data,
        `${data.title} (section ${data.section} of ${data.sections})`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setOpening(null);
    }
  }

  async function retell(book) {
    setOpening(`retell-${book.key}`);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/books/retell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: book.title,
          authors: book.authors,
          language,
          level,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not write that text");
      openInTutor(data, `AI retelling of "${book.title}" (${level})`);
    } catch (e) {
      setError(e.message);
    } finally {
      setOpening(null);
    }
  }

  // Do not list a book twice: hide details-only results that are also free
  const readableKeys = new Set(
    [...free.items, ...wiki.items]
      .map((b) => titleKey(b.title))
      .filter(Boolean),
  );
  const otherBooks = details.items.filter(
    (book) => !readableKeys.has(titleKey(book.title)),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Language of the book</Text>
      <LanguagePicker
        value={language}
        onChange={(name) => {
          setLanguage(name);
          setFree(IDLE);
          setWiki(IDLE);
          setDetails(IDLE);
        }}
      />

      <Text style={styles.label}>Book title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Candide"
        returnKeyType="search"
        onSubmitEditing={() => search()}
      />

      <Pressable style={styles.button} onPress={() => search()}>
        <Text style={styles.buttonText}>Search</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={browse}>
        <Text style={styles.secondaryText}>Browse all {language} books</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() => navigation.navigate("Photo", { forTitle: true })}
      >
        <Text style={styles.secondaryText}>Scan the cover instead</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {free.status !== "idle" && (
        <View>
          <Text style={styles.heading}>Free to read</Text>

          {free.status === "loading" && (
            <View style={styles.row}>
              <ActivityIndicator />
              <Text style={styles.rowText}>Looking for free editions...</Text>
            </View>
          )}
          {free.status === "error" && (
            <Text style={styles.warning}>{free.message}</Text>
          )}
          {free.status === "done" && free.items.length === 0 && (
            <Text style={styles.note}>
              No free editions found in {language}. Check Wikisource below, or
              read an AI retelling.
            </Text>
          )}

          {free.items.map((book) => (
            <Pressable
              key={book.id}
              style={[styles.card, opening !== null && styles.disabled]}
              disabled={opening !== null}
              onPress={() => readBook(book)}
            >
              <Text style={styles.cardTitle}>{book.title}</Text>
              <Text style={styles.cardSub}>{book.authors}</Text>
              <Text style={styles.badge}>
                {opening === `free-${book.id}`
                  ? "Loading the book..."
                  : "Tap to read with your tutor"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {wiki.status !== "idle" && (
        <View>
          <Text style={styles.heading}>Wikisource texts</Text>

          {wiki.status === "loading" && (
            <View style={styles.row}>
              <ActivityIndicator />
              <Text style={styles.rowText}>Searching Wikisource...</Text>
            </View>
          )}
          {wiki.status === "error" && (
            <Text style={styles.warning}>{wiki.message}</Text>
          )}
          {wiki.status === "done" && wiki.items.length === 0 && (
            <Text style={styles.note}>No texts found on Wikisource.</Text>
          )}

          {wiki.items.map((item) => (
            <Pressable
              key={item.title}
              style={[styles.card, opening !== null && styles.disabled]}
              disabled={opening !== null}
              onPress={() => readWiki(item)}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>About {item.words} words</Text>
              <Text style={styles.badge}>
                {opening === `wiki-${item.title}`
                  ? "Loading the text..."
                  : "Tap to read with your tutor"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {details.status !== "idle" && (
        <View>
          <Text style={styles.heading}>No free text found</Text>

          {details.status === "loading" && (
            <View style={styles.row}>
              <ActivityIndicator />
              <Text style={styles.rowText}>Searching the wider catalog...</Text>
            </View>
          )}
          {details.status === "error" && (
            <Text style={styles.warning}>{details.message}</Text>
          )}
          {details.status === "done" && otherBooks.length === 0 && (
            <Text style={styles.note}>Nothing else found.</Text>
          )}

          {otherBooks.length > 0 && (
            <View>
              <Text style={styles.note}>
                The real text of these books is not free online. The tutor can
                write a short AI retelling in {language} at your level instead.
                It is not the real book.
              </Text>

              <View style={styles.levels}>
                {LEVELS.map((value) => (
                  <Pressable
                    key={value}
                    style={[styles.chip, level === value && styles.chipOn]}
                    onPress={() => setLevel(value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        level === value && styles.chipTextOn,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {otherBooks.map((book) => (
                <View key={book.key} style={[styles.card, styles.cardPlain]}>
                  <Text style={styles.cardTitle}>{book.title}</Text>
                  <Text style={styles.cardSub}>
                    {book.authors}
                    {book.year ? ` · ${book.year}` : ""}
                  </Text>
                  <Pressable
                    style={[styles.retell, opening !== null && styles.disabled]}
                    disabled={opening !== null}
                    onPress={() => retell(book)}
                  >
                    <Text style={styles.retellText}>
                      {opening === `retell-${book.key}`
                        ? "Writing..."
                        : "Read an AI retelling"}
                    </Text>
                  </Pressable>
                </View>
              ))}

              <Pressable
                style={styles.secondary}
                onPress={() => navigation.navigate("Import")}
              >
                <Text style={styles.secondaryText}>Import your own copy</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={() =>
                  navigation.navigate("Photo", { forTitle: false })
                }
              >
                <Text style={styles.secondaryText}>Photograph a page</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  label: { fontSize: 14, color: "#555", marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  levels: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  chip: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#d5d9e0",
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  chipOn: { backgroundColor: "#2a6fdb", borderColor: "#2a6fdb" },
  chipText: { fontSize: 14, color: "#333" },
  chipTextOn: { color: "white" },
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
  row: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  rowText: { flex: 1, fontSize: 14, color: "#666", marginLeft: 10 },
  note: { fontSize: 14, color: "#666", marginTop: 6, marginBottom: 6 },
  warning: { fontSize: 14, color: "#9a6700", marginTop: 8 },
  error: { marginTop: 16, color: "#c0392b", textAlign: "center" },
  heading: { fontSize: 18, fontWeight: "bold", marginTop: 24, marginBottom: 6 },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  cardPlain: { backgroundColor: "#f7f8fa" },
  cardTitle: { fontSize: 17, fontWeight: "bold" },
  cardSub: { fontSize: 14, color: "#666", marginTop: 2 },
  badge: { fontSize: 13, color: "#2a6fdb", marginTop: 8 },
  retell: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "#dbe7ff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  retellText: { color: "#2a6fdb", fontSize: 14 },
});
