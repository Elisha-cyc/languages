"use strict";

const supabase = require("./supabase");

const clean = (raw) => String(raw || "").replace(/\s/g, "").toUpperCase();

// Looks a code up WITHOUT using it up (so a typo in the username does not burn it)
async function findInvite(raw) {
  const code = clean(raw);
  if (!code) return null;

  const { data, error } = await supabase
    .from("invite_codes")
    .select("id, label")
    .eq("code", code)
    .is("used_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw new Error(`Invite lookup failed: ${error.message}`);
  return data || null;
}

// Uses the code up. Returns { id, label }, or null if someone else got it first.
async function claimInvite(raw) {
  const { data, error } = await supabase.rpc("claim_invite_code", {
    p_code: String(raw || ""),
  });
  if (error) throw new Error(`Invite claim failed: ${error.message}`);
  return data && data.length > 0 ? data[0] : null;
}

async function releaseInvite(id) {
  const { error } = await supabase.rpc("release_invite_code", { p_id: id });
  if (error) console.error("Could not release invite:", error.message);
}

async function attachInvite(id, userId) {
  const { error } = await supabase
    .from("invite_codes")
    .update({ used_by: userId })
    .eq("id", id);
  if (error) console.error("Could not link invite to user:", error.message);
}

module.exports = { findInvite, claimInvite, releaseInvite, attachInvite };
