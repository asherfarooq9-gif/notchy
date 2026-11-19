// File Converter: turns pictures into JPG, PNG, a PDF or an icon, optionally squeezed under a size you choose.
// The Documents side turns Word files into PDF and PDF into Word (Microsoft Word does the work on this PC).
// The picture work happens right here in the panel; nothing is uploaded anywhere. Results are saved next to the original.
registerModule({
  id: 'converter',
  title: 'Converter',
  mount(root) {
    const FORMATS = [['jpg', 'JPG'], ['png', 'PNG'], ['pdf', 'PDF'], ['ico', 'Icon']];
    const ICON_SIZES = [16, 32, 48, 64, 128, 256];
    const JPEG_DEFAULT_QUALITY = 0.92;
    let format = window.panelState.convertFormat || 'jpg';
    let isBusy = false;
    let mode = window.panelState.convertMode || 'pictures';
    const DOC_TARGETS = [['pdf', 'PDF', 'Drop a Word file here', '.doc,.docx,.rtf,.odt'], ['docx', 'Word', 'Drop a PDF here', '.pdf,.doc,.rtf,.odt']];

    const formatBox = h('div', { class: 'segment' });
    const sizeInput = h('input', { type: 'number', min: '10', step: '10', class: 'narrow', placeholder: 'any', 'aria-label': 'Largest size in kilobytes (empty for no limit)' });
    const mergeBox = h('input', { type: 'checkbox', 'aria-label': 'Put all pictures in one PDF' });
    const options = h('div', { class: 'row wrap' });
    const zone = h('div', { class: 'drop-zone converter-zone' }, h('div', { class: 'empty' }, 'Drop pictures here', h('div', { class: 'tag' }, 'PNG, JPG, WebP, GIF, BMP. Your originals are never changed.')));
    const picker = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, 'aria-label': 'Choose pictures' });
    const results = h('div', { class: 'list' });
    const modeBox = h('div', { class: 'segment' });
    const picturesView = h('div', { class: 'grid-gap' });
    const docsView = h('div', { class: 'grid-gap' });

    const kb = (bytes) => (bytes < 1024 * 100 ? `${(bytes / 1024).toFixed(1)} KB` : `${Math.round(bytes / 1024)} KB`);
    const cleanError = (err) => String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

    function drawControls() {
      formatBox.replaceChildren(...FORMATS.map(([id, label]) => h('button', { class: id === format ? 'active' : '', onClick: () => { format = id; window.panelState.convertFormat = id; drawControls(); } }, label)));
      options.replaceChildren(...[
        format === 'jpg' || format === 'png' || format === 'pdf' ? h('label', { class: 'row' }, h('span', { class: 'muted' }, 'Smaller than'), sizeInput, h('span', { class: 'muted' }, 'KB')) : h('span', { class: 'muted' }, `Makes ${ICON_SIZES.join(', ')} px icons in one file.`),
        format === 'pdf' ? h('label', { class: 'row' }, mergeBox, h('span', null, 'One PDF for all')) : null].filter(Boolean));
    }

    // Draws the picture on a canvas at a scale. keepShape: fit inside a square (icons); whiteBackground: JPEG has no see-through.
    function draw(bitmap, { scale = 1, square = 0, whiteBackground = false }) {
      const canvas = document.createElement('canvas');
      if (square) {
        canvas.width = square; canvas.height = square;
        const fit = Math.min(square / bitmap.width, square / bitmap.height);
        const [w, h2] = [bitmap.width * fit, bitmap.height * fit];
        canvas.getContext('2d').drawImage(bitmap, (square - w) / 2, (square - h2) / 2, w, h2);
        return canvas;
      }
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (whiteBackground) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas;
    }
    const encode = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob(async (blob) => (blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error('Could not make that picture'))), type, quality));

    // Returns the bytes for one picture in the chosen format (JPEG for jpg and pdf pages, PNG for png).
    async function makeRaster(bitmap, type) {
      const isJpeg = type === 'image/jpeg';
      const make = (quality, scale) => encode(draw(bitmap, { scale, whiteBackground: isJpeg }), type, quality);
      const limitKb = Number(sizeInput.value);
      if (!(limitKb > 0)) return make(JPEG_DEFAULT_QUALITY, 1);
      const squeezed = await window.squeezeToSize(make, limitKb * 1024, { usesQuality: isJpeg });
      if (!squeezed) throw new Error(`Could not get it under ${limitKb} KB`);
      return squeezed.bytes;
    }

    async function convertOne(file, sourcePath) {
      const bitmap = await createImageBitmap(file).catch(() => { throw new Error('Cannot read this picture type'); });
      try {
        if (format === 'ico') return { parts: await Promise.all(ICON_SIZES.map((size) => encode(draw(bitmap, { square: size }), 'image/png'))), sourcePath };
        return { parts: [await makeRaster(bitmap, format === 'png' ? 'image/png' : 'image/jpeg')], sourcePath };
      } finally { bitmap.close(); }
    }

    const addResult = (text, ok, outputPath) => results.prepend(h('div', { class: 'item' },
      h('span', { class: `grow ${ok ? '' : 'err'}` }, text),
      ok && outputPath ? h('button', { class: 'btn small', onClick: () => window.panel.converter.reveal(outputPath) }, 'Show') : null));

    async function run(files) {
      if (isBusy || !files.length) return;
      isBusy = true;
      zone.classList.add('busy');
      const queue = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|ico)$/i.test(f.name));
      if (queue.length < files.length) addResult('Some files are not pictures and were skipped.', false);
      const merging = format === 'pdf' && mergeBox.checked && queue.length > 1;
      const pages = [];
      for (const file of queue) {
        const sourcePath = window.panel.pathFor(file);
        try {
          if (!sourcePath) throw new Error('Drag the picture from a folder so the result can be saved next to it');
          const made = await convertOne(file, sourcePath);
          if (merging) { pages.push(...made.parts); continue; }
          const saved = await window.panel.converter.save({ kind: format, sourcePath, parts: made.parts });
          addResult(`${file.name}  →  ${saved.name}  (${kb(saved.size)})`, true, saved.path);
        } catch (err) {
          addResult(`${file.name}: ${cleanError(err)}`, false);
        }
      }
      if (merging && pages.length) {
        try {
          const saved = await window.panel.converter.save({ kind: 'pdf', sourcePath: window.panel.pathFor(queue[0]), parts: pages });
          addResult(`${pages.length} pictures  →  ${saved.name}  (${kb(saved.size)})`, true, saved.path);
        } catch (err) { addResult(cleanError(err), false); }
      }
      zone.classList.remove('busy');
      isBusy = false;
    }

    // ---- documents: drop onto the kind you want (PDF or Word) ----
    async function runDocs(files, to) {
      if (isBusy || !files.length) return;
      isBusy = true;
      const note = h('div', { class: 'tag' }, 'Converting… the first file takes a few seconds while Word starts.');
      results.prepend(note);
      for (const file of Array.from(files)) {
        const sourcePath = window.panel.pathFor(file);
        try {
          if (!sourcePath) throw new Error('Drag the file from a folder so the result can be saved next to it');
          const saved = await window.panel.converter.doc({ sourcePath, to });
          addResult(`${file.name}  →  ${saved.name}  (${kb(saved.size)})`, true, saved.path);
        } catch (err) {
          addResult(`${file.name}: ${cleanError(err)}`, false);
        }
      }
      note.remove();
      isBusy = false;
    }

    // PDF tools: join several PDFs, or keep only some pages of one.
    const pagesInput = h('input', { type: 'text', class: 'narrow', placeholder: '1-3,5', 'aria-label': 'Pages to keep, like 1-3,5' });
    async function runPdfTool(action, files) {
      if (isBusy || !files.length) return;
      isBusy = true;
      try {
        const paths = Array.from(files).map((f) => window.panel.pathFor(f));
        if (paths.some((p) => !p)) throw new Error('Drag the files from a folder so the result can be saved next to them');
        const saved = action === 'merge'
          ? await window.panel.converter.pdf({ action, sourcePaths: paths })
          : await window.panel.converter.pdf({ action, sourcePath: paths[0], pages: pagesInput.value });
        addResult(`${saved.name}  (${saved.pages} pages)`, true, saved.path);
      } catch (err) {
        addResult(cleanError(err), false);
      }
      isBusy = false;
    }

    function pdfToolBox(action, label, hint, isMultiple) {
      const pick = h('input', { type: 'file', accept: '.pdf', multiple: isMultiple, hidden: true, 'aria-label': label });
      const box = h('button', { class: 'drop-zone doc-target small', type: 'button', 'aria-label': label + '. ' + hint },
        h('div', { class: 'doc-name' }, label), h('div', { class: 'tag' }, hint));
      box.addEventListener('click', () => pick.click());
      box.addEventListener('dragover', (event) => { event.preventDefault(); box.classList.add('over'); });
      box.addEventListener('dragleave', () => box.classList.remove('over'));
      box.addEventListener('drop', (event) => { event.preventDefault(); box.classList.remove('over'); runPdfTool(action, event.dataTransfer.files); });
      pick.addEventListener('change', () => { runPdfTool(action, pick.files); pick.value = ''; });
      return h('div', null, box, pick);
    }

    function drawDocTargets() {
      docsView.replaceChildren(
        h('div', { class: 'doc-targets' }, ...DOC_TARGETS.map(([to, label, hint, accept]) => {
          const pick = h('input', { type: 'file', accept, multiple: true, hidden: true, 'aria-label': 'Choose files to convert to ' + label });
          const target = h('button', { class: 'drop-zone doc-target', type: 'button', 'aria-label': 'Convert to ' + label + '. ' + hint },
            h('div', { class: 'doc-name' }, label), h('div', { class: 'tag' }, hint + ', or click to choose'));
          target.addEventListener('click', () => pick.click());
          target.addEventListener('dragover', (event) => { event.preventDefault(); target.classList.add('over'); });
          target.addEventListener('dragleave', () => target.classList.remove('over'));
          target.addEventListener('drop', (event) => { event.preventDefault(); target.classList.remove('over'); runDocs(event.dataTransfer.files, to); });
          pick.addEventListener('change', () => { runDocs(pick.files, to); pick.value = ''; });
          return h('div', null, target, pick);
        })),
        h('div', { class: 'tag' }, 'Saved next to the original under a new name. Needs Microsoft Word. PDFs made from pictures (scans) will not turn into editable text.'),
        h('h2', null, 'PDF tools'),
        h('div', { class: 'doc-targets' },
          pdfToolBox('merge', 'Join PDFs', 'Drop two or more PDFs, joined in the order picked', true),
          h('div', { class: 'grid-gap' }, h('label', { class: 'row' }, h('span', { class: 'muted' }, 'Pages to keep'), pagesInput), pdfToolBox('split', 'Pick pages', 'Drop one PDF to keep only those pages', false))));
    }

    function drawMode() {
      modeBox.replaceChildren(...[['pictures', 'Pictures'], ['documents', 'Documents']].map(([id, label]) => h('button', { class: id === mode ? 'active' : '', onClick: () => { mode = id; window.panelState.convertMode = id; drawMode(); } }, label)));
      picturesView.hidden = mode !== 'pictures';
      docsView.hidden = mode !== 'documents';
    }

    root.addEventListener('dragover', (event) => { event.preventDefault(); if (mode === 'pictures') zone.classList.add('over'); });
    root.addEventListener('dragleave', (event) => { if (!root.contains(event.relatedTarget)) zone.classList.remove('over'); });
    root.addEventListener('drop', (event) => { event.preventDefault(); zone.classList.remove('over'); if (mode === 'pictures') run(event.dataTransfer.files); });
    picker.addEventListener('change', () => { run(picker.files); picker.value = ''; });

    drawControls();
    drawDocTargets();
    picturesView.append(
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Convert to'), formatBox),
      options, zone,
      h('div', { class: 'row' }, h('button', { class: 'btn', onClick: () => picker.click() }, 'Choose pictures…'), picker, h('span', { class: 'tag' }, 'Saved next to the original, under a new name.')));
    root.append(h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Converter'), modeBox), picturesView, docsView, results);
    drawMode();
  },
});
