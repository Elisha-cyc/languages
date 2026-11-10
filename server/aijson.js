"use strict";

// Asks the AI for a JSON answer, using the server's normal AI_MODEL.
// Tries the model's JSON mode first and, if the model refuses that option,
// asks again without it (our code reads the JSON out of the text either way).

const { complete } = require("./ai");

async function completeJson(messages, maxTokens, model, options = {}) {
  const jsonOptions = {
    ...options,
    response_format: { type: "json_object" },
  };
  try {
    return await complete(messages, maxTokens, model, jsonOptions);
  } catch (err) {
    const message = String(err.message);
    if (/\b400\b/.test(message) && /response_format|json/i.test(message)) {
      return complete(messages, maxTokens, model, options);
    }
    throw err;
  }
}

module.exports = { completeJson };
