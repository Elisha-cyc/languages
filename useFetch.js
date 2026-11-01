import { useState, useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { API_URL } from "./config";

export function useFetch(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}${path}`);

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            result?.error || `Request failed (${response.status})`,
          );
        }

        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not reach the server",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [path, isFocused]);

  return { data, error, loading };
}
