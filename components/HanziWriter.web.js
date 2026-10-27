import { useEffect, useRef } from "react";
import { API_URL } from "../config";

export default function HanziWriter({
  char,
  mode = "animate",
  blind = false,
  size = 260,
  onResult,
}) {
  const frame = useRef(null);

  useEffect(() => {
    function handle(event) {
      if (!frame.current || event.source !== frame.current.contentWindow)
        return;
      try {
        onResult && onResult(JSON.parse(event.data));
      } catch (e) {
        // not a message from the writer page
      }
    }
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [onResult]);

  const src = `${API_URL}/hanzi/writer?char=${encodeURIComponent(char)}&mode=${mode}&outline=${blind ? 0 : 1}&size=${size}`;

  return (
    <iframe
      ref={frame}
      key={src}
      src={src}
      title="Chinese character"
      style={{
        border: "none",
        width: size + 30,
        height: size + 150,
        maxWidth: "100%",
      }}
    />
  );
}
