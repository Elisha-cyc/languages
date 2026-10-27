import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";

export function Message({ text }) {
  return (
    <View style={styles.message}>
      <Text>{text}</Text>
    </View>
  );
}

export default function ChoiceList({ title, items, onPick, emptyText }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {items.length === 0 && <Text style={styles.empty}>{emptyText}</Text>}

      {items.map((item) => (
        <Pressable
          key={item.key}
          style={[styles.button, item.disabled && styles.disabled]}
          disabled={item.disabled}
          onPress={() => onPick(item)}
        >
          <Text style={styles.buttonText}>{item.label}</Text>
          {item.sub && <Text style={styles.sub}>{item.sub}</Text>}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  message: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f4f8",
    padding: 16,
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f4f8",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  empty: { fontSize: 16, color: "#666", textAlign: "center" },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 12,
    minWidth: 240,
    alignItems: "center",
  },
  disabled: { backgroundColor: "#9aa7b8" },
  buttonText: { color: "white", fontSize: 18 },
  sub: { color: "#eef3ff", fontSize: 13, marginTop: 2 },
});
