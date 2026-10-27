import { StyleSheet, ScrollView } from "react-native";
import Tile from "../components/Tile";

export default function LearnScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Tile
        icon="📚"
        title="Curriculum"
        text="Choose a language, a level and a unit"
        onPress={() => navigation.navigate("Languages")}
      />
      <Tile
        icon="汉"
        title="Chinese characters"
        text="Stroke order, writing practice and tests"
        onPress={() => navigation.navigate("HanziHome")}
      />
      <Tile
        icon="✍️"
        title="How to write characters"
        text="The 8 basic strokes and the order rules"
        onPress={() => navigation.navigate("HanziStrokes")}
      />
      <Tile
        icon="📝"
        title="Test yourself"
        text="Meaning, pinyin, strokes and writing"
        onPress={() => navigation.navigate("HanziTest")}
      />
      <Tile
        icon="🌙"
        title="Sleep mode"
        text="Experimental"
        onPress={() => navigation.navigate("Sleep")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
});
