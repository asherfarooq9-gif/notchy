// The tiny page the phone sees. Fixed text only: nothing from the phone or the PC is ever put into the markup.
const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Send to PC</title><link rel="stylesheet" href="/app.css"></head>
<body><main>
<h1>Send files to your PC</h1>
<p>Pick photos or files. They go straight to your PC over your home Wi-Fi.</p>
<label class="pick"><input id="files" type="file" multiple><span>Choose files</span></label>
<ul id="list" aria-live="polite"></ul>
<p id="note" role="status"></p>
</main><script src="/app.js"></script></body></html>`;

const JS = `(function () {
  var token = new URLSearchParams(location.search).get('t') || '';
  var input = document.getElementById('files');
  var list = document.getElementById('list');
  var note = document.getElementById('note');
  function row(name) { var li = document.createElement('li'); li.textContent = name + ' - sending...'; list.appendChild(li); return li; }
  async function send(file) {
    var li = row(file.name);
    try {
      var res = await fetch('/up?t=' + encodeURIComponent(token) + '&name=' + encodeURIComponent(file.name), { method: 'POST', body: file });
      li.textContent = file.name + (res.ok ? ' - sent' : ' - not sent: ' + (await res.text()));
    } catch (e) { li.textContent = file.name + ' - not sent (connection lost)'; }
  }
  input.addEventListener('change', async function () {
    note.textContent = '';
    for (var i = 0; i < input.files.length; i++) await send(input.files[i]);
    note.textContent = 'Done. You can close this page.';
    input.value = '';
  });
})();`;

const CSS = `body{margin:0;font:18px/1.5 system-ui,sans-serif;background:#f2f2f7;color:#1c1c1e}
main{max-width:30rem;margin:0 auto;padding:1.5rem 1rem}
h1{font-size:1.5rem;margin:0 0 .5rem}
.pick{display:block;position:relative;margin:1.5rem 0}
.pick input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.pick span{display:block;text-align:center;padding:1rem;border-radius:1rem;background:#0b66e4;color:#fff;font-weight:600}
ul{padding:0;list-style:none}li{padding:.5rem 0;border-bottom:1px solid #d1d1d6;word-break:break-all}`;

module.exports = { HTML, JS, CSS };
