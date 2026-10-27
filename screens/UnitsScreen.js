import ChoiceList, { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { USER_ID } from "../config";

export default function UnitsScreen({ navigation, route }) {
  const { language, level } = route.params;
  const { data, error } = useFetch(
    `/units?language=${encodeURIComponent(language)}&level=${encodeURIComponent(level)}&user=${USER_ID}`,
  );

  if (error) return <Message text={error} />;
  if (!data) return <Message text="Loading..." />;

  const items = data.map((unit) => ({
    key: unit.id,
    label: unit.title,
    sub: unit.locked
      ? "Locked: finish the previous unit"
      : `${unit.done} of ${unit.total} lessons done`,
    disabled: unit.locked,
  }));

  return (
    <ChoiceList
      title={`${language} - ${level}`}
      items={items}
      emptyText="No units for this level yet. Coming soon!"
        onPick={(item) => navigation.navigate('Lessons', { unitId: item.key, language })}
    />
  );
}
