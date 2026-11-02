"use strict";

// A private page for the owner, usable from a phone:
//   https://YOUR-SERVER.vercel.app/admin
// Create invitation codes, copy them, see which are used, cancel unused ones.
// Protected by ADMIN_PASSWORD (set it in the server environment).
// Without ADMIN_PASSWORD the page does not exist.

const express = require("express");
const crypto = require("node:crypto");
const supabase = require("./supabase");

const router = express.Router();

// No 0/O or 1/I, so codes are easy to read out loud
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  const part = () =>
    Array.from(
      { length: 4 },
      () => ALPHABET[crypto.randomInt(ALPHABET.length)],
    ).join("");
  return `LING-${part()}-${part()}`;
}

const digest = (text) =>
  crypto.createHash("sha256").update(String(text)).digest();

function passwordOk(req) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  return crypto.timingSafeEqual(
    digest(req.get("x-admin-password") || ""),
    digest(real),
  );
}

// Wrong passwords: 8 tries per 15 minutes per address
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;

function clientKey(req) {
  return (
    String(req.get("x-forwarded-for") || "")
      .split(",")[0]
      .trim() ||
    req.ip ||
    "unknown"
  );
}

function recentFailures(key) {
  const now = Date.now();
  const list = (failures.get(key) || []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, list);
  return list;
}

function guard(req, res, next) {
  if (!process.env.ADMIN_PASSWORD) return res.status(404).send("Not found");

  const key = clientKey(req);
  if (recentFailures(key).length >= 8) {
    return res
      .status(429)
      .json({ error: "Too many wrong passwords. Try again in 15 minutes." });
  }
  if (!passwordOk(req)) {
    recentFailures(key).push(Date.now());
    return res.status(401).json({ error: "Wrong password." });
  }
  next();
}

// ---------- The page ----------

router.get("/", (req, res) => {
  if (!process.env.ADMIN_PASSWORD) return res.status(404).send("Not found");
  res.set("Cache-Control", "no-store");
  res.type("html").send(PAGE);
});

// ---------- The actions ----------

router.get("/api/list", guard, async (req, res) => {
  const { data, error } = await supabase
    .from("invite_codes")
    .select("code, label, used_at, revoked_at")
    .order("id", { ascending: false })
    .limit(100);
  if (error)
    return res.status(500).json({ error: "Could not load the codes." });
  res.json({ codes: data, appUrl: process.env.APP_URL || "" });
});

router.post("/api/create", guard, async (req, res) => {
  const label = String((req.body && req.body.label) || "")
    .trim()
    .slice(0, 40);
  const code = newCode();
  const { error } = await supabase
    .from("invite_codes")
    .insert({ code, label: label || "Unnamed" });
  if (error)
    return res.status(500).json({ error: "Could not create the code." });
  res
    .status(201)
    .json({
      code,
      label: label || "Unnamed",
      appUrl: process.env.APP_URL || "",
    });
});

