import ChoiceList, { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { USER_ID } from "../config";

export default function UnitsScreen({ navigation, route }) {
  const { language, level } = route.params;
  const { data, error } = useFetch(
    `/units?language=${encodeURIComponent(language)}&level=${encodeURIComponent(level)}&user=${USER_ID}`,
  );
  const { data: course } = useFetch(
    `/hsk/course?language=${encodeURIComponent(language)}&level=${encodeURIComponent(level)}`,
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
  const intro = course
    ? `${course.standard}\n${course.label}: ${course.totalWords.toLocaleString()} new vocabulary items across ${course.lessonCount} lessons. This stage builds toward ${course.cumulativeTarget.toLocaleString()} cumulative HSK words. ${course.prerequisite || ""}\n\n${course.grades.map((grade) => `${grade.title}\n${grade.skills.join(" · ")}\nOfficial exam format: ${grade.exam}`).join("\n\n")}\n\nLessons provide guided practice and review; official exam formats are shown as a study roadmap, not as a full timed mock exam.`
    : null;

  return (
    <ChoiceList
      title={`${language} - ${level}`}
      intro={intro}
      items={items}
      emptyText="No units for this level yet. Coming soon!"
        onPick={(item) => navigation.navigate('Lessons', { unitId: item.key, language })}
    />
  );
}
