#!/usr/bin/env node
// ========================================================
//  СБОРКА L2 BROWSER
//  node build.js            — склеить и сжать js/app.bundle.js и переписать index.html
//  node build.js --check    — только проверить, что бандл и index.html актуальны
//  node build.js --unbundle — вернуть отдельные <script> вместо бандла
//  node build.js --dry [--out=файл] — пробная сборка: проверить и замерить, игру не трогать
//  --keep-comments          — не сжимать (для отладки)
//
//  ВАЖНО: собирать только в чистой копии при выкладке (см. память release-process):
//  в рабочей папке лежит отложенная работа и спойлеры (fall-lines.js).
//
//  Зачем: 98 отдельных <script> и подробные комментарии — лишний вес по сети.
//  Один сжатый файл с теми же исходниками даёт тот же результат и весит на ~35% меньше.
//  Порядок файлов — в js/app.manifest.json; он же проверяется на полноту:
//  новый js-файл, забытый в манифесте, роняет сборку с понятным сообщением.
//  optional в манифесте — файлы, которых в чистой копии может не быть (отложенное).
// ========================================================

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const MANIFEST = path.join(ROOT, 'js', 'app.manifest.json');
const BUNDLE_REL = 'js/app.bundle.js';
const BUNDLE = path.join(ROOT, BUNDLE_REL);
const INDEX = path.join(ROOT, 'index.html');
const VENDOR_REL = 'js/vendor/supabase-2.118.0.js';

// Границы блока игровых скриптов в исходном index.html.
const BLOCK_START = '<script src="js/data/config.js';
const BLOCK_END = '<script src="js/main.js';

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s, 'utf8'); }
function toPosix(p) { return p.split(path.sep).join('/'); }

function getVersion() {
  return read(path.join(ROOT, 'version.txt')).trim() || 'v0.0.0';
}

// Все игровые js на диске (кроме вендора и воркера).
function listGameFiles() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = toPosix(path.relative(ROOT, full));
      if (fs.statSync(full).isDirectory()) {
        if (rel === 'js/vendor' || rel === 'js/worker') continue;
        walk(full);
      } else if (name.endsWith('.js') && rel !== BUNDLE_REL) {
        out.push(rel);
      }
    }
  })(path.join(ROOT, 'js'));
  return out.sort();
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error('нет js/app.manifest.json — он перечисляет порядок файлов в бандле');
  }
  const raw = JSON.parse(read(MANIFEST));
  // Поддерживаем и просто массив, и { files, exclude, optional }.
  const all = Array.isArray(raw) ? raw : raw.files;
  const exclude = Array.isArray(raw.exclude) ? raw.exclude : [];
  // v0.36.4: optional — файлы, которых может не быть (отложенная работа не попадает в чистую копию
  // при выкладке). Нет на диске — молча пропускаем, есть — собираем на своём месте.
  const optional = Array.isArray(raw.optional) ? raw.optional : [];
  if (!Array.isArray(all) || !all.length) throw new Error('манифест пуст');
  const files = all.filter(f => !optional.includes(f) || fs.existsSync(path.join(ROOT, f)));
  return { files, exclude, optional };
}

function validate(manifest) {
  const onDisk = new Set(listGameFiles());
  const inManifest = new Set(manifest.files);
  const excluded = new Set(manifest.exclude);

  const ghosts = [...inManifest].filter(f => !onDisk.has(f));
  if (ghosts.length) throw new Error('в манифесте есть файлы, которых нет на диске:\n  ' + ghosts.join('\n  '));

  const missing = [...onDisk].filter(f => !inManifest.has(f) && !excluded.has(f));
  if (missing.length) {
    throw new Error(
      'эти js-файлы есть на диске, но не попали ни в files, ни в exclude манифеста:\n  ' + missing.join('\n  ') +
      '\n  Раньше такой файл просто не подключался в index.html и молча не работал.');
  }
}

