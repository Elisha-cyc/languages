import { StyleSheet, Text, View, Pressable } from "react-native";

export default function Tile({ icon, title, text, onPress }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {text ? <Text style={styles.text}>{text}</Text> : null}
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  icon: { fontSize: 28, width: 44 },
  body: { flex: 1 },
  title: { fontSize: 17, fontWeight: "bold" },
  text: { fontSize: 13, color: "#666", marginTop: 2 },
  arrow: { fontSize: 24, color: "#9aa3b2" },
});
