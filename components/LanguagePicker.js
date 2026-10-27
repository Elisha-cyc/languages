import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SPEECH_LANGUAGES } from "../speech";


// The languages a person can read explanations in: English plus the 20 languages
export const NATIVE_OPTIONS = ["English", ...SPEECH_LANGUAGES];

export default function LanguagePicker({
  value,
  onChange,
  options = SPEECH_LANGUAGES,
  title = "Choose a language",
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.arrow}>▼</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <ScrollView>
              {options.map((name) => (
                <Pressable
                  key={name}
                  style={[styles.option, name === value && styles.optionOn]}
                  onPress={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      name === value && styles.optionTextOn,
                    ]}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d5d9e0",
  },
  value: { fontSize: 16 },
  arrow: { fontSize: 12, color: "#666" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "white",
    borderRadius: 12,
    maxHeight: "80%",
    padding: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: "bold", padding: 12 },
  option: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8 },
  optionOn: { backgroundColor: "#dbe7ff" },
  optionText: { fontSize: 16 },
  optionTextOn: { color: "#2a6fdb", fontWeight: "bold" },
});
