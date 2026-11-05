// Records the microphone as a 16 kHz mono WAV file (what Azure's pronunciation
// check needs). Web only. It stops by itself when you finish speaking, and it
// switches the microphone completely off afterwards.

import { Platform } from "react-native";

let sharedContext = null;

export function canRecord() {
  return (
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
    typeof window !== "undefined" &&
    !!(window.AudioContext || window.webkitAudioContext)
  );
}

function getContext() {
  if (!sharedContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    sharedContext = new Ctx();
  }
  return sharedContext;
}

// Call this from a tap. iPhone only allows audio that was unlocked by a tap.
export async function prepareRecorder() {
  if (!canRecord()) return;
  try {
    const context = getContext();
    if (context.state === "suspended") await context.resume();
  } catch (e) {
    // recording will report the problem when it starts
  }
}

function merge(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const all = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return all;
}

// Float samples at any rate -> a 16-bit PCM WAV at outRate
export function encodeWav(samples, inRate, outRate = 16000) {
  const ratio = inRate / outRate;
  const length = Math.floor(samples.length / ratio);
  const pcm = new Int16Array(length);

  for (let i = 0; i < length; i++) {
    // average the samples that fall into this output sample (simple low-pass)
    const start = Math.floor(i * ratio);
    const end = Math.min(
      samples.length,
      Math.max(start + 1, Math.floor((i + 1) * ratio)),
    );
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    const value = Math.max(-1, Math.min(1, sum / (end - start)));
    pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };

  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // size of this block
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, outRate, true);
  view.setUint32(28, outRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);

  return buffer;
}

// Starts listening. Returns { stop, cancel }.
//   stop()   -> Promise of a WAV Blob, or null if no speech was heard
//   onAutoStop(blobOrNull) is called when you stop talking, or after maxMs
//   onLevels(bars) is called about 15 times a second with BAR_COUNT numbers
//   from 0 to 1: a live picture of the sound the microphone is hearing
export const BAR_COUNT = 24;

export async function startRecording({
  maxMs = 12000,
  silenceMs = 1400,
  onAutoStop,
  onLevels,
} = {}) {
  const context = getContext();
  if (context.state === "suspended") await context.resume();
  if (context.state !== "running") throw new Error("audio-locked");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });

  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);

  // The analyser turns the sound into frequency bars for the live display
  let analyser = null;
  let meter = null;
  if (onLevels && context.createAnalyser) {
    analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    const bins = new Uint8Array(analyser.frequencyBinCount);
    meter = setInterval(() => {
      analyser.getByteFrequencyData(bins);
      const bars = [];
      const usable = 48; // the lowest 48 bins hold the human voice
      const per = usable / BAR_COUNT;
      for (let b = 0; b < BAR_COUNT; b++) {
        let sum = 0;
        for (let i = Math.floor(b * per); i < Math.floor((b + 1) * per); i++)
          sum += bins[i];
        bars.push(Math.min(1, Math.sqrt(sum / per / 255) * 1.1));
      }
      onLevels(bars);
    }, 70);
  }
  const chunks = [];
  const startedAt = Date.now();
  let heardSpeech = false;
  let lastLoud = startedAt;
  let noiseFloor = 0;
  let noiseSamples = 0;
  let finishing = null;

  function finish() {
    if (finishing) return finishing;
    finishing = (async () => {
      processor.onaudioprocess = null;
      if (meter) {
        clearInterval(meter);
        if (onLevels) onLevels(new Array(BAR_COUNT).fill(0));
      }
      try {
        processor.disconnect();
        source.disconnect();
        if (analyser) analyser.disconnect();
      } catch (e) {
        // already disconnected
      }
      stream.getTracks().forEach((track) => track.stop()); // microphone off
      if (!heardSpeech || chunks.length === 0) return null;
      const wav = encodeWav(merge(chunks), context.sampleRate);
      return new Blob([wav], { type: "audio/wav" });
    })();
    return finishing;
  }

  processor.onaudioprocess = (event) => {
    if (finishing) return;
    const data = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));

    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const level = Math.sqrt(sum / data.length);
    const now = Date.now();

    // The first moments tell us how noisy the room is
    if (now - startedAt < 400) {
      noiseFloor = (noiseFloor * noiseSamples + level) / (noiseSamples + 1);
      noiseSamples++;
      return;
    }

    if (level > 0.02 + Math.min(noiseFloor, 0.01)) {
      heardSpeech = true;
      lastLoud = now;
    }

    const quiet = heardSpeech && now - lastLoud > silenceMs;
    if (quiet || now - startedAt > maxMs) {
      finish().then((blob) => onAutoStop && onAutoStop(blob));
    }
  };

  source.connect(processor);
  processor.connect(context.destination);

  // Safety: if no audio ever arrives, still finish
  setTimeout(() => {
    if (!finishing) finish().then((blob) => onAutoStop && onAutoStop(blob));
  }, maxMs + 2000);

  return {
    stop: () => finish(),
    cancel: () => {
      heardSpeech = false;
      return finish();
    },
  };
}
