import { View, Text, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./auth";
import SpeechBanner from "./components/SpeechBanner";
import AuthScreen from "./screens/AuthScreen";
import DashboardScreen from "./screens/DashboardScreen";
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
import { useEffect } from "react";
import { Platform } from "react-native";
import { setAudioModeAsync } from "expo-audio";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const icon = (emoji) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        tabBarActiveTintColor: "#2a6fdb",
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{ title: "Home", tabBarIcon: icon("🏠") }}
      />
      <Tab.Screen
        name="LearnTab"
        component={LearnScreen}
        options={{ title: "Learn", tabBarIcon: icon("📚") }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatScreen}
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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
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
            component={UnitsScreen}
            options={{ title: "Units" }}
          />
          <Stack.Screen
            name="Lessons"
            component={LessonsScreen}
            options={{ title: "Lessons" }}
          />
          <Stack.Screen
            name="Flashcards"
            component={FlashcardScreen}
            options={{ title: "Flashcards" }}
          />
          <Stack.Screen
            name="Quiz"
            component={QuizScreen}
            options={{ title: "Quiz" }}
          />
          <Stack.Screen
            name="Import"
            component={ImportScreen}
            options={{ title: "Import a file" }}
          />
          <Stack.Screen
            name="Photo"
            component={PhotoScreen}
            options={{ title: "Read a photo" }}
          />
          <Stack.Screen
            name="Books"
            component={BookSearchScreen}
            options={{ title: "Find a book" }}
          />
          <Stack.Screen
            name="Sleep"
            component={SleepHomeScreen}
            options={{ title: "Sleep mode" }}
          />
          <Stack.Screen
            name="SleepStudy"
            component={SleepStudyScreen}
            options={{ title: "Review" }}
          />
          <Stack.Screen
            name="SleepEvening"
            component={SleepEveningScreen}
            options={{ title: "Evening quiz" }}
          />
          <Stack.Screen
            name="SleepNight"
            component={SleepNightScreen}
            options={{ title: "Tonight" }}
          />
          <Stack.Screen
            name="SleepMorning"
            component={SleepMorningScreen}
            options={{ title: "Morning test" }}
          />
          <Stack.Screen
            name="SpeechCheck"
            component={SpeechCheckScreen}
            options={{ title: "Speech check" }}
          />
          <Stack.Screen
            name="Tutor"
            component={TutorScreen}
            options={{ title: "AI Tutor" }}
          />
          <Stack.Screen
            name="HanziHome"
            component={HanziHomeScreen}
            options={{ title: "Chinese characters" }}
          />
          <Stack.Screen
            name="HanziLesson"
            component={HanziLessonScreen}
            options={{ title: "Learn characters" }}
          />
          <Stack.Screen
            name="HanziStrokes"
            component={HanziStrokesScreen}
            options={{ title: "How to write" }}
          />
          <Stack.Screen
            name="HanziWrite"
            component={HanziWriteScreen}
            options={{ title: "Write" }}
          />
          <Stack.Screen
            name="HanziTest"
            component={HanziTestScreen}
            options={{ title: "Test" }}
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
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
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
