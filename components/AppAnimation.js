import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

const COLORS = ["#F7C948", "#54D2B6", "#FF8A71"];

export function IntroAnimation({ onFinish }) {
  const fade = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.55)).current;
  const logoRise = useRef(new Animated.Value(24)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orbitLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbit, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(orbit, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    orbitLoop.start();

    const entrance = Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          damping: 9,
          stiffness: 145,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(logoRise, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          delay: 170,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(750),
      Animated.timing(fade, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    entrance.start(({ finished }) => {
      if (finished) onFinish?.();
    });

    return () => {
      entrance.stop();
      orbitLoop.stop();
    };
  }, [fade, logoRise, logoScale, onFinish, orbit, titleOpacity]);

  const bob = orbit.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const tilt = orbit.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] });

  return (
    <Animated.View style={[styles.intro, { opacity: fade }]}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <Animated.View
        style={[
          styles.logoTile,
          {
            opacity: titleOpacity,
            transform: [
              { translateY: Animated.add(logoRise, bob) },
              { scale: logoScale },
              { rotate: tilt },
            ],
          },
        ]}
      >
        <Text style={styles.logoLetters}>Aa</Text>
        <Text style={styles.logoChinese}>你好</Text>
      </Animated.View>
      <Animated.View style={{ opacity: titleOpacity, alignItems: "center" }}>
        <Text style={styles.brand}>LinguaApp</Text>
        <Text style={styles.tagline}>A little practice. A new world.</Text>
      </Animated.View>
      <View style={styles.languageRow}>
        {["Hola", "Bonjour", "你好", "Hello"].map((word, index) => (
          <View
            key={word}
            style={[
              styles.languagePill,
              { backgroundColor: COLORS[index % COLORS.length] },
            ]}
          >
            <Text style={styles.languageText}>{word}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

export function LoadingAnimation({ label = "Getting things ready" }) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={styles.loadingArt}>
        <Animated.View
          style={[
            styles.bookPage,
            styles.leftPage,
            {
              transform: [
                {
                  rotate: bounce.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["-7deg", "-16deg"],
                  }),
                },
                {
                  translateY: bounce.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, -8],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.bookPage,
            styles.rightPage,
            {
              transform: [
                {
                  rotate: bounce.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["7deg", "16deg"],
                  }),
                },
                {
                  translateY: bounce.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, -8],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.Text
          style={[
            styles.loadingGlyph,
            {
              transform: [
                {
                  translateY: bounce.interpolate({
                    inputRange: [0, 1],
                    outputRange: [3, -11],
                  }),
                },
                {
                  scale: bounce.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1.08],
                  }),
                },
              ],
            },
          ]}
        >
          文
        </Animated.Text>
      </View>
      <Text style={styles.loadingLabel}>{label}</Text>
      <View style={styles.dots}>
        {[0, 1, 2].map((index) => (
          <LoadingDot key={index} index={index} />
        ))}
      </View>
    </View>
  );
}

function LoadingDot({ index }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 150),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 340,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.6,
            duration: 340,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 340,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay((2 - index) * 150),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [index, opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: COLORS[index], opacity, transform: [{ scale }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  intro: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#205FC6",
  },
  glowOne: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(95, 191, 255, 0.18)",
    top: -160,
    right: -110,
  },
  glowTwo: {
    position: "absolute",
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: "rgba(255, 213, 91, 0.13)",
    bottom: -145,
    left: -110,
  },
  logoTile: {
    width: 128,
    height: 128,
    borderRadius: 38,
    marginBottom: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#063C93",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  logoLetters: { color: "#2774DA", fontSize: 47, fontWeight: "900", letterSpacing: -4 },
  logoChinese: { color: "#2774DA", fontSize: 19, fontWeight: "700", marginTop: -2 },
  brand: { color: "white", fontSize: 34, fontWeight: "800", letterSpacing: 0.4 },
  tagline: { color: "#E7F3FF", fontSize: 15, marginTop: 7 },
  languageRow: { flexDirection: "row", gap: 8, marginTop: 30 },
  languagePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  languageText: { color: "#173462", fontWeight: "700", fontSize: 13 },
  loading: {
    flex: 1,
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F4F8",
    padding: 24,
  },
  loadingArt: { height: 92, width: 118, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  bookPage: {
    position: "absolute",
    top: 21,
    width: 51,
    height: 58,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#D7E6FA",
    shadowColor: "#2A6FDB",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  leftPage: { left: 10, borderTopLeftRadius: 12, borderBottomLeftRadius: 8 },
  rightPage: { right: 10, borderTopRightRadius: 12, borderBottomRightRadius: 8 },
  loadingGlyph: { color: "#2774DA", fontSize: 34, fontWeight: "800", textAlign: "center" },
  loadingLabel: { color: "#3D4B61", fontSize: 16, fontWeight: "600", textAlign: "center" },
  dots: { flexDirection: "row", gap: 9, marginTop: 14 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
