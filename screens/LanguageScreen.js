import { StyleSheet, Text, Pressable, ScrollView } from "react-native";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";

export default function LanguageScreen({ navigation }) {
  const { data, error } = useFetch("/languages");

  if (error) return <Message text={error} />;
  if (!data) return <Message text="Loading..." />;
  if (!Array.isArray(data))
    return <Message text="Could not load the languages." />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {data.map((language) => (
        <Pressable
          key={language.name}
          style={styles.card}
          onPress={() =>
            navigation.navigate("Levels", { language: language.name })
          }
        >
          <Text style={styles.name}>{language.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: "center",
    backgroundColor: "#f2f4f8",
    flexGrow: 1,
  },
  card: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: "#2a6fdb",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  name: { color: "white", fontSize: 18 },
});
