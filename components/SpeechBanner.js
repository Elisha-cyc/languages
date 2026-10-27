import { useEffect, useState } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { onSpeechProblem } from "../speech";

export default function SpeechBanner() {
  const [message, setMessage] = useState(null);

  useEffect(() => onSpeechProblem(setMessage), []);

  if (!message) return null;

  return (
    <Pressable style={styles.bar} onPress={() => setMessage(null)}>
      <Text style={styles.text}>{message} (tap to hide)</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#fff3cd",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: { color: "#7a5b00", fontSize: 14, lineHeight: 20 },
});
