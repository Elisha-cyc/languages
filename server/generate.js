"use strict";

const { ensureLesson } = require("./lessonmaker");
const { findLessons } = require("./lessonqueries");

const [language, level] = process.argv.slice(2);
if (!language || !level) {
  console.log("Usage: node --env-file=.env generate.js <Language> <Level>");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// lessonmaker already retries a bad AI answer once; this adds waiting for
// rate limits and network hiccups.
async function generateWithRetry(lessonId) {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await ensureLesson(lessonId);
    } catch (err) {
      const message = String(err.message);
      const dailyLimit = message.includes("tokens per day");
      const rateLimited = message.startsWith("429") && !dailyLimit;
      const networkError = message === "fetch failed";

      if (
        dailyLimit ||
        attempt === MAX_ATTEMPTS ||
        !(rateLimited || networkError)
      ) {
        throw err;
      }

      const waitSeconds = rateLimited ? 30 : 10;
      console.log(
        `  retry ${attempt}/${MAX_ATTEMPTS - 1} in ${waitSeconds}s (${rateLimited ? "rate limit" : "network"})`,
      );
      await sleep(waitSeconds * 1000);
    }
  }
}

async function main() {
  const pending = await findLessons(language, level, "empty");
  console.log(`${pending.length} ${language} ${level} lessons to generate...`);
  let done = 0;

  for (const lesson of pending) {
    const label = `${lesson.units.title} #${lesson.position}`;
    try {
      await generateWithRetry(lesson.id);
      done++;
      console.log(`OK  ${label}`);
    } catch (err) {
      const message = String(err.message);
      console.error(`FAIL ${label}: ${message.slice(0, 200)}`);

      if (message.includes("tokens per day")) {
        console.error("Daily token limit reached. Try again tomorrow.");
        process.exitCode = 2;
        break;
      }
      if (message.startsWith("429")) {
        console.error("Still rate limited. Try again in a while.");
        process.exitCode = 2;
        break;
      }
    }

    await sleep(4000);
  }

  console.log(`Finished: ${done} lessons generated.`);
}

main().catch((err) => {
  console.error("Generation failed:", err.message);
  process.exit(1);
});
