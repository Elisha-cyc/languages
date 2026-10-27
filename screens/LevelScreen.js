import ChoiceList, { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";

export default function LevelScreen({ navigation, route }) {
  const { language } = route.params;
  const { data, error } = useFetch("/levels");

  if (error) return <Message text={error} />;
  if (!data) return <Message text="Loading..." />;

  const items = data.map((level) => ({
    key: level.id,
    label: level.name,
    sub: level.cefr,
  }));

  return (
    <ChoiceList
      title={`${language}: what is your level?`}
      items={items}
      emptyText="No levels found."
      onPick={(item) =>
        navigation.navigate("Units", { language, level: item.label })
      }
    />
  );
}
