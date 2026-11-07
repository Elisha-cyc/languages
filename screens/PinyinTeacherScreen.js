import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NATIVE_LANGUAGE } from "../config";
import { compareSpeech } from "../listen";
import { speakAndWait, stopSpeaking } from "../speech";
import { useQuietOnLeave } from "../useQuietOnLeave";
import { useVoice } from "../voice";

const LESSONS = {
  initials: [
    ["b", "bō", "波", "Close both lips, then release them gently without a strong puff of air."],
    ["p", "pō", "坡", "Close both lips, then release a strong puff of air."],
    ["m", "mō", "摸", "Keep your lips together and let the sound hum through your nose."],
    ["f", "fó", "佛", "Touch your top teeth lightly to your lower lip and blow."],
    ["d", "dé", "得", "Touch your tongue behind your top teeth and release without a strong puff."],
    ["t", "tè", "特", "Touch behind your top teeth and release with a strong puff of air."],
    ["n", "nǐ", "你", "Touch behind your top teeth and let the sound flow through your nose."],
    ["l", "le", "了", "Touch behind your top teeth and let the air flow around your tongue."],
    ["g", "gē", "哥", "Make a short sound at the back of your mouth without a strong puff."],
    ["k", "kē", "科", "Make a sound at the back of your mouth with a strong puff of air."],
    ["h", "hē", "喝", "Let air pass through the back of your throat."],
    ["j", "jī", "鸡", "Place your tongue near the front roof of your mouth; keep the sound light."],
    ["q", "qī", "七", "Make the j sound with a stronger puff of air."],
    ["x", "xī", "西", "Raise the front of your tongue close to the roof and let air hiss out."],
    ["zh", "zhī", "知", "Curl the tongue tip slightly back, then release."],
    ["ch", "chī", "吃", "Curl the tongue tip slightly back and release with a strong puff."],
    ["sh", "shì", "是", "Curl the tongue tip slightly back and let air pass around it."],
    ["r", "rì", "日", "Curl the tongue tip slightly back and voice the sound gently."],
    ["z", "zì", "字", "Keep the tongue near the front teeth and release a short, unaspirated sound."],
    ["c", "cì", "次", "Make the z sound with a strong puff of air."],
    ["s", "sì", "四", "Keep the tongue near the front teeth and let air hiss out."],
  ].map(([title, pinyin, character, cue]) => ({ title, pinyin, character, cue })),
  finals: [
    ["a", "ā", "啊", "Open your mouth wide and keep the vowel clear."],
    ["o", "ó", "哦", "Round your lips and make a relaxed vowel."],
    ["e", "è", "饿", "Keep the mouth relaxed; this vowel is made farther back than a."],
    ["i", "yī", "衣", "Smile slightly and make a high, clear vowel."],
    ["u", "wū", "乌", "Round your lips and make a high vowel."],
    ["ü", "yú", "鱼", "Say i while rounding your lips; keep the tongue forward."],
    ["ai", "ài", "爱", "Start open, then glide toward i."],
    ["ei", "ēi", "诶", "Start with e, then glide toward i."],
    ["ui", "duì", "对", "This final glides from u toward i."],
    ["ao", "hǎo", "好", "Start open and glide toward a rounded o."],
    ["ou", "kǒu", "口", "Start rounded and glide toward u."],
    ["iu", "liù", "六", "This final glides from i toward u."],
    ["ie", "xiè", "谢", "Start with i and glide toward e."],
    ["üe", "yuè", "月", "Round the lips for ü, then glide toward e."],
    ["er", "èr", "二", "Curl the tongue slightly back as you finish the vowel."],
    ["an", "ān", "安", "Start open, then close the sound through the nose."],
    ["en", "mén", "门", "Keep the mouth relaxed and finish with a nasal n."],
    ["in", "lín", "林", "Make a clear i, then finish with a nasal n."],
    ["un", "chūn", "春", "Round the vowel and finish with a nasal n."],
    ["ün", "yún", "云", "Say ü and finish with a nasal n."],
    ["ang", "máng", "忙", "Open the mouth, then finish with a nasal ng."],
    ["eng", "fēng", "风", "Keep the vowel back and finish with a nasal ng."],
    ["ing", "xīng", "星", "Make a clear i, then finish with a nasal ng."],
    ["ong", "dōng", "东", "Round the vowel and finish with a nasal ng."],
  ].map(([title, pinyin, character, cue]) => ({ title, pinyin, character, cue })),
  tones: [
    { title: "First tone", pinyin: "mā", character: "妈", contour: "55  ˉ", cue: "Keep your voice high and level, like holding one steady note." },
    { title: "Second tone", pinyin: "má", character: "麻", contour: "35  ˊ", cue: "Start in the middle and glide upward, like asking ‘huh?’" },
    { title: "Third tone", pinyin: "mǎ", character: "马", contour: "214  ˇ", cue: "Start low, dip, then rise. In normal speech it often stays low." },
    { title: "Fourth tone", pinyin: "mà", character: "骂", contour: "51  ˋ", cue: "Start high and fall sharply, like a firm command." },
    { title: "Neutral tone", pinyin: "ma", character: "吗", contour: "light  ·", cue: "Say it briefly and lightly, without a full tone contour." },
  ],
};

const CATEGORIES = [
  { id: "initials", label: "Initials 声母" },
  { id: "finals", label: "Finals 韵母" },
  { id: "tones", label: "Tones 声调" },
];

