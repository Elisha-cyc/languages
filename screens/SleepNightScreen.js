import { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Message } from "../components/ChoiceList";
import { useFetch } from "../useFetch";
import { USER_ID } from "../config";
import { speak, stopSpeaking } from "../speech";
import { useMotionSensor, askMotionPermission } from "../motion";

// Tune these. They are estimates, not an established protocol.
const VOLUME_CAP = 0.2; // loudest cue, 0 to 1, on top of your phone's own volume
const VOLUME_START = 0.05; // first cue after a start or a pause
const RAMP_CUES = 8; // cues over which the volume rises to the cap
const CUE_MIN_MS = 8000; // gap between cues inside a block
const CUE_MAX_MS = 12000;
const REST_MIN_MS = 4 * 60 * 1000; // silence between blocks
const REST_MAX_MS = 6 * 60 * 1000;
const DELAYS = [0, 15, 30, 45, 60, 75, 90]; // minutes before the first cue
const DURATIONS = [5, 30, 60, 90, 120]; // minutes of cueing
const STILL_OPTIONS = [0, 2, 5, 10]; // minutes without movement before cues resume (0 = off)
const KEEP_AWAKE_TAG = "sleep-session";

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function between(min, max) {
  return min + Math.random() * (max - min);
}

function formatTime(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Roughly how many cues a session will play, for the setup screen
function estimateCues(wordCount, durationMinutes) {
  if (wordCount === 0) return 0;
  const blockMs = wordCount * ((CUE_MIN_MS + CUE_MAX_MS) / 2);
  const cycleMs = blockMs + (REST_MIN_MS + REST_MAX_MS) / 2;
  const blocks = Math.max(
    1,
    Math.round((durationMinutes * 60 * 1000) / cycleMs),
  );
  return blocks * wordCount;
}

export default function SleepNightScreen({ navigation, route }) {
  const { sessionId, language } = route.params;
  const { data, error } = useFetch(
    `/sleep/sessions/${sessionId}?user=${USER_ID}`,
  );

  const [delay, setDelay] = useState(60);
  const [duration, setDuration] = useState(90);
  const [stillMinutes, setStillMinutes] = useState(10);
  const [sensing, setSensing] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState("waiting"); // waiting, cueing, resting, moving
  const [now, setNow] = useState(Date.now());

  const plan = useRef({ startAt: 0, endAt: 0 });
  const cued = useRef([]);
  cued.current =
    data && Array.isArray(data.words)
      ? data.words.filter((w) => w.cued === 1)
      : [];

  const motion = useMotionSensor(sensing || running);
  const lastMotionAt = motion.lastMotionAt;
  const motionAvailable = useRef(false);
  motionAvailable.current = motion.available === true;

  // Keep the screen on while the session runs
  useEffect(() => {
    if (!running) return;
    Promise.resolve(activateKeepAwakeAsync(KEEP_AWAKE_TAG)).catch(() => {});
    return () => {
      Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => {});
    };
  }, [running]);

  // A clock for the countdown
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // The cue loop. It checks once a second and decides what to do:
  // wait for the start time, pause while you are moving, rest between blocks, or play a cue.
  useEffect(() => {
    if (!running) return;

    let cancelled = false;
    let timer;
    let queue = [];
    let blockLeft = 0; // cues left in the current block
    let nextCueAt = 0;
    let cueNumber = 0; // counts cues since the last pause, for the volume ramp
    let paused = true; // true at the start so the first cue is a quiet one
    const stillMs = stillMinutes * 60 * 1000;

    function tick() {
      if (cancelled) return;
      const t = Date.now();

      if (t >= plan.current.endAt) {
        setRunning(false);
        setFinished(true);
        return;
      }

      if (t < plan.current.startAt || cued.current.length === 0) {
        setStatus("waiting");
        timer = setTimeout(tick, 1000);
        return;
      }

      // Movement gate: no cues until you have been still for a while
      const gateActive = stillMs > 0 && motionAvailable.current;
      if (gateActive && t - lastMotionAt.current < stillMs) {
        if (!paused) stopSpeaking();
        paused = true;
        cueNumber = 0;
        setStatus("moving");
        timer = setTimeout(tick, 1000);
        return;
      }
      if (paused) {
        paused = false;
        nextCueAt = t;
      }

      if (t < nextCueAt) {
        setStatus(blockLeft === 0 ? "resting" : "cueing");
        timer = setTimeout(tick, 1000);
        return;
      }

      // A new block plays each replayed word once, in random order
      if (blockLeft === 0) {
        queue = shuffle(cued.current);
        blockLeft = queue.length;
      }

      const next = queue.pop();
      const level = Math.min(1, cueNumber / RAMP_CUES);
      const volume = VOLUME_START + (VOLUME_CAP - VOLUME_START) * level;
      speak(next.word, language, { volume, rate: 0.8 });

      cueNumber++;
      blockLeft--;
      setStatus("cueing");
      nextCueAt =
        t +
        (blockLeft === 0
          ? between(REST_MIN_MS, REST_MAX_MS)
          : between(CUE_MIN_MS, CUE_MAX_MS));
      timer = setTimeout(tick, 1000);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopSpeaking();
    };
  }, [running]);

  async function checkMotion() {
    await askMotionPermission();
    setSensing(true);
  }

  async function start() {
    await askMotionPermission();
    setSensing(true);

    const t = Date.now();
    plan.current = {
      startAt: t + delay * 60 * 1000,
      endAt: t + (delay + duration) * 60 * 1000,
    };
    lastMotionAt.current = t; // putting the phone down counts as movement
    setNow(t);
    setStatus("waiting");
    setFinished(false);
    setRunning(true);
  }

  if (error) return <Message text={error} />;
  if (!data) return <Message text="Loading..." />;
  if (!Array.isArray(data.words))
    return <Message text={data.error || "Could not load the session."} />;

  if (running) {
    const waiting = status === "waiting";
    const remaining = waiting
      ? plan.current.startAt - now
      : plan.current.endAt - now;
    const labels = {
      waiting: "Cues begin in",
      cueing: "Cues playing. Ends in",
      resting: "Resting between blocks. Ends in",
      moving: "Paused because you moved. Ends in",
    };

    return (
      <View style={styles.dark}>
        <Text style={styles.darkText}>{labels[status]}</Text>
        <Text style={styles.darkTime}>{formatTime(remaining)}</Text>
        {status === "moving" && (
          <Text style={styles.darkSmall}>
            Cues resume after {stillMinutes} minutes without movement.
          </Text>
        )}
        <Pressable style={styles.darkButton} onPress={() => setRunning(false)}>
          <Text style={styles.darkButtonText}>Stop</Text>
        </Pressable>
      </View>
    );
  }

  if (finished) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Session finished</Text>
        <Text style={styles.note}>
          In the morning, take the test. It compares the words that were
          replayed with the ones that were not.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => navigation.replace("SleepMorning", { sessionId })}
        >
          <Text style={styles.buttonText}>Take the morning test</Text>
        </Pressable>
      </View>
    );
  }

  const cuedWords = cued.current;
  const motionText = !sensing
    ? "Not checked yet."
    : motion.available === null
      ? "Checking..."
      : motion.available === false
        ? "Not available on this device. Cues will follow the timer only."
        : motion.moving
          ? "Movement detected."
          : "Still.";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Tonight's session</Text>
      <Text style={styles.note}>
        {cuedWords.length} words will be replayed as quiet speech, in short
        blocks with long rests between them: about{" "}
        {estimateCues(cuedWords.length, duration)} cues in total.
      </Text>

      <Text style={styles.label}>Wait before the first cue (minutes)</Text>
      <View style={styles.chips}>
        {DELAYS.map((value) => (
          <Pressable
            key={value}
            style={[styles.chip, delay === value && styles.chipOn]}
            onPress={() => setDelay(value)}
          >
            <Text
              style={[styles.chipText, delay === value && styles.chipTextOn]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Play cues for (minutes)</Text>
      <View style={styles.chips}>
        {DURATIONS.map((value) => (
          <Pressable
            key={value}
            style={[styles.chip, duration === value && styles.chipOn]}
            onPress={() => setDuration(value)}
          >
            <Text
              style={[styles.chipText, duration === value && styles.chipTextOn]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>
        Pause cues when I move: wait this many still minutes (0 = off)
      </Text>
      <View style={styles.chips}>
        {STILL_OPTIONS.map((value) => (
          <Pressable
            key={value}
            style={[styles.chip, stillMinutes === value && styles.chipOn]}
            onPress={() => setStillMinutes(value)}
          >
            <Text
              style={[
                styles.chipText,
                stillMinutes === value && styles.chipTextOn,
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.secondary} onPress={checkMotion}>
        <Text style={styles.secondaryText}>Check motion sensing</Text>
      </Pressable>
      <Text style={styles.small}>Motion: {motionText}</Text>
      <Text style={styles.small}>
        Put the phone on the mattress where you will sleep and tap the bed or
        shift your weight. If it does not notice, the movement setting will not
        work for you.
      </Text>

      <Pressable
        style={styles.secondary}
        onPress={() =>
          cuedWords[0] &&
          speak(cuedWords[0].word, language, { volume: VOLUME_CAP, rate: 0.8 })
        }
      >
        <Text style={styles.secondaryText}>Test the volume</Text>
      </Pressable>
      <Text style={styles.small}>
        This plays the loudest cue of the night. Set your phone's volume so it
        is only just audible from your pillow. If any sound wakes you, stop and
        lower the volume.
      </Text>

      <Text style={styles.small}>
        Keep the app open with the screen on and the phone plugged in, because
        phones pause apps in the background. To try it now, choose 0 minutes of
        waiting, 5 minutes of cues, and 0 for the movement pause. You will hear
        one block of cues.
      </Text>

      <Pressable style={styles.button} onPress={start}>
        <Text style={styles.buttonText}>Start</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f2f4f8", flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "bold" },
  note: {
    fontSize: 15,
    color: "#555",
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 22,
  },
  label: { fontSize: 14, color: "#555", marginTop: 16, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#d5d9e0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: "#2a6fdb", borderColor: "#2a6fdb" },
  chipText: { fontSize: 15, color: "#333" },
  chipTextOn: { color: "white" },
  small: { fontSize: 13, color: "#666", marginTop: 10, lineHeight: 18 },
  secondary: {
    backgroundColor: "#dbe7ff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  secondaryText: { color: "#2a6fdb", fontSize: 16 },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "white", fontSize: 18 },
  dark: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  darkText: { color: "#555", fontSize: 16, textAlign: "center" },
  darkTime: { color: "#555", fontSize: 40, marginTop: 8, marginBottom: 24 },
  darkSmall: {
    color: "#444",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  darkButton: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  darkButtonText: { color: "#666", fontSize: 16 },
});
