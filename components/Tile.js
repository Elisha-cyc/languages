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
    borderRadius: 17,
    padding: 17,
    marginTop: 11,
    borderWidth: 1,
    borderColor: "#e5ebf2",
  },
  icon: { fontSize: 28, width: 44 },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: "800", color: "#19334f" },
  text: { fontSize: 12, color: "#718096", marginTop: 4, lineHeight: 18 },
  arrow: { fontSize: 25, color: "#8da1b4" },
});
