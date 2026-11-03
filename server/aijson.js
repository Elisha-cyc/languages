"use strict";

// Asks the AI for a JSON answer, using the server's normal AI_MODEL.
// Tries the model's JSON mode first and, if the model refuses that option,
// asks again without it (our code reads the JSON out of the text either way).

const { complete } = require("./ai");

async function completeJson(messages, maxTokens) {
  try {
    return await complete(messages, maxTokens, undefined, {
      response_format: { type: "json_object" },
    });
  } catch (err) {
    const message = String(err.message);
    if (/\b400\b/.test(message) && /response_format|json/i.test(message)) {
      return complete(messages, maxTokens);
    }
    throw err;
  }
}

module.exports = { completeJson };
