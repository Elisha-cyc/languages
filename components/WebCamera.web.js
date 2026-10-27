import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";

export default function WebCamera({ visible, onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera needs https or localhost.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError(
          e && e.name === "NotAllowedError"
            ? "Camera is blocked. Allow it for this site in the browser settings."
            : e && e.name === "NotFoundError"
              ? "No camera was found on this device."
              : e.message || "Could not open the camera.",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [visible]);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    // Same shape as an expo-image-picker asset
    onCapture({
      uri: dataUrl,
      base64: dataUrl.split(",")[1],
      mimeType: "image/jpeg",
      width: canvas.width,
      height: canvas.height,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", maxHeight: "75%", backgroundColor: "#000" }}
          />
        )}
        <View style={styles.row}>
          {!error && (
            <Pressable style={styles.snap} onPress={snap}>
              <Text style={styles.snapText}>Take photo</Text>
            </Pressable>
          )}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{error ? "Close" : "Cancel"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", justifyContent: "center" },
  error: { color: "white", fontSize: 16, padding: 24, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "center", padding: 16 },
  snap: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginRight: 12,
  },
  snapText: { color: "white", fontSize: 18 },
  cancel: {
    backgroundColor: "#333",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  cancelText: { color: "white", fontSize: 16 },
});
