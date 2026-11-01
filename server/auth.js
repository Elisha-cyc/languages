
"use strict";

const express = require("express");
const crypto = require("node:crypto");
const supabase = require("./supabase");
const { LANGUAGES } = require("./curriculum");

const router = express.Router();

const SESSION_DAYS = 30;
const NATIVE_OPTIONS = ["English", ...LANGUAGES];

// ---------- Passwords and tokens ----------

const sha256 = (text) =>
  crypto.createHash("sha256").update(text).digest("hex");

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function checkPassword(password, stored) {
  try {
    const [saltHex, hashHex] = String(stored || "").split(":");

    if (!saltHex || !hashHex || !/^[a-f0-9]+$/i.test(saltHex) ||
        !/^[a-f0-9]+$/i.test(hashHex)) {
      return false;
    }

    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");

    if (salt.length !== 16 || expected.length !== 64) return false;

    const actual = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const DUMMY_HASH = hashPassword("not-a-real-password");

function sameText(a, b) {
  const first = Buffer.from(sha256(String(a)), "hex");
  const second = Buffer.from(sha256(String(b)), "hex");
  return crypto.timingSafeEqual(first, second);
}

function tokenFrom(req) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(
    req.get("authorization") || "",
  );
  return match ? match[1] : null;
}

// ---------- Rate limiting ----------

const attempts = new Map();

function tooManyAttempts(key) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const recent = (attempts.get(key) || []).filter(
    (time) => now - time < windowMs,
  );

  recent.push(now);
  attempts.set(key, recent);

  // Prevent this in-memory map growing indefinitely.
  if (attempts.size > 5000) {
    for (const [storedKey, times] of attempts) {
      if (!times.some((time) => now - time < windowMs)) {
        attempts.delete(storedKey);
      }
    }
  }

  return recent.length > 8;
}

// ---------- Session helpers ----------

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.from("sessions").insert({
    token_hash: sha256(token),
    user_id: userId,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("Session creation failed:", error.message);
    throw new Error("Could not create a login session.");
  }

  return token;
}

async function userFromRequest(req) {
  const token = tokenFrom(req);
  if (!token) return null;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("user_id")
    .eq("token_hash", sha256(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError) {
    console.error("Session lookup failed:", sessionError.message);
    throw new Error("Could not verify your login session.");
  }

  if (!session) return null;

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, username, native_language")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError) {
    console.error("User lookup failed:", userError.message);
    throw new Error("Could not load your account.");
  }

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    nativeLanguage: user.native_language || "",
  };
}

function handleAuthError(res, error) {
  console.error("Authentication error:", error.message);
  return res.status(500).json({
    error: "An authentication error occurred. Please try again.",
  });
}

// ---------- Register ----------

router.post("/register", async (req, res) => {
  try {
    const { password, name, inviteCode, nativeLanguage } = req.body || {};

    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();

    const invite = process.env.INVITE_CODE;

    if (!invite) {
      return res.status(503).json({
        error:
          "Sign-up is closed. The owner must set INVITE_CODE in server/.env.",
      });
    }

    if (tooManyAttempts(`register|${req.ip}`)) {
      return res.status(429).json({
        error: "Too many attempts. Try again later.",
      });
    }

    if (
      typeof inviteCode !== "string" ||
      !sameText(inviteCode.trim(), invite)
    ) {
      return res.status(403).json({
        error: "That invite code is not right.",
      });
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({
        error: "Username: 3 to 20 letters, numbers or underscores.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 100
    ) {
      return res.status(400).json({
        error: "Password: at least 8 characters.",
      });
    }

    const displayName =
      typeof name === "string" && name.trim()
        ? name.trim().slice(0, 40)
        : username;

    const native = NATIVE_OPTIONS.includes(nativeLanguage)
      ? nativeLanguage
      : "";

    const { data: existing, error: lookupError } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) {
      return handleAuthError(res, lookupError);
    }

    if (existing) {
      return res.status(409).json({
        error: "That username is taken.",
      });
    }

    const passwordHash = hashPassword(password);

    // Preserve the existing learner's progress by claiming user ID 1
    // when that account has not yet been registered.
    const { data: firstUser, error: firstUserError } = await supabase
      .from("users")
      .select("id, username")
      .eq("id", 1)
      .maybeSingle();

    if (firstUserError) {
      return handleAuthError(res, firstUserError);
    }

    let user;

    if (firstUser && !firstUser.username) {
      const { data, error } = await supabase
        .from("users")
        .update({
          username,
          password_hash: passwordHash,
          name: displayName,
          native_language: native,
        })
        .eq("id", 1)
        .is("username", null)
        .select("id, name, username, native_language")
        .maybeSingle();

      if (error) return handleAuthError(res, error);

      if (!data) {
        return res.status(409).json({
          error: "The account changed. Please try registering again.",
        });
      }

      user = data;
    } else {
      const { data, error } = await supabase
        .from("users")
        .insert({
          name: displayName,
          username,
          password_hash: passwordHash,
          native_language: native,
        })
        .select("id, name, username, native_language")
        .single();

      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            error: "That username is taken.",
          });
        }
        return handleAuthError(res, error);
      }

      user = data;
    }

    const token = await createSession(user.id);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        nativeLanguage: user.native_language || "",
      },
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

