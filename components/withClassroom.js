import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { ClassroomPresentationProvider, useClassroomPresentation } from "./ClassroomPresentation";

/**
 * Shared classroom frame for every teaching activity.
 * The activity itself remains unchanged; this gives each learning area the
 * same teacher, classroom board and lesson context.
 */
export default function withClassroom(Screen, title, prompt = "Watch • Listen • Practise") {
  function ClassroomScreen(props) {
    const [board, setBoard] = useState({ primary: title, secondary: prompt, translation: "" });
    const [speaking, setSpeaking] = useState(false);
    const mouth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (!speaking) {
        mouth.stopAnimation();
        mouth.setValue(0);
        return undefined;
      }
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(mouth, { toValue: 1, duration: 130, useNativeDriver: false }),
          Animated.timing(mouth, { toValue: 0, duration: 110, useNativeDriver: false }),
          Animated.timing(mouth, { toValue: 0.65, duration: 90, useNativeDriver: false }),
          Animated.timing(mouth, { toValue: 0, duration: 150, useNativeDriver: false }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }, [speaking, mouth]);

    const presentation = {
      setBoard: (next) => setBoard((current) => ({ ...current, ...next })),
      setSpeaking,
    };

    return (
      <ClassroomPresentationProvider value={presentation}>
        <View style={styles.screen}>
          <View style={styles.classroom}>
            <View style={styles.wallLight} />
            <View style={styles.board}>
              <View style={styles.boardTop}>
                <View style={styles.boardDot} />
                <Text style={styles.eyebrow}>LINGUA CLASSROOM</Text>
                <Text style={styles.live}>{speaking ? "TEACHER SPEAKING" : "LESSON BOARD"}</Text>
              </View>
              <Text style={styles.lessonTitle}>{board.primary}</Text>
              {!!board.secondary && <Text style={styles.prompt}>{board.secondary}</Text>}
              {!!board.translation && <Text style={styles.boardTranslation}>{board.translation}</Text>}
              <View style={styles.chalkLine} />
            </View>
            <View style={styles.teacher} accessibilityLabel="Your AI teacher standing beside the classroom board">
              <View style={styles.hair} />
              <View style={styles.face}>
                <View style={styles.eyes}><View style={styles.eye} /><View style={styles.eye} /></View>
                <Animated.View style={[styles.mouth, { height: mouth.interpolate({ inputRange: [0, 1], outputRange: [2, 8] }) }]} />
              </View>
              <View style={styles.neck} />
              <View style={styles.body}>
                <View style={styles.tie} />
                <View style={styles.arm} />
              </View>
            </View>
          </View>
          <View style={styles.activity}>
            <View style={styles.activityBar}>
              <View style={styles.activityDot} />
              <Text style={styles.activityLabel}>YOUR TEACHER IS GUIDING THIS ACTIVITY</Text>
            </View>
            <View style={styles.content}>
              <Screen {...props} />
            </View>
          </View>
        </View>
      </ClassroomPresentationProvider>
    );
  }
  ClassroomScreen.displayName = `Classroom(${Screen.displayName || Screen.name || "Lesson"})`;
  return ClassroomScreen;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1eee5" },
  classroom: {
    height: 148,
    backgroundColor: "#e8e0cf",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderBottomWidth: 4,
    borderBottomColor: "#b9a98b",
  },
  wallLight: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#f7f0df",
    right: 24,
    top: -70,
  },
  board: {
    flex: 1,
    minHeight: 112,
    backgroundColor: "#174c48",
    borderRadius: 9,
    borderWidth: 5,
    borderColor: "#9a7851",
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: "center",
    shadowColor: "#263b32",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  boardTop: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  boardDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#e7d59d", marginRight: 6 },
  eyebrow: { color: "#c7d8c8", fontSize: 8, fontWeight: "900", letterSpacing: 1.4, flex: 1 },
  live: { color: "#e7d59d", fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  lessonTitle: { color: "#fffdf0", fontSize: 18, lineHeight: 22, fontWeight: "900" },
  prompt: { color: "#d6e5d8", fontSize: 10, marginTop: 4, fontWeight: "600" },
  chalkLine: { height: 1, width: "72%", backgroundColor: "#b7cbb7", opacity: 0.65, marginTop: 7 },
  boardTranslation: { color: "#f0d995", fontSize: 13, fontWeight: "800", marginTop: 5 },
  teacher: { width: 76, height: 124, marginLeft: 8, alignItems: "center", justifyContent: "flex-end" },
  hair: { position: "absolute", top: 5, width: 42, height: 29, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: "#292c32" },
  face: { position: "absolute", top: 12, width: 36, height: 43, borderRadius: 17, backgroundColor: "#c98762", alignItems: "center", justifyContent: "center", zIndex: 2 },
  eyes: { flexDirection: "row", width: 20, justifyContent: "space-between", marginTop: 4 },
  eye: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#302b2b" },
  mouth: { width: 10, backgroundColor: "#743f37", borderRadius: 6, marginTop: 5 },
  neck: { position: "absolute", top: 50, width: 12, height: 12, backgroundColor: "#b97856" },
  body: { width: 54, height: 58, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: "#315b80", alignItems: "center", marginBottom: 0 },
  tie: { width: 9, height: 27, backgroundColor: "#d6b46f", marginTop: 5, transform: [{ rotate: "2deg" }] },
  arm: { position: "absolute", right: -5, top: 10, width: 10, height: 37, borderRadius: 8, backgroundColor: "#c98762", transform: [{ rotate: "-28deg" }] },
  activity: { flex: 1, minHeight: 0, backgroundColor: "#f7f8fa" },
  activityBar: { minHeight: 28, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", backgroundColor: "#e6eee9", borderBottomWidth: 1, borderBottomColor: "#d5e0d8" },
  activityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34866c", marginRight: 7 },
  activityLabel: { color: "#42665b", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  content: { flex: 1, minHeight: 0 },
});
