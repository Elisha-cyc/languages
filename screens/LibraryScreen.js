import { StyleSheet, ScrollView } from "react-native";
import Tile from "../components/Tile";

export default function LibraryScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Tile
        icon="🔎"
        title="Find a book"
        text="Free books in 20 languages"
        onPress={() => navigation.navigate("Books", { title: "" })}
      />
      <Tile
        icon="📄"
        title="Import a file"
        text="PDF, Word or text"
        onPress={() => navigation.navigate("Import")}
      />
      <Tile
        icon="📷"
        title="Read a page from a photo"
        text="Take a photo or choose one"
        onPress={() => navigation.navigate("Photo", { forTitle: false })}
      />
      <Tile
        icon="🧑‍🏫"
        title="AI tutor"
        text="Paste any text"
        onPress={() => navigation.navigate("Tutor")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
});
