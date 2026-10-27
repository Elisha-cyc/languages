import { View } from "react-native";
import { WebView } from "react-native-webview";
import { API_URL } from "../config";

export default function HanziWriter({
  char,
  mode = "animate",
  blind = false,
  size = 260,
  onResult,
}) {
  const src = `${API_URL}/hanzi/writer?char=${encodeURIComponent(char)}&mode=${mode}&outline=${blind ? 0 : 1}&size=${size}`;

  return (
    <View style={{ width: size + 30, height: size + 150, alignSelf: "center" }}>
      <WebView
        key={src}
        source={{ uri: src }}
        originWhitelist={["*"]}
        scrollEnabled={false}
        style={{ backgroundColor: "transparent" }}
        onMessage={(event) => {
          try {
            onResult && onResult(JSON.parse(event.nativeEvent.data));
          } catch (e) {
            // not a message from the writer page
          }
        }}
      />
    </View>
  );
}
