import { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { API_URL, USER_ID, NATIVE_LANGUAGE } from "../config";
import { speak, stopSpeaking } from "../speech";
import { compareSpeech } from "../listen";
import LanguagePicker from "../components/LanguagePicker";
import { useVoice } from "../voice";
import { takeTestResult } from "../testResult";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const TOPICS = [
  "Free chat",
  "Introduce yourself",
  "Order food at a café",
  "Ask for directions",
  "Shopping",
  "Travel and hotels",
  "Job interview",
  "Making plans with a friend",
];

export default function ChatScreen() {
  const navigation = useNavigation();
  const [phase, setPhase] = useState("setup"); // setup, chat
  const [mode, setMode] = useState("text"); // text, voice
  const [language, setLanguage] = useState("French");
  const [level, setLevel] = useState("Beginner");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [persona, setPersona] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [readAloud, setReadAloud] = useState(true);
  const [listening, setListening] = useState(null); // 'talk', 'dictate', or the id of the message being repeated
  const [testLoading, setTestLoading] = useState(false);

  const nextId = useRef(1);
  const scroller = useRef(null);
  const messagesRef = useRef([]);
  const voice = useVoice(language);
  const voiceInput = voice.available;

  messagesRef.current = messages;

  const userCount = messages.filter((m) => m.role === "user").length;
  const canTest = userCount >= 3;

  useEffect(
    () => () => {
      stopSpeaking();
      voice.cancel();
    },
    [],
  );

  // When the test screen is closed after a pass, start a fresh session
  useEffect(
    () =>
      navigation.addListener("focus", () => {
        const result = takeTestResult("chat");
        if (result && result.passed) reset();
      }),
    [navigation],
  );

  async function requestReply(history) {
    const res = await fetch(`${API_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: USER_ID,
        language,
        level,
        topic,
        nativeLanguage: NATIVE_LANGUAGE,
        history: history
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.text })),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "The assistant is unavailable");
    return data;
  }

  async function start() {
    setError(null);
    setMessages([]);
    setPhase("chat");
    setLoading(true);

    try {
      const data = await requestReply([]);
      setPersona(data.persona || "");
      setMessages([
        {
          id: nextId.current++,
          role: "assistant",
          text: data.reply,
          translation: data.translation,
          pronunciation: data.pronunciation,
        },
      ]);
      if (mode === "voice" || readAloud) speak(data.reply, language);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Sends one learner message, typed or spoken, and gets the reply
  async function sendText(raw) {
    const text = String(raw || "").trim();
    if (!text || loading) return;

    const userMessage = { id: nextId.current++, role: "user", text };
    const history = [...messagesRef.current, userMessage];
    setMessages(history);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const data = await requestReply(history);
      setMessages((current) => [
        ...current.map((m) =>
          m.id === userMessage.id ? { ...m, correction: data.correction } : m,
        ),
        {
          id: nextId.current++,
          role: "assistant",
          text: data.reply,
          translation: data.translation,
          pronunciation: data.pronunciation,
        },
      ]);
      if (mode === "voice" || readAloud) speak(data.reply, language);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleTranslation(id) {
    setMessages((current) =>
      current.map((m) =>
        m.id === id ? { ...m, showTranslation: !m.showTranslation } : m,
      ),
    );
  }

  // Starts or stops listening. `tag` says which button is active.
  function begin(tag, onText) {
    if (listening && listening !== tag) return;
    if (loading && tag === "talk") return;
    setError(null);
    stopSpeaking();
    setListening(tag);
    voice.toggle({
      onText,
      onError: (text) => setError(text),
      onEnd: () => setListening(null),
    });
  }

  // Voice mode: speak, and the words are sent as your message
  function talk() {
    begin("talk", (heard) => sendText(heard));
  }

  // Text mode: speak an answer into the text box
  function dictate() {
    begin("dictate", (heard) =>
      setInput((current) => (current ? `${current} ${heard}` : heard)),
    );
  }

  // Repeat an assistant message aloud, and compare what was heard
  function practice(message) {
    begin(message.id, (heard) => {
      const result = compareSpeech(message.text, heard, language);
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id ? { ...m, practice: { heard, ...result } } : m,
        ),
      );
    });
  }

  function switchMode() {
    if (mode === "text") {
      if (!voiceInput) {
        setError("Voice is not available here. You can keep typing.");
        return;
      }
      setMode("voice");
    } else {
      stopSpeaking();
      setMode("text");
    }
    setError(null);
  }

  // Ends the session with a test made from the conversation
  async function finishSession() {
    if (testLoading) return;
    stopSpeaking();
    voice.cancel();
    setListening(null);
    setError(null);
    setTestLoading(true);
    try {
      const history = messagesRef.current
        .slice(-30)
        .map((m) => ({ role: m.role, content: m.text }));
      const res = await fetch(`${API_URL}/chat/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          level,
          nativeLanguage: NATIVE_LANGUAGE,
          history,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not make the test.");
      navigation.navigate("Test", {
        testId: "chat",
        title: "Conversation test",
        intro:
          "Answer these questions about your conversation. You need 60% to finish.",
        questions: data.questions,
        passPercent: 60,
        compulsory: true,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setTestLoading(false);
    }
  }

  function reset() {
    voice.cancel();
    stopSpeaking();
    setListening(null);
    setLoading(false);
    setError(null);
    setPhase("setup");
  }

  if (phase === "setup") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Talk to an AI partner</Text>
        <Text style={styles.note}>
          Practice a real conversation. Your partner is an AI playing a native
          speaker. It answers in short sentences and corrects your mistakes.
          When you finish, you take a short test about the conversation.
        </Text>

        <Text style={styles.label}>Language</Text>
        <LanguagePicker value={language} onChange={setLanguage} />

        <Text style={styles.label}>Your level</Text>
        <View style={styles.chips}>
          {LEVELS.map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, level === value && styles.chipOn]}
              onPress={() => setLevel(value)}
            >
              <Text
                style={[styles.chipText, level === value && styles.chipTextOn]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Situation</Text>
        <View style={styles.chips}>
          {TOPICS.map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, topic === value && styles.chipOn]}
              onPress={() => setTopic(value)}
            >
              <Text
                style={[styles.chipText, topic === value && styles.chipTextOn]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>How do you want to talk?</Text>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeCard, mode === "text" && styles.modeOn]}
            onPress={() => setMode("text")}
          >
            <Text style={styles.modeTitle}>⌨️ Text</Text>
            <Text style={styles.modeText}>
              Type your answers and read the replies. You can still listen to
              them.
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeCard,
              mode === "voice" && styles.modeOn,
              !voiceInput && styles.disabled,
            ]}
            disabled={!voiceInput}
            onPress={() => setMode("voice")}
          >
            <Text style={styles.modeTitle}>🎤 Voice</Text>
            <Text style={styles.modeText}>
              {voiceInput
                ? "Speak your answers and hear the replies out loud."
                : "Needs Chrome on the web, or the phone app."}
            </Text>
          </Pressable>
        </View>

        {voiceInput && (
          <Text style={styles.small}>
            Your voice is sent to a speech service to turn it into text (Google
            in Chrome, or our server on the phone).
          </Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={start}>
          <Text style={styles.buttonText}>Start the conversation</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.headerName}>
            {persona ? `${persona} (AI)` : "AI assistant"}
          </Text>
          <Text style={styles.headerSub}>
            {language} · {level} · {topic}
          </Text>
        </View>
        <Pressable style={styles.smallButton} onPress={switchMode}>
          <Text style={styles.smallButtonText}>
            {mode === "voice" ? "🎤 Voice" : "⌨️ Text"}
          </Text>
        </Pressable>
        {mode === "text" && (
          <Pressable
            style={styles.smallButton}
            onPress={() => setReadAloud(!readAloud)}
          >
            <Text style={styles.smallButtonText}>
              Read aloud: {readAloud ? "on" : "off"}
            </Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.smallButton, testLoading && styles.disabled]}
          disabled={testLoading}
          onPress={canTest ? finishSession : reset}
        >
          <Text style={styles.smallButtonText}>
            {testLoading ? "Making test..." : canTest ? "Finish + test" : "New"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() =>
          scroller.current && scroller.current.scrollToEnd({ animated: true })
        }
      >
        {messages.map((message) =>
          message.role === "user" ? (
            <View key={message.id} style={styles.userWrap}>
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{message.text}</Text>
              </View>
              {message.correction && (
                <View style={styles.correction}>
                  <Text style={styles.correctionText}>
                    {message.correction}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View key={message.id} style={styles.aiWrap}>
              <View style={styles.aiBubble}>
                <Text style={styles.aiText}>{message.text}</Text>
                {message.pronunciation && (
                  <Text style={styles.pron}>{message.pronunciation}</Text>
                )}
                {message.showTranslation && message.translation && (
                  <Text style={styles.translation}>{message.translation}</Text>
                )}
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={styles.action}
                  onPress={() => speak(message.text, language)}
                >
                  <Text style={styles.actionText}>🔊 Listen</Text>
                </Pressable>
                {voiceInput && (
                  <Pressable
                    style={styles.action}
                    onPress={() => practice(message)}
                  >
                    <Text style={styles.actionText}>
                      {listening === message.id
                        ? voice.state === "working"
                          ? "Checking..."
                          : "Listening..."
                        : "🎤 Say it"}
                    </Text>
                  </Pressable>
                )}
                {message.translation && (
                  <Pressable
                    style={styles.action}
                    onPress={() => toggleTranslation(message.id)}
                  >
                    <Text style={styles.actionText}>
                      {message.showTranslation
                        ? "Hide translation"
                        : "Translate"}
                    </Text>
                  </Pressable>
                )}
              </View>

              {message.practice && (
                <View style={styles.practice}>
                  <Text style={styles.practiceLine}>
                    You said: {message.practice.heard || "(nothing heard)"}
                  </Text>
                  <Text style={styles.practiceLine}>
                    Understood: {message.practice.score}%
                  </Text>
                  {message.practice.missed.length > 0 && (
                    <Text style={styles.practiceLine}>
                      Not heard: {message.practice.missed.join(", ")}
                    </Text>
                  )}
                  <Text style={styles.practiceNote}>
                    This shows whether the speech recognizer understood you. It
                    does not judge how native you sound.
                  </Text>
                </View>
              )}
            </View>
          ),
        )}

        {loading && (
          <Text style={styles.typing}>
            {persona || "The assistant"} is typing...
          </Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      {mode === "voice" && voiceInput ? (
        <View style={styles.voiceBar}>
          <Pressable
            style={[
              styles.talk,
              listening === "talk" && styles.talkOn,
              loading && styles.disabled,
            ]}
            disabled={loading}
            onPress={talk}
          >
            <Text style={styles.talkText}>
              {listening === "talk"
                ? voice.state === "working"
                  ? "Understanding..."
                  : Platform.OS === "web"
                    ? "Listening... speak now"
                    : "Listening... tap to stop"
                : loading
                  ? "..."
                  : "🎤 Tap and speak"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputBar}>
          {voiceInput && (
            <Pressable
              style={[styles.mic, listening === "dictate" && styles.micOn]}
              onPress={dictate}
            >
              <Text style={styles.micText}>🎤</Text>
            </Pressable>
          )}
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={`Write in ${language}...`}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendText(input)}
          />
          <Pressable
            style={[styles.send, (loading || !input.trim()) && styles.disabled]}
            disabled={loading || !input.trim()}
            onPress={() => sendText(input)}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f2f4f8" },
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "bold" },
  note: {
    fontSize: 15,
    color: "#555",
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 22,
  },
  label: { fontSize: 14, color: "#555", marginTop: 16, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#d5d9e0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: "#2a6fdb", borderColor: "#2a6fdb" },
  chipText: { fontSize: 15, color: "#333" },
  chipTextOn: { color: "white" },
  modeRow: { flexDirection: "row" },
  modeCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginRight: 8,
    borderWidth: 2,
    borderColor: "#d5d9e0",
  },
  modeOn: { borderColor: "#2a6fdb", backgroundColor: "#f3f7ff" },
  modeTitle: { fontSize: 17, fontWeight: "bold" },
  modeText: { fontSize: 13, color: "#555", marginTop: 4, lineHeight: 18 },
  small: { fontSize: 13, color: "#666", marginTop: 12, lineHeight: 19 },
  error: { marginTop: 12, color: "#c0392b", lineHeight: 20 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "white", fontSize: 18 },
  disabled: { opacity: 0.5 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#d5d9e0",
  },
  headerName: { fontSize: 17, fontWeight: "bold" },
  headerSub: { fontSize: 12, color: "#666", marginTop: 2 },
  smallButton: {
    backgroundColor: "#dbe7ff",
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 6,
  },
  smallButtonText: { color: "#2a6fdb", fontSize: 12 },

  messages: { padding: 12 },
  userWrap: { alignItems: "flex-end", marginBottom: 12 },
  userBubble: {
    backgroundColor: "#2a6fdb",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: "85%",
  },
  userText: { color: "white", fontSize: 16, lineHeight: 22 },
  correction: {
    backgroundColor: "#fff7e0",
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    maxWidth: "85%",
  },
  correctionText: { color: "#7a5b00", fontSize: 14, lineHeight: 20 },

  aiWrap: { alignItems: "flex-start", marginBottom: 14 },
  aiBubble: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: "90%",
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  aiText: { fontSize: 18, lineHeight: 26 },
  pron: { fontSize: 14, color: "#666", marginTop: 4 },
  translation: { fontSize: 15, color: "#2a6fdb", marginTop: 8, lineHeight: 21 },
  actions: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  action: {
    backgroundColor: "#dbe7ff",
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  actionText: { color: "#2a6fdb", fontSize: 13 },
  practice: {
    backgroundColor: "#eef6ee",
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    maxWidth: "90%",
  },
  practiceLine: { fontSize: 14, lineHeight: 20 },
  practiceNote: { fontSize: 12, color: "#666", marginTop: 6, lineHeight: 17 },
  typing: { color: "#666", marginTop: 4 },

  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#d5d9e0",
  },
  mic: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#dbe7ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  micOn: { backgroundColor: "#ffd6d6" },
  micText: { fontSize: 18 },
  textInput: {
    flex: 1,
    backgroundColor: "#f2f4f8",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  send: {
    backgroundColor: "#2a6fdb",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 6,
  },
  sendText: { color: "white", fontSize: 16 },

  voiceBar: {
    padding: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#d5d9e0",
  },
  talk: {
    backgroundColor: "#2a6fdb",
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: "center",
  },
  talkOn: { backgroundColor: "#d9534f" },
  talkText: { color: "white", fontSize: 18 },
});
