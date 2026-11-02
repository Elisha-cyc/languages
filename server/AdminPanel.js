import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  View,
  Share,
  Platform,
} from "react-native";
import { API_URL } from "../config";

async function call(path, password, method = "GET", body) {
  const res = await fetch(`${API_URL}/admin/api/${path}`, {
    method,
    headers: {
      "x-admin-password": password,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// True only when the server accepts this admin password
export async function checkAdminPassword(password) {
  try {
    await call("list", password);
    return true;
  } catch (e) {
    return false;
  }
}

function inviteMessage(code, appUrl) {
  const where = appUrl || "[the app address]";
  return (
    `Hi! I made a language learning app and I would love you to try it. ` +
    `Open ${where}, tap Create an account, and use this invite code: ${code} ` +
    `It only works once, so please do not share it.`
  );
}

// Opens the phone's share sheet; on the web, shares or copies the text
async function shareText(text) {
  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
        return "Shared";
      } catch (e) {
        return "";
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return "Copied";
    }
    window.prompt("Copy this:", text);
    return "";
  }
  await Share.share({ message: text });
  return "";
}

export default function AdminPanel({ password, onClose }) {
  const [codes, setCodes] = useState([]);
  const [appUrl, setAppUrl] = useState("");
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(null);

  const origin =
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.origin
      : "";

  async function refresh() {
    try {
      const data = await call("list", password);
      setCodes(data.codes);
      setAppUrl(data.appUrl || origin);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    setError(null);
    try {
      const data = await call("create", password, "POST", { label });
      setFresh(data.code);
      setLabel("");
      setNote("");
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function share(code) {
    const result = await shareText(inviteMessage(code, appUrl || origin));
    setNote(result);
  }

  async function cancel(code) {
    if (confirming !== code) {
      setConfirming(code);
      return;
    }
    setConfirming(null);
    try {
      await call("revoke", password, "POST", { code });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Invite codes</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Who is this code for? (optional)</Text>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Name"
          maxLength={40}
        />
        <Pressable style={styles.button} onPress={create}>
          <Text style={styles.buttonText}>Create a new code</Text>
        </Pressable>

        {fresh && (
          <View style={styles.fresh}>
            <Text selectable style={styles.code}>
              {fresh}
            </Text>
            <Pressable style={styles.small} onPress={() => share(fresh)}>
              <Text style={styles.smallText}>Share invitation</Text>
            </Pressable>
          </View>
        )}
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>All codes</Text>
        {codes.length === 0 && <Text style={styles.muted}>No codes yet.</Text>}
        {codes.map((item) => {
          const done = Boolean(item.used_at || item.revoked_at);
          return (
            <View key={item.code} style={[styles.row, done && styles.done]}>
              <View style={{ flexShrink: 1 }}>
                <Text selectable style={styles.rowCode}>
                  {item.code}
                </Text>
                <Text style={styles.muted}>
                  {item.label} -{" "}
                  {item.revoked_at ? "cancelled" : item.used_at ? "used" : "unused"}
                </Text>
              </View>
              {!done && (
                <View style={styles.actions}>
                  <Pressable style={styles.small} onPress={() => share(item.code)}>
                    <Text style={styles.smallText}>Share</Text>
                  </Pressable>
                  <Pressable style={styles.small} onPress={() => cancel(item.code)}>
                    <Text style={[styles.smallText, styles.danger]}>
                      {confirming === item.code ? "Tap again" : "Cancel"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Pressable style={styles.close} onPress={onClose}>
        <Text style={styles.closeText}>Close and go back to log in</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#f2f4f8",
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#d9dee7",
  },
  heading: { fontSize: 16, fontWeight: "bold", marginBottom: 6 },
  label: { fontSize: 14, color: "#555", marginBottom: 6 },
  input: {
    backgroundColor: "#f2f4f8",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#d5d9e0",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 17 },
  fresh: { marginTop: 16, alignItems: "flex-start" },
  code: { fontSize: 22, fontWeight: "bold", letterSpacing: 1, marginBottom: 10 },
  small: {
    borderWidth: 1,
    borderColor: "#d9dee7",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 6,
  },
  smallText: { color: "#2a6fdb", fontSize: 14 },
  danger: { color: "#c0392b" },
  note: { marginTop: 8, color: "#667085" },
  error: { marginTop: 10, color: "#c0392b" },
  muted: { color: "#667085", fontSize: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#eceff4",
  },
  rowCode: { fontSize: 15, fontWeight: "600" },
  actions: { flexDirection: "row" },
  done: { opacity: 0.5 },
  close: { padding: 14, alignItems: "center" },
  closeText: { color: "#2a6fdb", fontSize: 15 },
});
