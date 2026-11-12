import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * Shared classroom frame used by the app's teaching and practice screens.
 * Keep the activity component intact while giving every lesson one consistent
 * classroom setting, teacher and board.
 */
export default function withClassroom(Screen, title, prompt = "Watch • Listen • Practise") {
  function ClassroomScreen(props) {
    return (
      <View style={styles.screen}>
        <View style={styles.classroom}>
          <View style={styles.windowGlow} />
          <View style={styles.board}>
            <View style={styles.boardHeader}>
              <View style={styles.statusDot} />
              <Text style={styles.eyebrow}>LINGUA CLASSROOM</Text>
              <Text style={styles.live}>IN CLASS</Text>
            </View>
            <Text style={styles.lessonTitle} numberOfLines={2}>{title}</Text>
            <Text style={styles.prompt} numberOfLines={2}>{prompt}</Text>
            <View style={styles.chalkRule} />
            <View style={styles.chalkTray}><View style={styles.chalk} /><View style={styles.eraser} /></View>
          </View>

          <View style={styles.teacher} accessibilityLabel="Your classroom teacher">
            <View style={styles.teacherShadow} />
            <View style={styles.hairBack} />
            <View style={styles.earLeft} />
            <View style={styles.earRight} />
            <View style={styles.face}>
              <View style={styles.hairTop} />
              <View style={styles.hairSideLeft} />
              <View style={styles.hairSideRight} />
              <View style={styles.brows}><View style={styles.brow} /><View style={styles.brow} /></View>
              <View style={styles.eyes}><View style={styles.eye}><View style={styles.pupil} /></View><View style={styles.eye}><View style={styles.pupil} /></View></View>
              <View style={styles.nose} />
              <View style={styles.mouth} />
            </View>
            <View style={styles.neck} />
            <View style={styles.shirtCollarLeft} />
            <View style={styles.shirtCollarRight} />
            <View style={styles.jacket}>
              <View style={styles.lapelLeft} />
              <View style={styles.lapelRight} />
              <View style={styles.shirt}>
                <View style={styles.tieKnot} />
                <View style={styles.tie} />
              </View>
              <View style={styles.jacketButton} />
            </View>
            <View style={styles.teacherArm} />
            <View style={styles.pointer} />
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
    );
  }
  ClassroomScreen.displayName = `Classroom(${Screen.displayName || Screen.name || "Lesson"})`;
  return ClassroomScreen;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f0e8" },
  classroom: {
    height: 166, backgroundColor: "#e7dfcf", paddingHorizontal: 12,
    paddingTop: 9, paddingBottom: 9, flexDirection: "row",
    alignItems: "center", overflow: "hidden",
    borderBottomWidth: 5, borderBottomColor: "#b7a487",
  },
  windowGlow: {
    position: "absolute", width: 190, height: 190, borderRadius: 95,
    backgroundColor: "#f7f1e4", right: 18, top: -92,
  },
  board: {
    flex: 1, minHeight: 128, backgroundColor: "#17483f",
    borderRadius: 5, borderWidth: 6, borderColor: "#96734c",
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 13,
    justifyContent: "center", shadowColor: "#253b32",
    shadowOpacity: 0.24, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  boardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#e7c97d", marginRight: 6 },
  eyebrow: { color: "#c7d8c8", fontSize: 8, fontWeight: "900", letterSpacing: 1.25, flex: 1 },
  live: { color: "#e7d59d", fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  lessonTitle: { color: "#fffdf0", fontSize: 17, lineHeight: 21, fontWeight: "900" },
  prompt: { color: "#d6e5d8", fontSize: 9, lineHeight: 13, marginTop: 4, fontWeight: "600" },
  chalkRule: { height: 1, width: "70%", backgroundColor: "#b7cbb7", opacity: 0.6, marginTop: 8 },
  chalkTray: { position: "absolute", bottom: -1, left: 16, right: 16, height: 5, backgroundColor: "#b7956c", borderRadius: 2, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 5 },
  chalk: { width: 12, height: 2, backgroundColor: "#f4eedc", marginRight: 5 },
  eraser: { width: 12, height: 4, borderRadius: 1, backgroundColor: "#6b5540" },

  teacher: { width: 91, height: 148, marginLeft: 7, alignItems: "center", justifyContent: "flex-end" },
  teacherShadow: { position: "absolute", bottom: 0, width: 68, height: 9, borderRadius: 30, backgroundColor: "#9b8d78", opacity: 0.28 },
  hairBack: { position: "absolute", top: 8, width: 48, height: 48, borderRadius: 23, backgroundColor: "#29252a" },
  earLeft: { position: "absolute", top: 31, left: 18, width: 9, height: 13, borderRadius: 5, backgroundColor: "#a9684d" },
  earRight: { position: "absolute", top: 31, right: 18, width: 9, height: 13, borderRadius: 5, backgroundColor: "#a9684d" },
  face: { position: "absolute", top: 13, width: 39, height: 48, borderRadius: 19, backgroundColor: "#c98765", alignItems: "center", zIndex: 3, overflow: "hidden" },
  hairTop: { position: "absolute", top: -4, width: 43, height: 17, borderRadius: 20, backgroundColor: "#29252a" },
  hairSideLeft: { position: "absolute", top: 5, left: 0, width: 7, height: 20, backgroundColor: "#29252a", borderTopRightRadius: 8 },
  hairSideRight: { position: "absolute", top: 5, right: 0, width: 7, height: 20, backgroundColor: "#29252a", borderTopLeftRadius: 8 },
  brows: { position: "absolute", top: 20, width: 23, flexDirection: "row", justifyContent: "space-between" },
  brow: { width: 7, height: 1.5, borderRadius: 2, backgroundColor: "#49302a" },
  eyes: { position: "absolute", top: 23, width: 22, flexDirection: "row", justifyContent: "space-between" },
  eye: { width: 5, height: 4, borderRadius: 3, backgroundColor: "#fff8ed", alignItems: "center", justifyContent: "center" },
  pupil: { width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: "#29252a" },
  nose: { position: "absolute", top: 27, width: 4, height: 7, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#a9684d", borderBottomRightRadius: 4 },
  mouth: { position: "absolute", top: 38, width: 10, height: 4, borderBottomWidth: 1.5, borderColor: "#783e3b", borderRadius: 8 },
  neck: { position: "absolute", top: 57, width: 14, height: 16, backgroundColor: "#b97859", zIndex: 1 },
  shirtCollarLeft: { position: "absolute", bottom: 54, left: 32, width: 15, height: 18, backgroundColor: "#f4eee3", transform: [{ rotate: "24deg" }], zIndex: 3 },
  shirtCollarRight: { position: "absolute", bottom: 54, right: 32, width: 15, height: 18, backgroundColor: "#f4eee3", transform: [{ rotate: "-24deg" }], zIndex: 3 },
  jacket: { width: 68, height: 77, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "#344d66", alignItems: "center", marginBottom: 0, overflow: "hidden" },
  lapelLeft: { position: "absolute", left: 8, top: 0, width: 20, height: 42, backgroundColor: "#405d78", transform: [{ skewY: "18deg" }] },
  lapelRight: { position: "absolute", right: 8, top: 0, width: 20, height: 42, backgroundColor: "#405d78", transform: [{ skewY: "-18deg" }] },
  shirt: { width: 22, height: 77, backgroundColor: "#f4eee3", alignItems: "center" },
  tieKnot: { width: 9, height: 9, backgroundColor: "#bd8e4e", transform: [{ rotate: "45deg" }], marginTop: 7, zIndex: 2 },
  tie: { width: 9, height: 34, backgroundColor: "#bd8e4e", marginTop: -1 },
  jacketButton: { position: "absolute", bottom: 21, right: 13, width: 3, height: 3, borderRadius: 2, backgroundColor: "#d8c39a" },
  teacherArm: { position: "absolute", right: 4, top: 75, width: 13, height: 48, borderRadius: 8, backgroundColor: "#c98765", transform: [{ rotate: "-34deg" }], zIndex: 4 },
  pointer: { position: "absolute", right: 1, top: 56, width: 3, height: 42, borderRadius: 2, backgroundColor: "#b99561", transform: [{ rotate: "24deg" }], zIndex: 5 },

  activity: { flex: 1, minHeight: 0, backgroundColor: "#f7f8fa" },
  activityBar: { minHeight: 29, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", backgroundColor: "#e6eee9", borderBottomWidth: 1, borderBottomColor: "#d5e0d8" },
  activityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34866c", marginRight: 7 },
  activityLabel: { color: "#42665b", fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  content: { flex: 1, minHeight: 0 },
});
