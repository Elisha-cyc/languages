const { spawnSync } = require("node:child_process");
const { LANGUAGES, LEVELS } = require("./curriculum");

// Level by level, so every language gets its Beginner course first
for (const level of LEVELS) {
  for (const language of LANGUAGES) {
    console.log(`\n=== ${language} ${level.name} ===`);

    const result = spawnSync(
      process.execPath,
      ["--env-file=.env", "generate.js", language, level.name],
      { stdio: "inherit" },
    );

       if (result.status === 2) {
         console.log(
           '\nStopped at a limit. Run "node generate-all.js" again later; it continues where it stopped.',
         );
         process.exit(0);
       }

       if (result.status !== 0) {
         console.log(
           `\nStopped because generate.js failed on ${language} ${level.name} (exit code ${result.status}). Fix the error shown above, then run this again.`,
         );
         process.exit(1);
       }
  }
}

console.log("\nAll languages and levels are finished.");
