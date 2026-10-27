import { useState, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Message } from "../components/ChoiceList";
import { API_URL, USER_ID } from "../config";

export default function HanziHomeScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Reload every time the screen is shown, so progress is always current
  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetch(`${API_URL}/hanzi/home?user=${USER_ID}`)
        .then((res) => res.json())
        .then((body) => active && setData(body))
        .catch((e) => active && setError(e.message));
      return () => {
        active = false;
      };
    }, []),
  );

  if (error) return <Message text={error} />;
  if (!data) return <Message text="Loading..." />;
  if (!Array.isArray(data.lessons))
    return <Message text={data.error || "Could not load."} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>汉字 Chinese characters</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {data.learned} of {data.total} characters learned
        </Text>
        <Text style={styles.line}>
          {data.mastered} mastered (answered right 3 times or more)
        </Text>
        {data.review.length > 0 && (
          <Text style={styles.review}>To review: {data.review.join("  ")}</Text>
        )}
      </View>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("HanziStrokes")}
      >
        <Text style={styles.buttonText}>How to write: strokes and rules</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate("HanziTest")}
      >
        <Text style={styles.buttonText}>Test yourself</Text>
      </Pressable>

      <Text style={styles.heading}>Lessons</Text>
      {data.lessons.map((lesson) => (
        <Pressable
          key={lesson.id}
          style={styles.lesson}
          onPress={() =>
            navigation.navigate("HanziLesson", { lessonId: lesson.id })
          }
        >
          <Text style={styles.lessonTitle}>
            {lesson.id}. {lesson.title}
          </Text>
          <Text style={styles.lessonSub}>
            {lesson.learned} of {lesson.total} learned
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "bold" },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  cardTitle: { fontSize: 17, fontWeight: "bold" },
  line: { fontSize: 14, color: "#555", marginTop: 6 },
  review: { fontSize: 18, color: "#9a6700", marginTop: 8 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "white", fontSize: 17 },
  heading: { fontSize: 18, fontWeight: "bold", marginTop: 24, marginBottom: 4 },
  lesson: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  lessonTitle: { fontSize: 16, fontWeight: "bold" },
  lessonSub: { fontSize: 13, color: "#666", marginTop: 2 },
});
