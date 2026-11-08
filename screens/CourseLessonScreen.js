import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { API_URL, NATIVE_LANGUAGE } from "../config";
import LanguagePicker from "../components/LanguagePicker";
import { speak, speakAndWait, stopSpeaking } from "../speech";
import { useVoice } from "../voice";
import { useQuietOnLeave } from "../useQuietOnLeave";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const TOPICS = [
  "Greetings and introducing yourself",
  "Family, friends and relationships",
  "Food, ordering and restaurants",
  "Shopping, prices and money",
  "Travel, transport and directions",
  "Daily routines and free time",
  "Education and learning",
  "Work and professional life",
  "Health and wellbeing",
  "Culture, opinions and society",
  "Technology and the modern world",
  "Stories, experiences and memories",
];

function Section({ title, subtitle, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function QuestionSet({ title, questions, answers, setAnswers, checked, setChecked }) {
  if (!questions?.length) return null;
  const score = questions.filter((q, i) => answers[title + i] === String(q.answerIndex)).length;
  return (
    <Section title={title}>
      {questions.map((question, index) => {
        const key = title + index;
        const selected = answers[key];
        const isChecked = checked[title];
        return (
          <View key={key} style={styles.question}>
            <Text style={styles.questionTitle}>{index + 1}. {question.question}</Text>
            {question.options.map((option, optionIndex) => {
              const correct = optionIndex === question.answerIndex;
              const chosen = selected === String(optionIndex);
              return (
                <Pressable
                  key={optionIndex}
                  disabled={!!isChecked}
                  onPress={() => setAnswers((old) => ({ ...old, [key]: String(optionIndex) }))}
                  style={[
                    styles.option,
                    chosen && styles.optionSelected,
                    isChecked && correct && styles.optionCorrect,
                    isChecked && chosen && !correct && styles.optionWrong,
                  ]}
                >
                  <Text style={styles.optionText}>{String.fromCharCode(65 + optionIndex)}. {option}</Text>
                </Pressable>
              );
            })}
            {isChecked ? (
              <Text style={styles.explanation}>
                {selected === String(question.answerIndex) ? "Correct. " : "Not quite. "}
                {question.explanation}
              </Text>
            ) : null}
          </View>
        );
      })}
      {!checked[title] ? (
        <Pressable
          style={styles.secondaryButton}
          disabled={questions.some((_, i) => answers[title + i] === undefined)}
          onPress={() => setChecked((old) => ({ ...old, [title]: true }))}
        >
          <Text style={styles.secondaryText}>Check {title.toLowerCase()}</Text>
        </Pressable>
      ) : (
        <Text style={styles.scoreLine}>Score: {score} / {questions.length}</Text>
      )}
    </Section>
  );
}

export default function CourseLessonScreen() {
  const [language, setLanguage] = useState("French");
  const [level, setLevel] = useState("Beginner");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});
  const [writing, setWriting] = useState("");
  const [speakingTranscript, setSpeakingTranscript] = useState("");
  const [feedback, setFeedback] = useState({ writing: null, speaking: null });
  const [feedbackBusy, setFeedbackBusy] = useState("");
  const voice = useVoice(language);
  useQuietOnLeave(() => { stopSpeaking(); voice.cancel(); });

  async function generate() {
    stopSpeaking();
    voice.cancel();
    setLoading(true);
    setError("");
    setLesson(null);
    setAnswers({});
    setChecked({});
    setWriting("");
    setSpeakingTranscript("");
    setFeedback({ writing: null, speaking: null });
    try {
      const response = await fetch(API_URL + "/course/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, level, topic }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare the lesson.");
      if (!data.lesson) throw new Error("The lesson response was incomplete.");
      setLesson(data.lesson);
    } catch (e) {
      setError(e.message || "Could not prepare the lesson.");
    } finally {
      setLoading(false);
    }
  }

  async function requestFeedback(kind, responseText, prompt, modelAnswer) {
    if (!responseText.trim()) {
      setError("Please enter or record your answer first.");
      return;
    }
    setFeedbackBusy(kind);
    setError("");
    try {
      const response = await fetch(API_URL + "/course/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language, level, kind, prompt, response: responseText, modelAnswer,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not assess your answer.");
      setFeedback((old) => ({ ...old, [kind]: data }));
    } catch (e) {
      setError(e.message || "Could not assess your answer.");
    } finally {
      setFeedbackBusy("");
    }
  }

  function play(text, rate = 1) {
    if (text) speak(text, language, { rate });
  }

  if (!lesson) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your language course</Text>
        <Text style={styles.intro}>
          Build practical skills with a complete lesson: vocabulary, grammar, conversation,
          listening, reading, speaking, writing and a knowledge check.
        </Text>
        <Text style={styles.label}>Language to learn</Text>
        <LanguagePicker value={language} onChange={setLanguage} />
        <Text style={styles.label}>Your current level</Text>
        <View style={styles.chips}>
          {LEVELS.map((item) => (
            <Pressable key={item} onPress={() => setLevel(item)} style={[styles.chip, level === item && styles.chipOn]}>
              <Text style={[styles.chipText, level === item && styles.chipTextOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>What do you want to learn?</Text>
        {TOPICS.map((item) => (
          <Pressable key={item} onPress={() => setTopic(item)} style={[styles.topic, topic === item && styles.topicOn]}>
            <Text style={[styles.topicText, topic === item && styles.topicTextOn]}>{item}</Text>
          </Pressable>
        ))}
        <Pressable style={[styles.primaryButton, loading && styles.disabled]} onPress={generate} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Create my complete lesson</Text>}
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    );
  }

  const allQuestions = [
    ...(lesson.listening.questions || []),
    ...(lesson.reading.questions || []),
    ...(lesson.review || []),
  ];
  const completedQuestions = allQuestions.filter((_, i) => checked[
    i < lesson.listening.questions.length ? "Listening" :
      i < lesson.listening.questions.length + lesson.reading.questions.length ? "Reading" : "Review"
  ]).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>{language.toUpperCase()} · {level.toUpperCase()}</Text>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.intro}>Work through each section. Listen, repeat, understand, then produce the language yourself.</Text>

      <Section title="Learning goals">
        {lesson.objectives.map((item, i) => <Text key={i} style={styles.bullet}>• {item}</Text>)}
      </Section>

      <Section title="Vocabulary" subtitle="Listen to each item, then practise using it in your own sentence.">
        {lesson.vocabulary.map((item, i) => (
          <View key={i} style={styles.wordCard}>
            <View style={styles.wordHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.word}>{item.term}</Text>
                {item.pronunciation ? <Text style={styles.pronunciation}>{item.pronunciation}</Text> : null}
                <Text style={styles.meaning}>{item.meaning}</Text>
              </View>
              <Pressable style={styles.audioButton} onPress={() => play(item.term)}>
                <Text style={styles.audioText}>🔊</Text>
              </Pressable>
            </View>
            <Text style={styles.example}>{item.example}</Text>
            <Text style={styles.muted}>{item.exampleTranslation}</Text>
            <Pressable onPress={() => play(item.example)}><Text style={styles.inlineLink}>Listen to example</Text></Pressable>
          </View>
        ))}
      </Section>

      <Section title="Grammar" subtitle="Understand the pattern, then notice it in the examples.">
        {lesson.grammar.map((item, i) => (
          <View key={i} style={styles.wordCard}>
            <Text style={styles.subTitle}>{item.name}</Text>
            <Text style={styles.body}>{item.explanation}</Text>
            <Text style={styles.pattern}>{item.pattern}</Text>
            {item.examples.map((example, j) => (
              <View key={j} style={styles.exampleBox}>
                <Text style={styles.example}>{example.target}</Text>
                {example.pronunciation ? <Text style={styles.pronunciation}>{example.pronunciation}</Text> : null}
                <Text style={styles.muted}>{example.translation}</Text>
                <Pressable onPress={() => play(example.target)}><Text style={styles.inlineLink}>Listen</Text></Pressable>
              </View>
            ))}
          </View>
        ))}
      </Section>

      <Section title="Conversation practice" subtitle="Listen to both speakers. Repeat each line and practise the dialogue with a partner or the AI tutor.">
        {lesson.dialogue.map((item, i) => (
          <View key={i} style={styles.dialogueRow}>
            <Text style={styles.speaker}>{item.speaker}</Text>
            <Text style={styles.example}>{item.text}</Text>
            {item.pronunciation ? <Text style={styles.pronunciation}>{item.pronunciation}</Text> : null}
            <Text style={styles.muted}>{item.translation}</Text>
            <Pressable onPress={() => play(item.text)}><Text style={styles.inlineLink}>🔊 Play line</Text></Pressable>
          </View>
        ))}
        <Pressable style={styles.secondaryButton} onPress={() => speakAndWait(lesson.dialogue.map((line) => line.text).join(". "), language)}>
          <Text style={styles.secondaryText}>Play full conversation</Text>
        </Pressable>
      </Section>

      <Section title="Listening comprehension" subtitle={lesson.listening.instruction}>
        <Pressable style={styles.audioWide} onPress={() => speak(lesson.listening.script, language)}>
          <Text style={styles.audioWideText}>🔊 Listen to the passage</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => speak(lesson.listening.script, language, { rate: 0.75 })}>
          <Text style={styles.secondaryText}>Play slowly</Text>
        </Pressable>
        <Text style={styles.body}>{lesson.listening.script}</Text>
        <QuestionSet title="Listening" questions={lesson.listening.questions} answers={answers} setAnswers={setAnswers} checked={checked} setChecked={setChecked} />
      </Section>

      <Section title="Reading comprehension" subtitle={lesson.reading.instruction}>
        <Text style={styles.reading}>{lesson.reading.text}</Text>
        <Pressable onPress={() => play(lesson.reading.text)}><Text style={styles.inlineLink}>🔊 Listen while reading</Text></Pressable>
        <Text style={styles.subTitle}>Translation</Text>
        <Text style={styles.body}>{lesson.reading.translation}</Text>
        <QuestionSet title="Reading" questions={lesson.reading.questions} answers={answers} setAnswers={setAnswers} checked={checked} setChecked={setChecked} />
      </Section>

      <Section title="Speaking challenge" subtitle="Answer in your own words. Speak naturally; do not just repeat the model.">
        <Text style={styles.body}>{lesson.speaking.prompt}</Text>
        <Text style={styles.muted}>Useful phrases</Text>
        {lesson.speaking.usefulPhrases.map((item, i) => <Text key={i} style={styles.bullet}>• {item}</Text>)}
        <Text style={styles.label}>Your spoken answer</Text>
        <Pressable style={[styles.primaryButton, voice.state !== "idle" && styles.disabled]} disabled={voice.state !== "idle"} onPress={() => voice.toggle({
          onText: (heard) => setSpeakingTranscript((old) => old ? old + " " + heard : heard),
          onError: setError,
        })}>
          <Text style={styles.primaryText}>{voice.state === "listening" ? "Listening…" : "🎤 Record your answer"}</Text>
        </Pressable>
        <Text style={styles.body}>{speakingTranscript || "Your recognised speech will appear here."}</Text>
        <TextInput value={speakingTranscript} onChangeText={setSpeakingTranscript} placeholder="You can also type your answer…" multiline style={styles.input} />
        <Pressable style={styles.secondaryButton} onPress={() => requestFeedback("speaking", speakingTranscript, lesson.speaking.prompt, lesson.speaking.modelAnswer)} disabled={feedbackBusy === "speaking"}>
          <Text style={styles.secondaryText}>{feedbackBusy === "speaking" ? "Assessing…" : "Assess my speaking answer"}</Text>
        </Pressable>
        {feedback.speaking ? <FeedbackView data={feedback.speaking} /> : null}
        <Text style={styles.subTitle}>Example answer</Text>
        <Text style={styles.body}>{lesson.speaking.modelAnswer}</Text>
        <Pressable onPress={() => play(lesson.speaking.modelAnswer)}><Text style={styles.inlineLink}>🔊 Hear example answer</Text></Pressable>
      </Section>

      <Section title="Writing challenge" subtitle="Write your own answer before looking at the model.">
        <Text style={styles.body}>{lesson.writing.prompt}</Text>
        {lesson.writing.requirements.map((item, i) => <Text key={i} style={styles.bullet}>• {item}</Text>)}
        <TextInput value={writing} onChangeText={setWriting} placeholder="Write your answer here…" multiline style={[styles.input, styles.writingInput]} />
        <Pressable style={styles.secondaryButton} onPress={() => requestFeedback("writing", writing, lesson.writing.prompt, lesson.writing.modelAnswer)} disabled={feedbackBusy === "writing"}>
          <Text style={styles.secondaryText}>{feedbackBusy === "writing" ? "Assessing…" : "Correct my writing"}</Text>
        </Pressable>
        {feedback.writing ? <FeedbackView data={feedback.writing} /> : null}
        <Text style={styles.subTitle}>Example answer</Text>
        <Text style={styles.body}>{lesson.writing.modelAnswer}</Text>
      </Section>

      <QuestionSet title="Review" questions={lesson.review} answers={answers} setAnswers={setAnswers} checked={checked} setChecked={setChecked} />
      <Section title="Lesson complete">
        <Text style={styles.body}>You have worked through vocabulary, grammar, conversation, listening, reading, speaking and writing. Review any questions you missed and repeat the speaking and writing tasks later.</Text>
        <Text style={styles.scoreLine}>Sections checked: {Object.keys(checked).length} · Question groups available: {allQuestions.length > 0 ? 3 : 0}</Text>
        <Pressable style={styles.primaryButton} onPress={() => { stopSpeaking(); voice.cancel(); setLesson(null); }}>
          <Text style={styles.primaryText}>Choose another lesson</Text>
        </Pressable>
      </Section>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.disclaimer}>AI feedback is formative practice guidance, not an official language-proficiency score. Speech transcription does not independently measure accent or intonation.</Text>
    </ScrollView>
  );
}

