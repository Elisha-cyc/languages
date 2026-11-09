import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

export default function VoiceOrb({ active = false, busy = false, onPress, disabled = false, label }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.42)).current;

  useEffect(() => {
    const duration = active || busy ? 720 : 1900;
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: active || busy ? 1.12 : 1.045, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glow, { toValue: active || busy ? 0.95 : 0.58, duration, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.35, duration, useNativeDriver: true }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, busy, glow, pulse]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.haloOuter, { opacity: glow, transform: [{ scale: pulse }] }]} />
      <Animated.View style={[styles.haloMiddle, { opacity: glow, transform: [{ scale: pulse }] }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || (active ? "Stop listening" : "Start speaking")}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <View style={styles.orb}>
          <View style={styles.orbHighlight} />
          <View style={styles.orbCore} />
        </View>
        <Text style={styles.mic}>{active ? "Ⅱ" : "●"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 190, height: 190, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  haloOuter: { position: "absolute", width: 184, height: 184, borderRadius: 92, backgroundColor: "rgba(95, 120, 255, 0.10)", borderWidth: 1, borderColor: "rgba(150, 170, 255, 0.24)" },
  haloMiddle: { position: "absolute", width: 154, height: 154, borderRadius: 77, backgroundColor: "rgba(92, 132, 255, 0.14)", borderWidth: 1, borderColor: "rgba(160, 190, 255, 0.30)" },
  button: { width: 126, height: 126, borderRadius: 63, alignItems: "center", justifyContent: "center", backgroundColor: "#17264f", borderWidth: 1, borderColor: "rgba(190, 210, 255, 0.65)", shadowColor: "#7897ff", shadowOpacity: 0.85, shadowRadius: 28, shadowOffset: { width: 0, height: 0 }, elevation: 16 },
  orb: { position: "absolute", width: 104, height: 104, borderRadius: 52, overflow: "hidden", backgroundColor: "#5879ed" },
  orbHighlight: { position: "absolute", width: 82, height: 82, borderRadius: 41, top: -20, left: 8, backgroundColor: "#b5d7ff", opacity: 0.72 },
  orbCore: { position: "absolute", width: 70, height: 70, borderRadius: 35, top: 28, left: 18, backgroundColor: "#7d83f6", opacity: 0.82 },
  mic: { color: "white", fontSize: 24, fontWeight: "700", textShadowColor: "#243b89", textShadowRadius: 10 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
});