// ---------- Login ----------

router.post("/login", async (req, res) => {
  try {
    const { password } = req.body || {};

    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();

    if (tooManyAttempts(`login|${req.ip}|${username}`)) {
      return res.status(429).json({
        error: "Too many attempts. Try again in 15 minutes.",
      });
    }

    if (!username || typeof password !== "string") {
      return res.status(400).json({
        error: "Enter your username and password.",
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, username, password_hash, native_language")
      .eq("username", username)
      .maybeSingle();

    if (error) return handleAuthError(res, error);

    // Check a dummy hash for unknown usernames to reduce timing differences.
    const passwordValid = checkPassword(
      password,
      user ? user.password_hash : DUMMY_HASH,
    );

    if (!user || !passwordValid) {
      return res.status(401).json({
        error: "Wrong username or password.",
      });
    }

    const token = await createSession(user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        nativeLanguage: user.native_language || "English",
      },
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

// ---------- Current user ----------

router.get("/me", async (req, res) => {
  try {
    const user = await userFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: "Please log in.",
      });
    }

    return res.json(user);
  } catch (error) {
    return handleAuthError(res, error);
  }
});

// ---------- Change native language ----------

router.post("/native-language", async (req, res) => {
  try {
    const user = await userFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: "Please log in.",
      });
    }

    const { nativeLanguage } = req.body || {};

    if (!NATIVE_OPTIONS.includes(nativeLanguage)) {
      return res.status(400).json({
        error: "Choose a language from the list.",
      });
    }

    const { error } = await supabase
      .from("users")
      .update({ native_language: nativeLanguage })
      .eq("id", user.id);

    if (error) return handleAuthError(res, error);

    return res.json({ nativeLanguage });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

// ---------- Logout ----------

router.post("/logout", async (req, res) => {
  try {
    const token = tokenFrom(req);

    if (token) {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("token_hash", sha256(token));

      if (error) return handleAuthError(res, error);
    }

    return res.json({ ok: true });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

// ---------- Protect every other route ----------

const PUBLIC = [
  /^\/$/,
  /^\/auth\//,
  /^\/hanzi\/writer$/,
  /^\/hanzi\/lib\//,
  /^\/hanzi\/data\//,
];

async function requireAuth(req, res, next) {
  if (
    req.method === "OPTIONS" ||
    PUBLIC.some((pattern) => pattern.test(req.path))
  ) {
    return next();
  }

  try {
    const user = await userFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: "Please log in.",
      });
    }

    req.user = user;

    // The server decides the authenticated user ID.
    Object.defineProperty(req, "query", {
      value: { ...req.query, user: String(user.id) },
      writable: true,
      configurable: true,
    });

    if (
      req.body &&
      typeof req.body === "object" &&
      !Array.isArray(req.body)
    ) {
      req.body.user_id = user.id;
    }

    return next();
  } catch (error) {
    return handleAuthError(res, error);
  }
}

module.exports = { router, requireAuth };
