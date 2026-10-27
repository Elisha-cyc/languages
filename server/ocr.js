const { createWorker } = require("tesseract.js");

// Our language names mapped to Tesseract's language codes
const OCR_LANGUAGES = {
  French: "fra",
  Spanish: "spa",
  German: "deu",
  Italian: "ita",
  Portuguese: "por",
  Dutch: "nld",
  Swedish: "swe",
  Polish: "pol",
  Turkish: "tur",
  Indonesian: "ind",
  Swahili: "swa",
  Russian: "rus",
  "Mandarin Chinese": "chi_sim",
  Japanese: "jpn",
  Korean: "kor",
  Hindi: "hin",
  Arabic: "ara",
  Greek: "ell",
  Hebrew: "heb",
  Thai: "tha",
};

const TIMEOUT_MS = 90 * 1000;

// OCR is heavy, so jobs wait in line and run one at a time
let queue = Promise.resolve();

async function recognize(bytes, code) {
  const worker = await createWorker(code);
  let timer;
  try {
    const job = worker.recognize(bytes);
    job.catch(() => {}); // avoids a crash if we cancel the job on timeout

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("OCR timed out")), TIMEOUT_MS);
    });

    const result = await Promise.race([job, timeout]);
    return result.data.text;
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}

async function imageToText(bytes, languageName) {
  const code = OCR_LANGUAGES[languageName];
  if (!code) throw new Error(`No OCR support for ${languageName}`);

  const job = queue.then(() => recognize(bytes, code));
  queue = job.catch(() => {}); // one failed job must not block the line
  return job;
}

module.exports = { imageToText, OCR_LANGUAGES };
