import { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { speak, stopSpeaking } from "../speech";
import HanziWriter from "../components/HanziWriter";

export default function HanziStrokesScreen() {
  const { data, error } = useFetch("/hanzi/techniques");
  const [selected, setSelected] = useState({
    char: "一",
    label: "横 héng: horizontal",
  });
  const scroller = useRef(null);

  useEffect(() => stopSpeaking, []);

  if (error) return <Message text={error} />;
  if (!data) return <Message text="Loading..." />;
  if (!Array.isArray(data.strokes))
    return <Message text="Could not load this page." />;

  function watch(char, label) {
    setSelected({ char, label });
    if (scroller.current) scroller.current.scrollTo({ y: 0, animated: true });
  }

  return (
    <ScrollView ref={scroller} contentContainerStyle={styles.container}>
      <Text style={styles.title}>How to write Chinese characters</Text>

      <View style={styles.stage}>
        <Text style={styles.stageLabel}>
          {selected.char} · {selected.label}
        </Text>
        <HanziWriter
          key={selected.char}
          char={selected.char}
          mode="animate"
          size={220}
        />
      </View>

      <Text style={styles.heading}>The 8 basic strokes</Text>
      {data.strokes.map((stroke) => (
        <View key={stroke.name} style={styles.card}>
          <Text style={styles.cardTitle}>
            {stroke.name} {stroke.pinyin}: {stroke.english}
          </Text>
          <Text style={styles.text}>{stroke.how}</Text>
          <Pressable
            style={styles.watch}
            onPress={() =>
              watch(
                stroke.example,
                `${stroke.name} ${stroke.pinyin}: ${stroke.english}`,
              )
            }
          >
            <Text style={styles.watchText}>Watch in {stroke.example}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.heading}>Stroke order rules</Text>
      {data.rules.map((rule) => (
        <View key={rule.title} style={styles.card}>
          <Text style={styles.cardTitle}>{rule.title}</Text>
          <Text style={styles.text}>{rule.how}</Text>
          <Pressable
            style={styles.watch}
            onPress={() => watch(rule.example, rule.title)}
          >
            <Text style={styles.watchText}>Watch in {rule.example}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.heading}>Writing tips</Text>
      {data.tips.map((tip) => (
        <Text key={tip} style={styles.tip}>
          • {tip}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  title: { fontSize: 22, fontWeight: "bold" },
  stage: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  stageLabel: { fontSize: 16, fontWeight: "bold", marginTop: 4 },
  heading: { fontSize: 18, fontWeight: "bold", marginTop: 24, marginBottom: 4 },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  cardTitle: { fontSize: 17, fontWeight: "bold" },
  text: { fontSize: 15, color: "#555", marginTop: 4, lineHeight: 22 },
  watch: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "#dbe7ff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  watchText: { color: "#2a6fdb", fontSize: 14 },
  tip: { fontSize: 15, color: "#444", lineHeight: 23, marginTop: 6 },
});
