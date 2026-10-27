const fs = require("fs");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

pdfParse(fs.readFileSync(process.argv[2]))
  .then((result) =>
    console.log(
      "OK, characters:",
      result.text.length,
      "\n",
      result.text.slice(0, 200),
    ),
  )
  .catch((err) => console.error("FAILED:", err));
