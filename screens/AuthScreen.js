import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { useAuth } from "../auth";
import LanguagePicker, { NATIVE_OPTIONS } from "../components/LanguagePicker";

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [nativeLanguage, setNativeLanguage] = useState("English");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(username, password);
      else
        await register({
          username,
          password,
          name,
          inviteCode,
          nativeLanguage,
        });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const registering = mode === "register";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.logo}>LinguaApp</Text>
      <Text style={styles.title}>
        {registering ? "Create your account" : "Log in"}
      </Text>

      {registering && (
        <>
          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Elisha"
          />
        </>
      )}

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="letters, numbers, _"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholder="at least 8 characters"
        onSubmitEditing={submit}
      />

      {registering && (
        <>
          <Text style={styles.label}>Invite code</Text>
          <TextInput
            style={styles.input}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="from the app owner"
          />
        </>
      )}

      <Text style={styles.label}>
        Your language (explanations are written in it)
      </Text>
      <LanguagePicker
        value={nativeLanguage}
        onChange={setNativeLanguage}
        options={NATIVE_OPTIONS}
        title="Your language"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, busy && styles.disabled]}
        disabled={busy}
        onPress={submit}
      >
        <Text style={styles.buttonText}>
          {busy ? "Please wait..." : registering ? "Create account" : "Log in"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.link}
        onPress={() => {
          setMode(registering ? "login" : "register");
          setError(null);
        }}
      >
        <Text style={styles.linkText}>
          {registering
            ? "I already have an account"
            : "New here? Create an account"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#f2f4f8",
    justifyContent: "center",
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2a6fdb",
    textAlign: "center",
  },
  title: { fontSize: 20, textAlign: "center", marginTop: 6, marginBottom: 16 },
  label: { fontSize: 14, color: "#555", marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  error: {
    marginTop: 14,
    color: "#c0392b",
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#2a6fdb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "white", fontSize: 18 },
  disabled: { opacity: 0.5 },
  link: { marginTop: 16, padding: 10, alignItems: "center" },
  linkText: { color: "#2a6fdb", fontSize: 15 },
});
