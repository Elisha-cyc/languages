"use strict";

const supabase = require("./supabase");

const lessonId = Number(process.argv[2]);
if (!Number.isInteger(lessonId)) {
  console.log("Usage: node --env-file=.env reset.js <lessonId>");
  process.exit(1);
}

async function main() {
  // Same behavior as before: delete the words, mark the lesson empty
  const { error } = await supabase.rpc("reset_lessons", {
    p_ids: [lessonId],
    p_delete_progress: false,
  });
  if (error) throw new Error(error.message);

  console.log(`Lesson ${lessonId} reset. Run generate.js to fill it again.`);
}

main().catch((err) => {
  console.error("Reset failed:", err.message);
  process.exit(1);
});
