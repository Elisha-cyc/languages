"use strict";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const test = require("node:test");
const assert = require("node:assert/strict");
const supabase = require("./supabase");
const { saveEveningQuiz } = require("./sleep");

test("evening quiz uses the exact Supabase RPC argument names", async () => {
  const originalRpc = supabase.rpc;
  let captured = null;

  supabase.rpc = async (name, args) => {
    captured = { name, args };
    return { data: true, error: null };
  };

  try {
    const results = [{ item_id: 12, is_correct: true }];
    const response = await saveEveningQuiz(7, results);

    assert.equal(response.data, true);
    assert.equal(captured.name, "save_sleep_evening_quiz");
    assert.deepEqual(captured.args, {
      p_session_id: 7,
      p_results: results,
    });
    assert.equal(Object.hasOwn(captured.args, "p_result"), false);
  } finally {
    supabase.rpc = originalRpc;
  }
});
