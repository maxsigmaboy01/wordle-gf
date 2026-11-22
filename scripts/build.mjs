import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const frontend = new URL('frontend/', root);
const output = new URL('dist/', root);
const read = file => readFile(new URL(file, frontend), 'utf8');
const files = [
  'daily_puzzle_icon.svg',
  'chest_original_exact.png',
  'gamepad_original_exact.png'
];

const [template, css, theme, license, app, ...images] = await Promise.all([
  read('index.html'),
  read('styles.css'),
  read('theme.js'),
  readFile(new URL('backend/data/ESDB-LICENSE.txt', root), 'utf8'),
  build({
    absWorkingDir: fileURLToPath(root),
    entryPoints: ['frontend/app.js'],
    bundle: true,
    format: 'iife',
    loader: { '.txt': 'text', '.gif': 'dataurl', '.png': 'dataurl' },
    write: false
  }),
  ...files.map(file => readFile(new URL('assets/' + file, frontend)))
]);

const imageSources = new Map(files.map((file, index) => [
  file,
  'data:image/' + (file.endsWith('.svg') ? 'svg+xml' : 'png') + ';base64,' + images[index].toString('base64')
]));
const inlineScript = (source, attrs = '') => '<script' + attrs + '>\n' + source.replace(/<\/script/gi, '<\\/script') + '\n</script>';
const html = template
  .replace('<!-- wordlist-license -->', () => inlineScript(license, ' type="text/plain" id="wordlist-license"'))
  .replace('<!-- theme -->', () => inlineScript(theme))
  .replace('<!-- styles -->', () => '<style>\n' + css + '</style>')
  .replace('<!-- app -->', () => inlineScript(app.outputFiles[0].text))
  .replace(/src="embed:([^"]+)"/g, (_match, file) => {
    if (!imageSources.has(file)) throw new Error('Unknown embedded image: ' + file);
    return 'src="' + imageSources.get(file) + '"';
  });

await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(new URL('index.html', output), html),
  cp(new URL('assets/', frontend), new URL('assets/', output), { recursive: true }),
  cp(new URL('manifest.webmanifest', frontend), new URL('manifest.webmanifest', output))
]);
console.log('Built dist/index.html');
