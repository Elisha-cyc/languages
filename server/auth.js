const express = require("express");
const crypto = require("node:crypto");
const db = require("./database");
const { LANGUAGES } = require("./curriculum");

const router = express.Router();
const SESSION_DAYS = 30;
const NATIVE_OPTIONS = ["English", ...LANGUAGES];

// ---------- Tables ----------
function addColumnIfMissing(table, column, definition) {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((col) => col.name);
  if (!columns.includes(column))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumnIfMissing("users", "username", "TEXT");
addColumnIfMissing("users", "password_hash", "TEXT");
addColumnIfMissing("users", "native_language", "TEXT");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users(username)");
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL
  );
`);

// ---------- Passwords and tokens ----------
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function checkPassword(password, stored) {
  const [saltHex, hashHex] = String(stored || "").split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return crypto.timingSafeEqual(actual, expected);
}

const DUMMY_HASH = hashPassword("not-a-real-password"); // so a wrong username takes as long as a wrong password

function sameText(a, b) {
  return crypto.timingSafeEqual(
    Buffer.from(sha256(String(a)), "hex"),
    Buffer.from(sha256(String(b)), "hex"),
  );
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(sha256(token), userId, expires);
  return token;
}

function tokenFrom(req) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get("authorization") || "");
  return match ? match[1] : null;
}

function userFromRequest(req) {
  const token = tokenFrom(req);
  if (!token) return null;
  const user = db
    .prepare(
      `SELECT users.id, users.name, users.username,
              users.native_language AS nativeLanguage
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(sha256(token), new Date().toISOString());
  if (!user) return null;
  return { ...user, nativeLanguage: user.nativeLanguage || "English" };
}

// Slow down guessing: 8 attempts per 15 minutes for each address and username
const attempts = new Map();
function tooManyAttempts(key) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(
    (t) => now - t < 15 * 60 * 1000,
  );
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > 8;
}

// ---------- Routes ----------
router.post("/register", (req, res) => {
  const { password, name, inviteCode, nativeLanguage } = req.body || {};
  const username = String((req.body || {}).username || "")
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
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again later." });
  }
  if (typeof inviteCode !== "string" || !sameText(inviteCode.trim(), invite)) {
    return res.status(403).json({ error: "That invite code is not right." });
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res
      .status(400)
      .json({ error: "Username: 3 to 20 letters, numbers or underscores." });
  }
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 100
  ) {
    return res.status(400).json({ error: "Password: at least 8 characters." });
  }
  const displayName =
    typeof name === "string" && name.trim()
      ? name.trim().slice(0, 40)
      : username;
  const native = NATIVE_OPTIONS.includes(nativeLanguage)
    ? nativeLanguage
    : "English";

  if (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) {
    return res.status(409).json({ error: "That username is taken." });
  }

  const hash = hashPassword(password);
  let userId;

  // The first account takes over user 1, so the progress made so far is kept
  const first = db
    .prepare("SELECT id FROM users WHERE id = 1 AND username IS NULL")
    .get();
  if (first) {
    db.prepare(
      "UPDATE users SET username = ?, password_hash = ?, name = ?, native_language = ? WHERE id = 1",
    ).run(username, hash, displayName, native);
    userId = 1;
  } else {
    const result = db
      .prepare(
        "INSERT INTO users (name, username, password_hash, native_language) VALUES (?, ?, ?, ?)",
      )
      .run(displayName, username, hash, native);
    userId = Number(result.lastInsertRowid);
  }

  res.status(201).json({
    token: createSession(userId),
    user: { id: userId, name: displayName, username, nativeLanguage: native },
  });
});

router.post("/login", (req, res) => {
  const { password } = req.body || {};
  const username = String((req.body || {}).username || "")
    .trim()
    .toLowerCase();

  if (tooManyAttempts(`login|${req.ip}|${username}`)) {
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again in 15 minutes." });
  }
  if (!username || typeof password !== "string") {
    return res.status(400).json({ error: "Enter your username and password." });
  }

  const row = db
    .prepare(
      "SELECT id, name, username, password_hash, native_language FROM users WHERE username = ?",
    )
    .get(username);
  const ok =
    checkPassword(password, row ? row.password_hash : DUMMY_HASH) && row;
  if (!ok)
    return res.status(401).json({ error: "Wrong username or password." });

  res.json({
    token: createSession(row.id),
    user: {
      id: row.id,
      name: row.name,
      username: row.username,
      nativeLanguage: row.native_language || "English",
    },
  });
});

router.get("/me", (req, res) => {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Please log in." });
  res.json(user);
});

// Change the language the explanations are written in
router.post("/native-language", (req, res) => {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Please log in." });

  const { nativeLanguage } = req.body || {};
  if (!NATIVE_OPTIONS.includes(nativeLanguage)) {
    return res.status(400).json({ error: "Choose a language from the list." });
  }
  db.prepare("UPDATE users SET native_language = ? WHERE id = ?").run(
    nativeLanguage,
    user.id,
  );
  res.json({ nativeLanguage });
});

router.post("/logout", (req, res) => {
  const token = tokenFrom(req);
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  res.json({ ok: true });
});

// ---------- Protects every other route ----------
// The pages that the writing view loads inside an iframe or webview cannot send a login header
const PUBLIC = [
  /^\/$/,
  /^\/auth\//,
  /^\/hanzi\/writer$/,
  /^\/hanzi\/lib\//,
  /^\/hanzi\/data\//,
];

function requireAuth(req, res, next) {
  if (
    req.method === "OPTIONS" ||
    PUBLIC.some((pattern) => pattern.test(req.path))
  )
    return next();

  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Please log in." });
  req.user = user;

  // The server decides who the user is: any user id sent by the app is replaced
  Object.defineProperty(req, "query", {
    value: { ...req.query, user: String(user.id) },
    writable: true,
    configurable: true,
  });
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    req.body.user_id = user.id;
  }
  next();
}

module.exports = { router, requireAuth };
