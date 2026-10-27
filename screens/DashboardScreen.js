import { StyleSheet, Text, ScrollView } from "react-native";
import { useAuth } from "../auth";
import Tile from "../components/Tile";

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hello}>Hello, {user.name}</Text>
      <Text style={styles.sub}>What would you like to do today?</Text>

      <Tile
        icon="📚"
        title="Follow the curriculum"
        text="Lessons for all 20 languages"
        onPress={() => navigation.navigate("Languages")}
      />
      <Tile
        icon="汉"
        title="Chinese characters"
        text="Learn, write and test"
        onPress={() => navigation.navigate("HanziHome")}
      />
      <Tile
        icon="💬"
        title="Talk to an AI partner"
        text="Text or voice conversation"
        onPress={() => navigation.navigate("ChatTab")}
      />
      <Tile
        icon="📖"
        title="Read a book"
        text="Free books read with your tutor"
        onPress={() => navigation.navigate("Books", { title: "" })}
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
  hello: { fontSize: 26, fontWeight: "bold", marginTop: 8 },
  sub: { fontSize: 15, color: "#666", marginTop: 4, marginBottom: 8 },
});
