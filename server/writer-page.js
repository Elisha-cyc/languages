function writerPage(config) {
  const char = JSON.stringify(config.char);
  const size = Number(config.size) || 260;
  const outline = config.outline ? "true" : "false";
  const mode = JSON.stringify(config.mode || "learn");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hanzi Writer</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 20px;
      margin: 0;
      background: #f8fafc;
    }
    #character-target {
      margin: 25px auto;
      width: ${size}px;
      height: ${size}px;
      background: white;
      border: 1px solid #ddd;
    }
    button {
      padding: 10px 18px;
      margin: 5px;
      cursor: pointer;
    }
    #status { margin-top: 15px; }
  </style>
</head>
<body>
  <h2>Chinese Character Practice</h2>
  <div id="character-target"></div>
  <div>
    <button id="animate">Show strokes</button>
    <button id="quiz">Practice writing</button>
  </div>
  <p id="status"></p>

  <script src="/hanzi/lib/hanzi-writer.js"></script>
  <script>
    const character = ${char};
    const mode = ${mode};

    const writer = HanziWriter.create('character-target', character, {
      width: ${size},
      height: ${size},
      padding: 10,
      showOutline: ${outline},
      showCharacter: false,
      charDataLoader: function(char, onLoad, onError) {
        fetch('/hanzi/data/' + encodeURIComponent(char) + '.json')
          .then(function(response) {
            if (!response.ok) throw new Error('Character data not found');
            return response.json();
          })
          .then(onLoad)
          .catch(onError);
      }
    });

  function handleComplete(summary) {
  const message = {
    type: "complete",
    char: character,
    mistakes: Number(summary.totalMistakes) || 0
  };

  document.getElementById('status').textContent =
    'Practice complete! Score: ' + message.mistakes + ' mistakes.';

  const result = JSON.stringify(message);

  // Send result to the web app iframe
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(result, "*");
  }

  // Send result to the React Native WebView
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(result);
  }
}

document.getElementById('animate').onclick = function() {
  writer.animateCharacter();
  document.getElementById('status').textContent =
    'Watch the stroke order.';
};

document.getElementById('quiz').onclick = function() {
  writer.quiz({
    onComplete: handleComplete
  });
};

// Automatically start the quiz when the screen is in quiz mode
if (mode === 'quiz') {
  writer.quiz({
    onComplete: handleComplete
  });
} else {
  writer.animateCharacter();
}
  </script>
</body>
</html>`;
}
module.exports = { writerPage };
