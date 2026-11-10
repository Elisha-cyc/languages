import { View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./auth";
import SpeechBanner from "./components/SpeechBanner";
import AuthScreen from "./screens/AuthScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ChineseAcademyScreen from "./screens/ChineseAcademyScreen";
import LearnScreen from "./screens/LearnScreen";
import LibraryScreen from "./screens/LibraryScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ChatScreen from "./screens/ChatScreen";
import LanguageScreen from "./screens/LanguageScreen";
import LevelScreen from "./screens/LevelScreen";
import UnitsScreen from "./screens/UnitsScreen";
import LessonsScreen from "./screens/LessonsScreen";
import FlashcardScreen from "./screens/FlashcardScreen";
import QuizScreen from "./screens/QuizScreen";
import ImportScreen from "./screens/ImportScreen";
import PhotoScreen from "./screens/PhotoScreen";
import BookSearchScreen from "./screens/BookSearchScreen";
import SleepHomeScreen from "./screens/SleepHomeScreen";
import SleepStudyScreen from "./screens/SleepStudyScreen";
import SleepEveningScreen from "./screens/SleepEveningScreen";
import SleepNightScreen from "./screens/SleepNightScreen";
import SleepMorningScreen from "./screens/SleepMorningScreen";
import SpeechCheckScreen from "./screens/SpeechCheckScreen";
import TutorScreen from "./screens/TutorScreen";
import HanziHomeScreen from "./screens/HanziHomeScreen";
import HanziLessonScreen from "./screens/HanziLessonScreen";
import HanziStrokesScreen from "./screens/HanziStrokesScreen";
import HanziWriteScreen from "./screens/HanziWriteScreen";
import HanziTestScreen from "./screens/HanziTestScreen";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { setAudioModeAsync } from "expo-audio";
import TeacherScreen from "./screens/TeacherScreen";
import PinyinTeacherScreen from "./screens/PinyinTeacherScreen";
import CourseLessonScreen from "./screens/CourseLessonScreen";
import PlacementScreen from "./screens/PlacementScreen";
import ProgressScreen from "./screens/ProgressScreen";
import { IntroAnimation, LoadingAnimation } from "./components/AppAnimation";
import withClassroom from "./components/withClassroom";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const icon = (emoji) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;


const ClassroomUnitsScreen = withClassroom(UnitsScreen, "Your course units");
const ClassroomImportScreen = withClassroom(ImportScreen, "Learn from your own material", "Bring a passage into class and study it with your teacher");
const ClassroomPhotoScreen = withClassroom(PhotoScreen, "Learn from a photo", "Your teacher will read, explain and teach the content");
const ClassroomBookSearchScreen = withClassroom(BookSearchScreen, "Reading classroom", "Choose a text and learn from it with guidance");
const ClassroomSleepHomeScreen = withClassroom(SleepHomeScreen, "Revision classroom", "Choose how your teacher will help you review");
const ClassroomSleepNightScreen = withClassroom(SleepNightScreen, "Night listening class", "Listen calmly and reinforce familiar material");

const ClassroomLearnScreen = withClassroom(LearnScreen, "Today's learning");
const ClassroomChatScreen = withClassroom(ChatScreen, "Conversation practice", "Speak with your teacher • Get corrections • Try again");
const ClassroomChineseAcademyScreen = withClassroom(ChineseAcademyScreen, "Chinese academy");
const ClassroomLessonsScreen = withClassroom(LessonsScreen, "Lesson library");
const ClassroomFlashcardScreen = withClassroom(FlashcardScreen, "Flashcard practice", "Recall • Reveal • Review");
const ClassroomQuizScreen = withClassroom(QuizScreen, "Knowledge check", "Show what you understand");
const ClassroomSleepStudyScreen = withClassroom(SleepStudyScreen, "Guided revision", "Listen again • Remember • Recall");
const ClassroomSleepEveningScreen = withClassroom(SleepEveningScreen, "Evening review", "Your teacher is checking today's learning");
const ClassroomSleepMorningScreen = withClassroom(SleepMorningScreen, "Morning recall", "Bring yesterday's learning back to mind");
const ClassroomSpeechCheckScreen = withClassroom(SpeechCheckScreen, "Pronunciation laboratory", "Listen to the model • Repeat clearly");
const ClassroomTutorScreen = withClassroom(TutorScreen, "Ask your teacher", "Ask questions • Explore examples • Learn");
const ClassroomHanziHomeScreen = withClassroom(HanziHomeScreen, "Character classroom");
const ClassroomHanziLessonScreen = withClassroom(HanziLessonScreen, "Character lesson", "Understand the character • Read • Remember");
const ClassroomHanziStrokesScreen = withClassroom(HanziStrokesScreen, "Stroke-order lesson", "Watch each stroke • Follow the correct order");
const ClassroomHanziWriteScreen = withClassroom(HanziWriteScreen, "Writing practice", "Your teacher will guide your writing");
const ClassroomHanziTestScreen = withClassroom(HanziTestScreen, "Character assessment", "Show what you can recognise and write");
const ClassroomTeacherScreen = withClassroom(TeacherScreen, "Your AI teacher", "Watch the board • Listen • Speak with your teacher");
const ClassroomPinyinTeacherScreen = withClassroom(PinyinTeacherScreen, "Pinyin and tone classroom", "Hear the tone • See the pitch • Repeat");
const ClassroomCourseLessonScreen = withClassroom(CourseLessonScreen, "Complete language lesson", "Learn • Practise • Check your understanding");
const ClassroomPlacementScreen = withClassroom(PlacementScreen, "Level assessment", "Your teacher is finding your starting point");


function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: "#ffffff" },
        headerTitleStyle: { color: "#18324d", fontWeight: "800" },
        headerTintColor: "#18324d",
        tabBarActiveTintColor: "#1687a6",
        tabBarInactiveTintColor: "#8795a5",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e7edf3",
          height: 66,
          paddingTop: 7,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{ title: "Home", tabBarIcon: icon("🏠") }}
      />
      <Tab.Screen
        name="LearnTab"
        component={ClassroomLearnScreen}
        options={{ title: "Learn", tabBarIcon: icon("📚") }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ClassroomChatScreen}
        options={{ title: "Chat", tabBarIcon: icon("💬") }}
      />
      <Tab.Screen
        name="LibraryTab"
        component={LibraryScreen}
        options={{ title: "Library", tabBarIcon: icon("📖") }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarIcon: icon("👤") }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  if (!introDone) return <IntroAnimation onFinish={finishIntro} />;

  if (loading) {
    return <LoadingAnimation label="Getting LinguaApp ready" />;
  }
  if (!user) return <AuthScreen />;

  return (
    <View style={{ flex: 1 }}>
      <SpeechBanner />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen
            name="Home"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ChineseAcademy"
            component={ClassroomChineseAcademyScreen}
            options={{ title: "Chinese Academy" }}
          />
          <Stack.Screen
            name="Languages"
            component={LanguageScreen}
            options={{ title: "Choose a language" }}
          />
          <Stack.Screen
            name="Levels"
            component={LevelScreen}
            options={{ title: "Choose your level" }}
          />
          <Stack.Screen
            name="Units"
            component={ClassroomUnitsScreen}
            options={{ title: "Units" }}
          />
          <Stack.Screen
            name="Lessons"
            component={ClassroomLessonsScreen}
            options={{ title: "Lessons" }}
          />
          <Stack.Screen
            name="Flashcards"
            component={ClassroomFlashcardScreen}
            options={{ title: "Flashcards" }}
          />
          <Stack.Screen
            name="Quiz"
            component={ClassroomQuizScreen}
            options={{ title: "Quiz" }}
          />
          <Stack.Screen
            name="Import"
            component={ClassroomImportScreen}
            options={{ title: "Import a file" }}
          />
          <Stack.Screen
            name="Photo"
            component={ClassroomPhotoScreen}
            options={{ title: "Read a photo" }}
          />
          <Stack.Screen
            name="Books"
            component={ClassroomBookSearchScreen}
            options={{ title: "Find a book" }}
          />
          <Stack.Screen
            name="Sleep"
            component={ClassroomSleepHomeScreen}
            options={{ title: "Sleep mode" }}
          />
          <Stack.Screen
            name="SleepStudy"
            component={ClassroomSleepStudyScreen}
            options={{ title: "Review" }}
          />
          <Stack.Screen
            name="SleepEvening"
            component={ClassroomSleepEveningScreen}
            options={{ title: "Evening quiz" }}
          />
          <Stack.Screen
            name="SleepNight"
            component={ClassroomSleepNightScreen}
            options={{ title: "Tonight" }}
          />
          <Stack.Screen
            name="SleepMorning"
            component={ClassroomSleepMorningScreen}
            options={{ title: "Morning test" }}
          />
          <Stack.Screen
            name="SpeechCheck"
            component={ClassroomSpeechCheckScreen}
            options={{ title: "Speech check" }}
          />
          <Stack.Screen
            name="Tutor"
            component={ClassroomTutorScreen}
            options={{ title: "AI Tutor" }}
          />
          <Stack.Screen
            name="HanziHome"
            component={ClassroomHanziHomeScreen}
            options={{ title: "Chinese characters" }}
          />
          <Stack.Screen
            name="HanziLesson"
            component={ClassroomHanziLessonScreen}
            options={{ title: "Learn characters" }}
          />
          <Stack.Screen
            name="HanziStrokes"
            component={ClassroomHanziStrokesScreen}
            options={{ title: "How to write" }}
          />
          <Stack.Screen
            name="HanziWrite"
            component={ClassroomHanziWriteScreen}
            options={{ title: "Write" }}
          />
          <Stack.Screen
            name="HanziTest"
            component={ClassroomHanziTestScreen}
            options={{ title: "Test" }}
          />
          <Stack.Screen
            name="Teacher"
            component={ClassroomTeacherScreen}
            options={{ title: "Learn with a teacher" }}
          />
          <Stack.Screen
            name="PinyinTeacher"
            component={ClassroomPinyinTeacherScreen}
            options={{ title: "Chinese pinyin teacher" }}
          />
          <Stack.Screen
            name="Progress"
            component={ProgressScreen}
            options={{ title: "Learning progress" }}
          />
          <Stack.Screen
            name="Placement"
            component={ClassroomPlacementScreen}
            options={{ title: "Find your level" }}
          />
          <Stack.Screen
            name="CourseLesson"
            component={ClassroomCourseLessonScreen}
            options={{ title: "Complete language lesson" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  // iPhone: speak even when the ring switch is on silent
  useEffect(() => {
    if (Platform.OS === "web") return;
    try {
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "doNotMix",
        shouldRouteThroughEarpiece: false,
      }).catch(() => {});
    } catch (e) {
      // not available: speech still works with the switch off
    }
  }, []);

  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