function FeedbackView({ data }) {
  return (
    <View style={styles.feedback}>
      <Text style={styles.subTitle}>Practice score: {data.score}/100</Text>
      <Text style={styles.muted}>{data.scoreNote}</Text>
      {data.strengths.map((item, i) => <Text key={"s" + i} style={styles.bullet}>✓ {item}</Text>)}
      {data.corrections.map((item, i) => (
        <View key={"c" + i} style={styles.exampleBox}>
          <Text style={styles.body}>You wrote/said: {item.original}</Text>
          <Text style={styles.example}>Better: {item.corrected}</Text>
          <Text style={styles.muted}>{item.explanation}</Text>
        </View>
      ))}
      <Text style={styles.body}>Next practice: {data.nextPractice}</Text>
      <Text style={styles.example}>{data.improvedExample}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, paddingBottom: 40, backgroundColor: "#f3f5f9" },
  title: { fontSize: 27, fontWeight: "800", color: "#172b4d", marginBottom: 8 },
  eyebrow: { color: "#2a6fdb", fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  intro: { color: "#566176", lineHeight: 22, marginBottom: 16 },
  label: { fontWeight: "700", color: "#344054", marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: { borderWidth: 1, borderColor: "#cbd3df", borderRadius: 22, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: "white", marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: "#245ec7", borderColor: "#245ec7" },
  chipText: { color: "#344054" },
  chipTextOn: { color: "white", fontWeight: "700" },
  topic: { backgroundColor: "white", borderWidth: 1, borderColor: "#e0e5ed", borderRadius: 10, padding: 13, marginBottom: 8 },
  topicOn: { backgroundColor: "#eaf1ff", borderColor: "#2a6fdb" },
  topicText: { color: "#344054" },
  topicTextOn: { color: "#1d4fa3", fontWeight: "700" },
  primaryButton: { backgroundColor: "#245ec7", padding: 15, borderRadius: 11, alignItems: "center", marginTop: 12 },
  primaryText: { color: "white", fontWeight: "800", fontSize: 16 },
  secondaryButton: { borderWidth: 1, borderColor: "#245ec7", padding: 12, borderRadius: 10, alignItems: "center", marginTop: 10, backgroundColor: "white" },
  secondaryText: { color: "#245ec7", fontWeight: "700" },
  disabled: { opacity: 0.5 },
  section: { backgroundColor: "white", borderRadius: 14, padding: 15, marginTop: 14, borderWidth: 1, borderColor: "#e1e6ee" },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#172b4d", marginBottom: 7 },
  subTitle: { fontSize: 16, fontWeight: "800", color: "#344054", marginTop: 9, marginBottom: 6 },
  body: { color: "#344054", fontSize: 15, lineHeight: 23, marginTop: 5 },
  muted: { color: "#687386", fontSize: 13, lineHeight: 19, marginTop: 4 },
  bullet: { color: "#344054", fontSize: 14, lineHeight: 21, marginTop: 5 },
  wordCard: { borderTopWidth: 1, borderColor: "#edf0f4", paddingVertical: 12 },
  wordHeader: { flexDirection: "row", alignItems: "center" },
  word: { fontSize: 22, fontWeight: "800", color: "#172b4d" },
  pronunciation: { color: "#2a6fdb", fontSize: 15, marginTop: 2 },
  meaning: { color: "#344054", fontSize: 15, marginTop: 3 },
  example: { color: "#172b4d", fontSize: 16, lineHeight: 23, marginTop: 9 },
  exampleBox: { backgroundColor: "#f7f9fc", padding: 11, borderRadius: 9, marginTop: 8 },
  pattern: { color: "#245ec7", fontWeight: "700", marginTop: 8 },
  audioButton: { backgroundColor: "#eaf1ff", borderRadius: 24, padding: 12, marginLeft: 10 },
  audioText: { fontSize: 18 },
  inlineLink: { color: "#245ec7", fontWeight: "700", marginTop: 8 },
  dialogueRow: { borderBottomWidth: 1, borderColor: "#edf0f4", paddingVertical: 10 },
  speaker: { color: "#687386", fontWeight: "700", fontSize: 12 },
  audioWide: { backgroundColor: "#eaf1ff", padding: 14, borderRadius: 10, marginTop: 10 },
  audioWideText: { color: "#245ec7", fontWeight: "800", textAlign: "center" },
  reading: { color: "#172b4d", fontSize: 17, lineHeight: 27, marginTop: 8 },
  input: { backgroundColor: "white", borderWidth: 1, borderColor: "#cbd3df", borderRadius: 10, padding: 12, minHeight: 88, marginTop: 10, textAlignVertical: "top", fontSize: 16 },
  writingInput: { minHeight: 150 },
  question: { borderTopWidth: 1, borderColor: "#edf0f4", paddingVertical: 12 },
  questionTitle: { fontWeight: "700", color: "#344054", lineHeight: 21, marginBottom: 8 },
  option: { borderWidth: 1, borderColor: "#d9e0e9", padding: 10, borderRadius: 8, marginBottom: 6 },
  optionSelected: { borderColor: "#245ec7", backgroundColor: "#edf3ff" },
  optionCorrect: { borderColor: "#27945c", backgroundColor: "#eaf7ef" },
  optionWrong: { borderColor: "#c65b50", backgroundColor: "#fff0ee" },
  optionText: { color: "#344054", lineHeight: 20 },
  explanation: { color: "#526175", lineHeight: 20, marginTop: 7 },
  scoreLine: { fontWeight: "800", color: "#245ec7", marginTop: 12 },
  question: { borderTopWidth: 1, borderColor: "#edf0f4", paddingVertical: 12 },
  feedback: { backgroundColor: "#f7f9fc", padding: 12, borderRadius: 10, marginTop: 10 },
  error: { color: "#b42318", marginTop: 12 },
  disclaimer: { color: "#7a8494", fontSize: 12, lineHeight: 18, marginTop: 18 },
});
