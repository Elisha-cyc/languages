import { StyleSheet, ScrollView } from "react-native";
import Tile from "../components/Tile";

export default function LearnScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Tile
        icon="📈"
        title="My progress"
        text="See your skills, completed lessons and words due for review"
        onPress={() => navigation.navigate("Progress")}
      />
      <Tile
        icon="🧭"
        title="Find my level"
        text="Take a short placement assessment and get a recommended starting level"
        onPress={() => navigation.navigate("Placement")}
      />
      <Tile
        icon="🏫"
        title="AI classroom"
        text="Enter your classroom, meet your teacher and practise speaking together"
        onPress={() => navigation.navigate("Teacher")}
      />
      <Tile
        icon="🎓"
        title="Complete language lesson"
        text="Learn vocabulary, grammar, listening, speaking, reading and writing"
        onPress={() => navigation.navigate("CourseLesson")}
      />
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
