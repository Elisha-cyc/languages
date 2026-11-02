"use strict";

// Hand out one invitation code per person.
//
//   node --env-file=.env make-invite.js create "Mom" "Dad" "Ama"
//   node --env-file=.env make-invite.js spare 5          (5 unnamed codes)
//   node --env-file=.env make-invite.js label LING-7KQ2-M9XD "Mom"   (name one later)
//   node --env-file=.env make-invite.js list
//   node --env-file=.env make-invite.js revoke LING-7KQ2-M9XD

const crypto = require("node:crypto");
const supabase = require("./supabase");

// No 0/O or 1/I, so codes are easy to read out loud
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  const pick = () =>
    Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
  return `LING-${pick()}-${pick()}`;
}

async function create(labels) {
  if (labels.length === 0) {
    console.log('Usage: make-invite.js create "Name 1" "Name 2" ...');
    return;
  }

  const rows = labels.map((label) => ({ code: newCode(), label }));
  const { error } = await supabase.from("invite_codes").insert(rows);
  if (error) throw new Error(error.message);

  console.log("Send each person their own code:\n");
  for (const row of rows) console.log(`${row.code}   ${row.label}`);
}

async function spare(countText) {
  const count = Number(countText);
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    return console.log("Usage: make-invite.js spare <how many, 1 to 50>");
  }
  await create(Array.from({ length: count }, (_, i) => `Spare ${Date.now().toString().slice(-5)}-${i + 1}`));
  console.log('\nWhen you know who has a code, name it with:');
  console.log('  node --env-file=.env make-invite.js label <CODE> "Their name"');
}

async function label(code, name) {
  if (!code || !name) {
    return console.log('Usage: make-invite.js label <CODE> "Their name"');
  }
  const { data, error } = await supabase
    .from("invite_codes")
    .update({ label: name })
    .eq("code", code.toUpperCase())
    .select("code");
  if (error) throw new Error(error.message);
  console.log(data.length ? `${code.toUpperCase()} is now labelled "${name}".` : "No code with that value.");
}

async function list() {
  const { data, error } = await supabase
    .from("invite_codes")
    .select("code, label, created_at, used_at, used_by, revoked_at")
    .order("id");
  if (error) throw new Error(error.message);

  if (data.length === 0) return console.log("No invite codes yet.");
  for (const row of data) {
    const status = row.revoked_at
      ? "REVOKED"
      : row.used_at
        ? `used ${row.used_at.slice(0, 10)} (user ${row.used_by ?? "?"})`
        : "unused";
    console.log(`${row.code}   ${String(row.label).padEnd(20)} ${status}`);
  }
}

async function revoke(code) {
  if (!code) return console.log("Usage: make-invite.js revoke <CODE>");
  const { data, error } = await supabase
    .from("invite_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("code", code.toUpperCase())
    .is("used_at", null)
    .select("code");
  if (error) throw new Error(error.message);
  console.log(
    data.length ? `Revoked ${code.toUpperCase()}.` : "No unused code with that value.",
  );
}

const [command, ...rest] = process.argv.slice(2);
const actions = {
  create: () => create(rest),
  spare: () => spare(rest[0]),
  label: () => label(rest[0], rest.slice(1).join(" ")),
  list,
  revoke: () => revoke(rest[0]),
};

(actions[command] || (async () => console.log("Commands: create, spare, label, list, revoke")))().catch(
  (err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  },
);