router.post("/api/revoke", guard, async (req, res) => {
  const code = String((req.body && req.body.code) || "").toUpperCase();
  const { data, error } = await supabase
    .from("invite_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("code", code)
    .is("used_at", null)
    .select("code");
  if (error)
    return res.status(500).json({ error: "Could not cancel the code." });
  res.json({ revoked: data.length > 0 });
});

// The page itself. Its script uses plain quotes (no backticks) on purpose,
// because this whole page sits inside one template string.
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>LinguaApp invites</title>
<style>
  :root { color-scheme: light dark; --bg:#f2f4f8; --card:#fff; --text:#16181d; --muted:#667085; --line:#d9dee7; --blue:#2a6fdb; --red:#c0392b; }
  @media (prefers-color-scheme: dark) { :root { --bg:#101216; --card:#1a1d23; --text:#eef0f4; --muted:#98a1b0; --line:#2b3039; --blue:#5b94ee; --red:#ef6b5c; } }
  * { box-sizing: border-box; }
  body { margin:0; padding:16px; background:var(--bg); color:var(--text); font:16px/1.4 -apple-system, system-ui, Segoe UI, sans-serif; }
  main { max-width:520px; margin:0 auto; }
  h1 { font-size:22px; margin:8px 0 16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:14px; }
  input { width:100%; padding:14px; font-size:16px; border:1px solid var(--line); border-radius:10px; background:var(--bg); color:var(--text); margin:6px 0 12px; }
  button { width:100%; padding:14px; font-size:16px; font-weight:600; border:0; border-radius:10px; background:var(--blue); color:#fff; margin-top:4px; }
  button.light { background:transparent; color:var(--blue); border:1px solid var(--line); padding:10px; width:auto; margin:0 6px 0 0; font-size:14px; }
  button.danger { color:var(--red); }
  .code { font:700 24px/1.2 ui-monospace, Menlo, monospace; letter-spacing:1px; word-break:break-all; margin:6px 0 12px; }
  .row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 0; border-top:1px solid var(--line); flex-wrap:wrap; }
  .row:first-child { border-top:0; }
  .small { color:var(--muted); font-size:14px; }
  .err { color:var(--red); margin:8px 0 0; min-height:20px; }
  .used { opacity:.55; }
  .hidden { display:none; }
  .field { position:relative; }
  .field input { padding-right:52px; }
  button.eye { position:absolute; right:4px; top:6px; width:44px; height:48px; margin:0; padding:0; background:transparent; color:var(--muted); display:flex; align-items:center; justify-content:center; }
  button.eye svg { width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
</style>
</head>
<body>
<main>
  <h1>LinguaApp invites</h1>

  <div id="lock" class="card">
    <label class="small" for="pw">Admin password</label>
    <div class="field">
      <input id="pw" type="password" autocomplete="off" autocapitalize="off">
      <button type="button" class="eye" id="eye" aria-label="Show password">
        <svg id="eyeOpen" viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
        <svg id="eyeShut" class="hidden" viewBox="0 0 24 24"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      </button>
    </div>
    <button id="unlock">Unlock</button>
    <p id="lockErr" class="err"></p>
  </div>

  <div id="panel" class="hidden">
    <div class="card">
      <label class="small" for="label">Who is this code for? (optional)</label>
      <input id="label" type="text" maxlength="40" placeholder="Name">
      <button id="create">Create a new code</button>
      <p id="createErr" class="err"></p>
      <div id="fresh" class="hidden">
        <div class="code" id="freshCode"></div>
        <button class="light" id="copyCode">Copy code</button>
        <button class="light" id="shareMsg">Share invitation</button>
      </div>
    </div>

    <div class="card">
      <strong>All codes</strong>
      <div id="list"></div>
    </div>
  </div>
</main>

<script>
var password = "";
var appUrl = "";
var $ = function (id) { return document.getElementById(id); };

function api(path, method, body) {
  var options = { method: method, headers: { "x-admin-password": password, "Content-Type": "application/json" } };
  if (body) options.body = JSON.stringify(body);
  return fetch("/admin/api/" + path, options).then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      return data;
    });
  });
}

function inviteMessage(code) {
  var where = appUrl || "[the app address]";
  return "Hi! I made a language learning app and I would love you to try it. " +
    "Open " + where + ", tap Create an account, and use this invite code: " + code +
    " It only works once, so please do not share it.";
}

function copyText(text, button) {
  var done = function () { var old = button.textContent; button.textContent = "Copied"; setTimeout(function () { button.textContent = old; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copy this:", text); });
  } else {
    window.prompt("Copy this:", text);
  }
}

function render(codes) {
  var box = $("list");
  box.textContent = "";
  if (codes.length === 0) { box.textContent = "No codes yet."; return; }
  codes.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "row" + (item.used_at || item.revoked_at ? " used" : "");

    var text = document.createElement("div");
    var code = document.createElement("div");
    code.style.fontFamily = "ui-monospace, Menlo, monospace";
    code.textContent = item.code;
    var info = document.createElement("div");
    info.className = "small";
    info.textContent = item.label + " - " + (item.revoked_at ? "cancelled" : item.used_at ? "used" : "unused");
    text.appendChild(code);
    text.appendChild(info);
    row.appendChild(text);

    if (!item.used_at && !item.revoked_at) {
      var actions = document.createElement("div");
      var copy = document.createElement("button");
      copy.className = "light"; copy.textContent = "Copy";
      copy.onclick = function () { copyText(inviteMessage(item.code), copy); };
      var cancel = document.createElement("button");
      cancel.className = "light danger"; cancel.textContent = "Cancel";
      cancel.onclick = function () {
        if (!window.confirm("Cancel " + item.code + "?")) return;
        api("revoke", "POST", { code: item.code }).then(refresh);
      };
      actions.appendChild(copy);
      actions.appendChild(cancel);
      row.appendChild(actions);
    }
    box.appendChild(row);
  });
}

function refresh() {
  return api("list", "GET").then(function (data) {
    appUrl = data.appUrl || "";
    render(data.codes);
  });
}

$("eye").onclick = function () {
  var show = $("pw").type === "password";
  $("pw").type = show ? "text" : "password";
  $("eyeOpen").classList.toggle("hidden", show);
  $("eyeShut").classList.toggle("hidden", !show);
  $("eye").setAttribute("aria-label", show ? "Hide password" : "Show password");
};

$("unlock").onclick = function () {
  password = $("pw").value;
  $("lockErr").textContent = "";
  refresh().then(function () {
    $("lock").classList.add("hidden");
    $("panel").classList.remove("hidden");
  }, function (e) { $("lockErr").textContent = e.message; password = ""; });
};

$("create").onclick = function () {
  $("createErr").textContent = "";
  api("create", "POST", { label: $("label").value }).then(function (data) {
    appUrl = data.appUrl || appUrl;
    $("freshCode").textContent = data.code;
    $("fresh").classList.remove("hidden");
    $("label").value = "";
    return refresh();
  }).catch(function (e) { $("createErr").textContent = e.message; });
};

$("copyCode").onclick = function () { copyText($("freshCode").textContent, $("copyCode")); };

$("shareMsg").onclick = function () {
  var text = inviteMessage($("freshCode").textContent);
  if (navigator.share) { navigator.share({ text: text }).catch(function () {}); }
  else { copyText(text, $("shareMsg")); }
};
</script>
</body>
</html>`;

module.exports = router;