export default function PinyinTeacherScreen() {
  const [category, setCategory] = useState("initials");
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);
  const voice = useVoice("Mandarin Chinese");
  const item = LESSONS[category][index];
  const explanationLanguage = NATIVE_LANGUAGE || "English";

  useQuietOnLeave(() => {
    stopSpeaking();
    voice.cancel();
  });

  function chooseCategory(nextCategory) {
    voice.cancel();
    stopSpeaking();
    setCategory(nextCategory);
    setIndex(0);
    setFeedback(null);
    setError(null);
  }

  async function hearTeacher() {
    voice.cancel();
    setError(null);
    await speakAndWait(item.cue, explanationLanguage);
    await speakAndWait(item.character, "Mandarin Chinese", { rate: 0.75 });
  }

  function repeatAfterTeacher() {
    if (voice.state === "listening") {
      voice.toggle({});
      return;
    }

    stopSpeaking();
    setFeedback(null);
    setError(null);
    voice.toggle({
      onText: (heard) => {
        const comparison = compareSpeech(
          item.character,
          heard,
          "Mandarin Chinese",
        );
        setFeedback({ heard, understood: comparison.score >= 80 });
      },
      onError: setError,
    });
  }

  function move(offset) {
    voice.cancel();
    stopSpeaking();
    setIndex((current) =>
      Math.max(0, Math.min(LESSONS[category].length - 1, current + offset)),
    );
    setFeedback(null);
    setError(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Chinese pinyin teacher</Text>
      <Text style={styles.note}>
        Hear a model, learn how to form the sound, then repeat it. Work through
        initials, finals, and all four tones. This is the pronunciation
        foundation for the HSK 1 Chinese course.
      </Text>

      <View style={styles.categories}>
        {CATEGORIES.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={() => chooseCategory(entry.id)}
            style={[
              styles.category,
              category === entry.id && styles.categoryOn,
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                category === entry.id && styles.categoryTextOn,
              ]}
            >
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.progress}>
        {CATEGORIES.find((entry) => entry.id === category)?.label} · {index + 1} of {LESSONS[category].length}
      </Text>

      <View style={styles.card}>
        <Text style={styles.sound}>{item.title}</Text>
        <Text style={styles.pinyin}>{item.pinyin}</Text>
        <Text style={styles.character}>{item.character}</Text>
        {category === "tones" ? (
          <Text style={styles.contour}>{item.contour}</Text>
        ) : null}
        <Text style={styles.cue}>{item.cue}</Text>
      </View>

      <Pressable style={styles.secondaryButton} onPress={hearTeacher}>
        <Text style={styles.secondaryText}>🔊 Hear the teacher</Text>
      </Pressable>

      <Pressable
        style={[styles.button, voice.state === "listening" && styles.listening]}
        onPress={repeatAfterTeacher}
        disabled={voice.state === "working"}
      >
        {voice.state === "working" ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>
            {voice.state === "listening" ? "⏹ Tap when finished" : "🎤 Repeat after the teacher"}
          </Text>
        )}
      </Pressable>

      {feedback ? (
        <Text style={[styles.feedback, feedback.understood ? styles.good : styles.tryAgain]}>
          {feedback.understood
            ? `I heard ${feedback.heard}. Good repetition!`
            : `I heard ${feedback.heard || "something different"}. Listen again and try once more.`}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {category === "tones" ? (
        <Text style={styles.caution}>
          Tone contours are shown as a guide. Speech recognition can identify
          the syllable, but it does not reliably score your tone.
        </Text>
      ) : null}

      <View style={styles.navigation}>
        <Pressable
          style={[styles.navButton, index === 0 && styles.disabled]}
          onPress={() => move(-1)}
          disabled={index === 0}
        >
          <Text style={styles.navText}>‹ Previous</Text>
        </Pressable>
        <Pressable
          style={[
            styles.navButton,
            index === LESSONS[category].length - 1 && styles.disabled,
          ]}
          onPress={() => move(1)}
          disabled={index === LESSONS[category].length - 1}
        >
          <Text style={styles.navText}>Next ›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: "#f2f4f8" },
  title: { fontSize: 25, fontWeight: "bold" },
  note: { color: "#555", lineHeight: 21, marginTop: 8 },
  categories: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, gap: 8 },
  category: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#cfd5df",
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  categoryOn: { backgroundColor: "#2a6fdb", borderColor: "#2a6fdb" },
  categoryText: { color: "#344054", fontWeight: "600" },
  categoryTextOn: { color: "white" },
  progress: { color: "#667085", fontSize: 13, marginTop: 18, marginBottom: 8 },
  card: {
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d5d9e0",
    padding: 22,
  },
  sound: { color: "#667085", fontSize: 16, fontWeight: "700" },
  pinyin: { color: "#2a6fdb", fontSize: 36, fontWeight: "700", marginTop: 5 },
  character: { color: "#1d2939", fontSize: 64, marginTop: 3 },
  contour: { color: "#8b5cf6", fontSize: 25, fontWeight: "700", marginTop: 2 },
  cue: { color: "#475467", fontSize: 16, lineHeight: 23, textAlign: "center", marginTop: 14 },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#dbe7ff",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  secondaryText: { color: "#245bb0", fontSize: 16, fontWeight: "700" },
  button: { alignItems: "center", backgroundColor: "#2a6fdb", borderRadius: 12, padding: 15, marginTop: 10 },
  listening: { backgroundColor: "#c0392b" },
  buttonText: { color: "white", fontSize: 16, fontWeight: "700" },
  feedback: { fontSize: 15, lineHeight: 22, marginTop: 12 },
  good: { color: "#16794b" },
  tryAgain: { color: "#9a6700" },
  error: { color: "#c0392b", fontSize: 14, lineHeight: 20, marginTop: 12 },
  caution: { color: "#667085", fontSize: 13, lineHeight: 19, marginTop: 14 },
  navigation: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  navButton: { paddingVertical: 11, paddingHorizontal: 16 },
  navText: { color: "#2a6fdb", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.35 },
});
