import { useState, useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { API_URL } from "./config";

export function useFetch(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;
    setError(null);

    fetch(`${API_URL}${path}`)
      .then((res) => res.json())
      .then((result) => setData(result))
      .catch(() => setError("Could not reach the server"));
  }, [path, isFocused]);

  return { data, error };
}
