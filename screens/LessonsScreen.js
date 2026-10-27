import ChoiceList, { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { USER_ID } from "../config";
import { API_URL } from "../config";

export default function LessonsScreen({ navigation, route }) {
  const { unitId, language } = route.params;
  const { data, error } = useFetch(`/lessons?unit=${unitId}&user=${USER_ID}`);

  if (error) return <Message text={error} />;
  if (!data) return <Message text="Loading..." />;

  const items = data.map((lesson) => ({
    key: lesson.id,
    label: lesson.completed ? `✓ ${lesson.title}` : lesson.title,
  }));

  return (
    <ChoiceList
      title="Choose a lesson"
      items={items}
      emptyText="No lessons yet."
      onPick={(item) =>
        navigation.navigate("Flashcards", { lessonId: item.key, language })
      }
    />
  );
}


// Returns null if the lesson is ready, or an error message
async function prepareLesson(lesson) {
  if (lesson.status === "ready") return null;
  try {
    const res = await fetch(`${API_URL}/lessons/${lesson.id}/generate`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) return data.error || "Could not prepare this lesson.";
    if (data.status === "busy")
      return "This lesson is being prepared. Try again in a moment.";
    return null;
  } catch (e) {
    return "Could not reach the server.";
  }
}