// ========================================================
//  v0.36.4: СЖАТИЕ — убрать комментарии, отступы и пустые строки.
//  По замеру код по сети легчает на ~35% (gzip 518 → 381 КБ): сайт упирается в объём, а не
//  в число запросов. Переносы строк сохраняются (точки с запятой, которые JS ставит сам,
//  не ломаются). Строки, шаблоны `...${}...` и регулярные выражения не трогаются —
//  внутри шаблонов отступы и переносы остаются как были.
// ========================================================
function stripJs(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  // Можно ли здесь начаться регулярному выражению (а не делению): смотрим на последний значимый символ.
  const regexAllowed = () => {
    const t = out.replace(/\s+$/, '');
    if (!t) return true;
    if (/[(,=:\[!&|?{};+\-*%<>~^]$/.test(t)) return true;
    return /(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new|do|else|yield|await)$/.test(t);
  };
  const newline = () => {   // перенос строки вне строк/шаблонов: без хвостовых пробелов и пустых строк
    out = out.replace(/[ \t]+$/, '');
    if (out && !out.endsWith('\n')) out += '\n';
    while (i < n && (src[i] === ' ' || src[i] === '\t' || src[i] === '\r' || src[i] === '\n')) i++;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '\n' || c === '\r') { newline(); continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      if (!/[\s;{}(,]$/.test(out) && i < n && !/\s/.test(src[i])) out += ' ';   // a/*x*/b → «a b», не «ab»
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c; out += c; i++;
      while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') out += src[i++]; out += src[i++]; }
      if (i < n) out += src[i++];
      continue;
    }
    if (c === '`') {
      out += c; i++;
      const stack = [0];   // глубина ${ } внутри текущего шаблона
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') { out += ch + (src[i + 1] || ''); i += 2; continue; }
        if (stack[stack.length - 1] === 0) {
          if (ch === '`') { out += ch; i++; stack.pop(); if (!stack.length) break; continue; }
          if (ch === '$' && src[i + 1] === '{') { out += '${'; i += 2; stack[stack.length - 1]++; continue; }
          out += ch; i++; continue;
        }
        // внутри ${ ... }: строки, вложенные шаблоны и скобки
        if (ch === '`') { out += ch; i++; stack.push(0); continue; }
        if (ch === '"' || ch === "'") { const q = ch; out += ch; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') out += src[i++]; out += src[i++]; } out += src[i++] || ''; continue; }
        if (ch === '{') stack[stack.length - 1]++;
        else if (ch === '}') stack[stack.length - 1]--;
        out += ch; i++;
      }
      continue;
    }
    if (c === '/' && regexAllowed()) {
      out += c; i++;
      let cls = false;
      while (i < n && src[i] !== '\n') {
        const ch = src[i]; out += ch; i++;
        if (ch === '\\') { out += src[i++] || ''; continue; }
        if (ch === '[') cls = true; else if (ch === ']') cls = false;
        else if (ch === '/' && !cls) break;
      }
      continue;
    }
    if ((c === ' ' || c === '\t') && (out.endsWith('\n') || !out)) { i++; continue; }   // отступ в начале строки
    out += c; i++;
  }
  return out.replace(/[ \t]+$/, '');
}

function buildBundle(manifest, version, opts) {
  const strip = !(opts && opts.keepComments);
  const parts = [
    '// L2 BROWSER — СБОРКА ' + version + ' (build.js; правки — в js/**, а не сюда). Файлов: ' + manifest.files.length,
  ];
  for (const rel of manifest.files) {
    // Заголовок с редким маркером: по нему бандл можно разбирать обратно,
    // и он не путается с обычными комментариями вида «//  js/...» в исходниках.
    parts.push('// ==== ФАЙЛ ' + rel + ' ====');
    const src = read(path.join(ROOT, rel)).replace(/\s*$/, '');
    parts.push(strip ? stripJs(src) : src);
    // Разделитель: без него последняя строка одного файла склеится с первой строкой следующего.
    parts.push('');
    parts.push(';');
    parts.push('');
  }
  return parts.join('\n');
}

function vendorTag(version) {
  return '<script src="' + VENDOR_REL + '" defer></script>';
}
function bundleTag(version) {
  return '<script src="' + BUNDLE_REL + '?v=' + version.replace(/^v/, '') + '" defer></script>';
}

// Переключает index.html между «много тегов» и «один бандл». Идемпотентно в любую сторону.
function rewriteIndexHtml(html, version, mode) {
  const v = version.replace(/^v/, '');
  const lines = html.split('\n');

  const bundleIdx = lines.findIndex(l => l.indexOf('<script src="' + BUNDLE_REL) === 0);

  if (bundleIdx >= 0) {
    if (mode === 'unbundle') {
      const tags = loadManifest().files.map(rel => '<script src="' + rel + '?v=' + v + '"></script>');
      lines.splice(bundleIdx, 1, ...tags);
      // Без бандла скрипты грузятся по порядку без defer — и вендор тоже,
      // иначе Supabase выполнится позже cloud.js.
      const vi = lines.findIndex(l => l.indexOf('<script src="' + VENDOR_REL) === 0);
      if (vi >= 0) lines[vi] = '<script src="' + VENDOR_REL + '"></script>';
    } else {
      lines[bundleIdx] = bundleTag(version);
    }
    return lines.join('\n');
  }

  const start = lines.findIndex(l => l.indexOf(BLOCK_START) === 0);
  const end = lines.findIndex(l => l.indexOf(BLOCK_END) === 0);
  if (start < 0 || end < 0 || end < start) throw new Error('не нашёл блок игровых скриптов в index.html');

  lines.splice(start, end - start + 1, bundleTag(version));
  const vi = lines.findIndex(l => l.indexOf('<script src="' + VENDOR_REL) === 0);
  if (vi >= 0) lines[vi] = vendorTag(version);
  return lines.join('\n');
}

function setVersionEverywhere(html, version) {
  const v = version.replace(/^v/, '');
  return html
    .replace(/(href="css\/[^"]+?)\?v=[^"]*"/g, '$1?v=' + v + '"')
    .replace(/(src="js\/(?!app\.bundle)[^"]+?)\?v=[^"]*"/g, '$1?v=' + v + '"');
}

function check(manifest, version) {
  const problems = [];

  if (!fs.existsSync(BUNDLE)) {
    problems.push(BUNDLE_REL + ' отсутствует — запустите node build.js');
  } else if (buildBundle(manifest, version) !== read(BUNDLE)) {
    problems.push(BUNDLE_REL + ' устарел: исходники изменились после сборки. Запустите node build.js');
  }

  const html = read(INDEX);
  const separate = html.split('\n').filter(l =>
    /^<script src="js\//.test(l) &&
    l.indexOf('app.bundle.js') < 0 &&
    l.indexOf(VENDOR_REL) < 0);
  if (separate.length) problems.push('в index.html остались отдельные игровые <script>: ' + separate.length + '. Запустите node build.js');
  if (html.indexOf('app.bundle.js') < 0) problems.push('index.html не ссылается на app.bundle.js');
  if (html.indexOf('?v=' + version.replace(/^v/, '')) < 0) problems.push('в index.html нет ?v=' + version.replace(/^v/, ''));

  if (problems.length) {
    console.error('ПРОВЕРКА НЕ ПРОШЛА:');
    problems.forEach(p => console.error('  • ' + p));
    process.exit(1);
  }
  console.log('всё актуально: бандл и index.html соответствуют исходникам (' + version + ')');
}

// v0.36.4: бандл обязан быть рабочим JS — иначе на сайте не запустится ничего. Проверяем до записи.
function assertSyntax(code) {
  try { new (require('vm').Script)(code, { filename: BUNDLE_REL }); }
  catch (e) { throw new Error('бандл не собран: синтаксическая ошибка — ' + e.message); }
}

function sizeReport(manifest, bundle) {
  const gzSize = s => zlib.gzipSync(Buffer.isBuffer(s) ? s : Buffer.from(s, 'utf8'), { level: 9 }).length;
  let raw = 0, gzSep = 0;
  manifest.files.forEach(rel => { const b = fs.readFileSync(path.join(ROOT, rel)); raw += b.length; gzSep += gzSize(b); });
  const kb = x => (x / 1024).toFixed(0) + ' КБ';
  return `  исходники: ${kb(raw)} (по сети gzip ~${kb(gzSep)} отдельными файлами)\n` +
         `  бандл:     ${kb(Buffer.byteLength(bundle))} (по сети gzip ~${kb(gzSize(bundle))})`;
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--check') ? 'check' : args.includes('--unbundle') ? 'unbundle' : args.includes('--dry') ? 'dry' : 'build';
  const keepComments = args.includes('--keep-comments');
  const version = getVersion();
  const manifest = loadManifest();
  validate(manifest);

  if (mode === 'check') return check(manifest, version);

  // node build.js --dry [--out=путь] — собрать и проверить, ничего не меняя в игре (для пробы и замеров)
  if (mode === 'dry') {
    const bundle = buildBundle(manifest, version, { keepComments });
    assertSyntax(bundle);
    const outArg = args.find(a => a.startsWith('--out='));
    if (outArg) write(path.resolve(outArg.slice(6)), bundle);
    console.log('проба сборки: ' + manifest.files.length + ' файлов, синтаксис OK' + (outArg ? ', записано в ' + outArg.slice(6) : ''));
    console.log(sizeReport(manifest, bundle));
    return;
  }

  if (mode === 'build') {
    const bundle = buildBundle(manifest, version, { keepComments });
    assertSyntax(bundle);
    const prev = fs.existsSync(BUNDLE) ? read(BUNDLE) : null;
    if (prev !== bundle) write(BUNDLE, bundle);
    write(INDEX, setVersionEverywhere(rewriteIndexHtml(read(INDEX), version, 'build'), version));
    console.log('собрано: ' + BUNDLE_REL + (keepComments ? ' (с комментариями)' : ' (сжато)'));
    console.log('  файлов: ' + manifest.files.length);
    console.log(sizeReport(manifest, bundle));
    console.log('  index.html: вендор + бандл, версия ' + version);
    return;
  }

  if (mode === 'unbundle') {
    write(INDEX, setVersionEverywhere(rewriteIndexHtml(read(INDEX), version, 'unbundle'), version));
    console.log('index.html: вернул ' + manifest.files.length + ' отдельных <script>');
  }
}

main();
