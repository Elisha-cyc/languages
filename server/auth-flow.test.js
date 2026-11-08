"use strict";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supabase = require("./supabase");

const state = {
  users: [{ id: 1, name: "First learner", username: null, password_hash: null, native_language: null }],
  sessions: [],
  invites: [{ id: 1, code: "TESTCODE", label: "automated test", used_at: null, revoked_at: null, used_by: null }],
  enrollments: [],
  skills: [{ user_id: 1, language: "French", level: "Beginner", skill: "reading", attempts: 2, best_score: 80, last_score: 80 }],
  progress: [{ user_id: 1, lesson_id: 101, completed_at: new Date().toISOString() }],
  reviews: [{ user_id: 1, language: "French", term: "bonjour", meaning: "hello", due_at: new Date(0).toISOString(), repetitions: 0 }],
};

class FakeQuery {
  constructor(table) {
    this.table = table;
    this.operation = "select";
    this.filters = [];
    this.payload = null;
  }
  select() { return this; }
  insert(payload) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload) { this.operation = "update"; this.payload = payload; return this; }
  delete() { this.operation = "delete"; return this; }
  upsert(payload) { this.operation = "upsert"; this.payload = payload; return this; }
  eq(field, value) { this.filters.push(["eq", field, value]); return this; }
  is(field, value) { this.filters.push(["is", field, value]); return this; }
  gt(field, value) { this.filters.push(["gt", field, value]); return this; }
  lte(field, value) { this.filters.push(["lte", field, value]); return this; }
  order() { return this; }
  limit() { return this; }
  matches(row) {
    return this.filters.every(([kind, field, value]) => {
      if (field.includes(".")) return true;
      if (kind === "eq") return row[field] === value;
      if (kind === "is") return row[field] === value;
      if (kind === "gt") return String(row[field]) > String(value);
      if (kind === "lte") return String(row[field]) <= String(value);
      return true;
    });
  }
  execute(single = false) {
    let rows = [];
    if (this.table === "users") rows = state.users;
    if (this.table === "sessions") rows = state.sessions;
    if (this.table === "invite_codes") rows = state.invites;
    if (this.table === "course_enrollments") rows = state.enrollments;
    if (this.table === "course_skill_progress") rows = state.skills;
    if (this.table === "progress") rows = state.progress;
    if (this.table === "vocabulary_reviews") rows = state.reviews;

    if (this.operation === "insert") {
      const values = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (this.table === "users") {
        for (const value of values) {
          const row = { id: 2 + state.users.length, ...value };
          state.users.push(row);
        }
        rows = values.map((value) => state.users.find((row) => row.username === value.username));
      } else if (this.table === "sessions") {
        state.sessions.push(...values);
        rows = values;
      }
      return { data: single ? rows[0] || null : rows, error: null };
    }

    if (this.operation === "update") {
      const changed = rows.filter((row) => this.matches(row) &&
        (this.table !== "users" || !this.filters.some(([kind, field]) => kind === "is" && field === "username") || row.username === null));
      for (const row of changed) Object.assign(row, this.payload);
      return { data: single ? changed[0] || null : changed, error: null };
    }

    if (this.operation === "delete") {
      const keep = rows.filter((row) => !this.matches(row));
      if (this.table === "sessions") state.sessions = keep;
      return { data: null, error: null };
    }

    if (this.operation === "upsert") {
      if (this.table === "course_enrollments") {
        const row = this.payload;
        const old = state.enrollments.find((item) => item.user_id === row.user_id && item.language === row.language && item.level === row.level);
        if (old) Object.assign(old, row);
        else state.enrollments.push({ started_at: new Date().toISOString(), ...row });
        rows = state.enrollments.filter((item) => this.matches(item));
      }
      return { data: single ? rows[0] || null : rows, error: null };
    }

    const found = rows.filter((row) => this.matches(row));
    return { data: single ? found[0] || null : found, error: null };
  }
  maybeSingle() { return Promise.resolve(this.execute(true)); }
  single() { return Promise.resolve(this.execute(true)); }
  then(resolve, reject) { return Promise.resolve(this.execute(false)).then(resolve, reject); }
}

supabase.from = (table) => new FakeQuery(table);
supabase.rpc = async (name, args) => {
  if (name === "claim_invite_code") {
    const invite = state.invites.find((item) => item.code === String(args.p_code || "").toUpperCase() && !item.used_at && !item.revoked_at);
    if (!invite) return { data: [], error: null };
    invite.used_at = new Date().toISOString();
    return { data: [{ id: invite.id, label: invite.label }], error: null };
  }
  if (name === "release_invite_code") {
    const invite = state.invites.find((item) => item.id === args.p_id);
    if (invite) invite.used_at = null;
    return { data: null, error: null };
  }
  return { data: null, error: null };
};

const { router: authRouter, requireAuth } = require("./auth");
const courseRouter = require("./course");
const app = express();
app.use(express.json());
app.use("/auth", authRouter);
app.use(requireAuth);
app.use("/course", courseRouter);
const server = app.listen(0, "127.0.0.1");
const base = new Promise((resolve) => server.once("listening", () => resolve("http://127.0.0.1:" + server.address().port)));

test("registration, login, session restoration and course progress work end to end", async (t) => {
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = await base;

  const registeredResponse = await fetch(url + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "test_learner",
      password: "correct-horse-battery",
      name: "Test Learner",
      inviteCode: "TESTCODE",
      nativeLanguage: "English",
    }),
  });
  const registered = await registeredResponse.json();
  assert.equal(registeredResponse.status, 201);
  assert.equal(registered.user.username, "test_learner");
  assert.ok(registered.token);

  const loginResponse = await fetch(url + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "test_learner", password: "correct-horse-battery" }),
  });
  const loggedIn = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  assert.equal(loggedIn.user.id, registered.user.id);
  assert.ok(loggedIn.token);

  const meResponse = await fetch(url + "/auth/me", {
    headers: { Authorization: "Bearer " + loggedIn.token },
  });
  const me = await meResponse.json();
  assert.equal(meResponse.status, 200);
  assert.equal(me.username, "test_learner");

  const progressResponse = await fetch(url + "/course/progress?language=French&level=Beginner", {
    headers: { Authorization: "Bearer " + loggedIn.token },
  });
  const progress = await progressResponse.json();
  assert.equal(progressResponse.status, 200);
  assert.equal(progress.completedLessons, 1);
  assert.equal(progress.skills[0].best_score, 80);
  assert.equal(progress.dueVocabulary[0].term, "bonjour");

  const logoutResponse = await fetch(url + "/auth/logout", {
    method: "POST",
    headers: { Authorization: "Bearer " + loggedIn.token },
  });
  assert.equal(logoutResponse.status, 200);

  const expiredResponse = await fetch(url + "/auth/me", {
    headers: { Authorization: "Bearer " + loggedIn.token },
  });
  assert.equal(expiredResponse.status, 401);
});
