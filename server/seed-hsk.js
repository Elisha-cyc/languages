"use strict";

// Optional one-time warm-up. The API also seeds this curriculum on the first
// Chinese course request, so production deployment does not depend on a shell.
const supabase = require("./supabase");
const { ensureHskCurriculum } = require("./ensure-hsk-curriculum");

ensureHskCurriculum(supabase)
  .then(() => console.log("HSK 1–6 Chinese curriculum is ready."))
  .catch((error) => {
    console.error("Could not prepare the HSK curriculum:", error.message);
    process.exitCode = 1;
  });
