// Turns a path that Claude wrote ("Downloads/Invoices/a.pdf") into a real path, but only inside the folders the assistant
// is allowed to touch. Anything that tries to step outside (.., drive letters, network shares, odd names) is refused.
const path = require('path');

const ROOT_NAMES = ['Downloads', 'Documents', 'Desktop', 'Pictures', 'Music', 'Videos'];
const MAX_SPEC_LENGTH = 260;
const MAX_SEGMENT_LENGTH = 120;
const BAD_CHARACTERS = /[<>:"|?*\u0000-\u001f]/;
// Is this relative path (from a root folder) one that has stepped out of it?
const leaves = (relative) => relative.startsWith('..') || path.isAbsolute(relative);
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i; // names Windows will not allow as files

// One file or folder name: no slashes, no odd characters, nothing Windows treats specially.
function checkSegment(name) {
  if (!name || name === '.' || name === '..') return 'A path part is empty or tries to go up a folder.';
  if (name.length > MAX_SEGMENT_LENGTH) return 'A name is too long.';
  if (BAD_CHARACTERS.test(name)) return `The name "${name}" has characters Windows does not allow.`;
  if (/[. ]$/.test(name)) return `The name "${name}" ends with a dot or space.`;
  if (RESERVED.test(name)) return `"${name}" is a name Windows reserves.`;
  return null;
}

// rootPaths: {Downloads: 'C:\\Users\\you\\Downloads', ...}
function createResolver(rootPaths) {
  const roots = new Map(ROOT_NAMES.filter((n) => rootPaths[n]).map((n) => [n.toLowerCase(), { name: n, dir: path.resolve(rootPaths[n]) }]));

  return {
    rootNames: () => [...roots.values()].map((r) => r.name),
    // Returns {ok:true, abs, root, parts, isRoot} or {ok:false, error}.
    resolve(spec) {
      if (typeof spec !== 'string' || !spec.trim()) return { ok: false, error: 'A path is missing.' };
      if (spec.length > MAX_SPEC_LENGTH) return { ok: false, error: 'A path is too long.' };
      if (spec !== spec.trim()) return { ok: false, error: 'A path has a space at the start or end.' }; // never quietly turn it into a different name
      const parts = spec.replace(/\\/g, '/').split('/').filter((p, i, all) => !(p === '' && i === all.length - 1));
      const root = roots.get(String(parts[0]).toLowerCase());
      if (!root) return { ok: false, error: `The path "${spec}" must start with one of: ${[...roots.values()].map((r) => r.name).join(', ')}.` };
      const rest = parts.slice(1);
      for (const part of rest) {
        const problem = checkSegment(part);
        if (problem) return { ok: false, error: problem };
      }
      const abs = path.join(root.dir, ...rest);
      const relative = path.relative(root.dir, abs);
      if (leaves(relative)) return { ok: false, error: `The path "${spec}" leaves its folder.` };
      return { ok: true, abs, root: root.name, parts: rest, isRoot: rest.length === 0 };
    },
    // Is this real path inside an allowed folder? (Used again before running, as a second check.)
    contains(abs) {
      const target = path.resolve(String(abs));
      return [...roots.values()].some((r) => {
        const relative = path.relative(r.dir, target);
        return relative !== '' && !leaves(relative);
      });
    },
    // Inside an allowed folder, or one of those folders itself (a place things may be moved into).
    within(abs) {
      const target = path.resolve(String(abs));
      return [...roots.values()].some((r) => {
        const relative = path.relative(r.dir, target);
        return !leaves(relative);
      });
    },
    // The way a real path is shown to you: "Downloads/Invoices/a.pdf".
    display(abs) {
      const target = path.resolve(String(abs));
      for (const r of roots.values()) {
        const relative = path.relative(r.dir, target);
        if (!leaves(relative)) return [r.name, ...relative.split(path.sep).filter(Boolean)].join('/');
      }
      return path.basename(target);
    },
  };
}

module.exports = { createResolver, checkSegment, ROOT_NAMES };
