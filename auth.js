import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  API_URL,
  setNativeLanguage as setConfigNativeLanguage,
} from "./config";

const KEY = "lingua-session";
const authState =
  globalThis.__linguaAuthState ||
  (globalThis.__linguaAuthState = {
    token: null,
    onUnauthorized: null,
    realFetch: globalThis.fetch.bind(globalThis),
  });

// Every request to our server carries the login token, so no screen has to change
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  const mine = url.startsWith(API_URL);
  let options = init;

  if (mine && authState.token) {
    const requestHeaders =
      init.headers ||
      (input && typeof input === "object" ? input.headers : undefined);
    const headers = new Headers(requestHeaders);
    headers.set("Authorization", `Bearer ${authState.token}`);
    options = { ...init, headers };
  }

  const res = await authState.realFetch(input, options);
  if (
    mine &&
    res.status === 401 &&
    !url.includes("/auth/") &&
    authState.onUnauthorized
  ) {
    authState.onUnauthorized();
  }
  return res;
};

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null });


  const signOutLocal = useCallback(async () => {
    authState.token = null;
    await AsyncStorage.removeItem(KEY);
    setState({ loading: false, user: null });
  }, []);

  useEffect(() => {
    authState.onUnauthorized = signOutLocal;
    return () => {
      authState.onUnauthorized = null;
    };
  }, [signOutLocal]);

  // Reopen the app: use the saved login if it is still valid
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          authState.token = JSON.parse(raw).token;
          const res = await fetch(`${API_URL}/auth/me`);
          if (res.ok) {
            const me = await res.json();
            setConfigNativeLanguage(me.nativeLanguage);
            setState({ loading: false, user: me });
            return;
          }
          authState.token = null;
          await AsyncStorage.removeItem(KEY);
        }
      } catch (e) {
        // the server may be off: show the login screen
      }
      setState({ loading: false, user: null });
    })();
  }, []);

  async function authenticate(path, body) {
    let res;
    try {
      res = await fetch(`${API_URL}/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(
        "Could not reach the server. Is it running, and is API_URL right?",
      );
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");

    authState.token = data.token;
    await AsyncStorage.setItem(KEY, JSON.stringify({ token: authState.token }));
    setConfigNativeLanguage(data.user.nativeLanguage);
    setState({ loading: false, user: data.user });
  }

  const value = useMemo(
    () => ({
      ...state,
      login: (username, password) =>
        authenticate("login", { username, password }),
      register: (fields) => authenticate("register", fields),
      setNative: async (language) => {
        const res = await fetch(`${API_URL}/auth/native-language`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nativeLanguage: language }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not save that");
        setConfigNativeLanguage(data.nativeLanguage);
        setState((s) => ({
          ...s,
          user: { ...s.user, nativeLanguage: data.nativeLanguage },
        }));
      },
      logout: async () => {
        try {
          await fetch(`${API_URL}/auth/logout`, { method: "POST" });
        } catch (e) {
          // log out on this device anyway
        }
        await signOutLocal();
      },
    }),
    [state, signOutLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
