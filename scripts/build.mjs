import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const frontend = new URL('frontend/', root);
const output = new URL('dist/', root);
const [target, destination] = process.argv.slice(2);
if (target && (!['--ios', '--web-player'].includes(target) || !destination)) {
  throw new Error('Usage: node scripts/build.mjs [--ios /path/to/game.html | --web-player /path/to/index.html]');
}
// Menu-only art (mascot picker, theme previews, scene, achievements, app icons). Never needed in play mode.
const appOnlyFolders = new Set(['mascots', 'backgrounds', 'achievements', 'effects', 'companions', 'themes', 'app-icons']);
const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
// Player builds swap those imports for a 1x1 pixel. The app build (dist) links the copies in dist/assets/ instead of inlining.
const appOnlyAssets = mode => ({
  name: 'app-only-assets',
  setup(build) {
    build.onResolve({ filter: /\.(png|gif)$/ }, args => {
      if (args.kind !== 'import-statement') return;
      const parts = relative(fileURLToPath(new URL('assets/', frontend)), resolve(args.resolveDir, args.path)).split(sep);
      if (parts[0] === '..' || !appOnlyFolders.has(parts[0])) return;
      return { path: mode === 'link' ? './assets/' + parts.join('/') : transparentPixel, namespace: 'app-only' };
    });
    build.onLoad({ filter: /.*/, namespace: 'app-only' }, args => ({ contents: 'export default ' + JSON.stringify(args.path), loader: 'js' }));
  }
});
const read = file => readFile(new URL(file, frontend), 'utf8');
const files = [
  'daily_puzzle_icon.svg',
  'icons/classic_dino.png',
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
    loader: { '.txt': 'text', '.gif': 'dataurl', '.png': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl' },
    plugins: [appOnlyAssets(target ? 'stub' : 'link')],
    write: false
  }),
  ...files.map(file => readFile(new URL('assets/' + file, frontend)))
]);

const imageSources = new Map(files.map((file, index) => [
  file,
  'data:image/' + (file.endsWith('.svg') ? 'svg+xml' : 'png') + ';base64,' + images[index].toString('base64')
]));
const inlineScript = (source, attrs = '') => '<script' + attrs + '>\n' + source.replace(/<\/script/gi, '<\\/script') + '\n</script>';
let html = template
  .replace('<!-- wordlist-license -->', () => inlineScript(license, ' type="text/plain" id="wordlist-license"'))
  .replace('<!-- theme -->', () => inlineScript(theme))
  .replace('<!-- styles -->', () => '<style>\n' + css + '</style>')
  .replace('<!-- app -->', () => inlineScript(app.outputFiles[0].text))
  .replace(/(src|href)="embed:([^"]+)"/g, (_match, attribute, file) => {
    if (!imageSources.has(file)) throw new Error('Unknown embedded image: ' + file);
    return attribute + '="' + imageSources.get(file) + '"';
  });

if (target) {
  const config = target === '--ios' ? await readPlayerConfig() : { session: 'web-player-v1', season: 'classic' };
  const data = JSON.stringify(config).replace(/[&"<>]/g, char => ({
    '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;'
  })[char]);
  const editorSection = /<!-- editor:start -->[\s\S]*?<!-- editor:end -->/;
  if (!html.includes('data-mode="edit"') || !editorSection.test(html)) {
    throw new Error('Cannot find the editor section in the game template.');
  }
  html = html
    .replace('data-mode="edit"', () => 'data-mode="play" data-puzzle-config="' + data + '"')
    .replace(editorSection, '')
    .replace(/<link rel="manifest"[^>]*>\n/g, '');
  if (target === '--ios') html = html.replace(/<link rel="apple-touch-icon"[^>]*>\n/g, '');
  const file = resolve(destination);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
  if (target === '--web-player') {
    const iconDir = resolve(dirname(file), 'assets/icons');
    await mkdir(iconDir, { recursive: true });
    await cp(new URL('assets/icons/apple-touch-icon.png', frontend), resolve(iconDir, 'apple-touch-icon.png'));
  }
  console.log('Built ' + (target === '--ios' ? 'iOS' : 'web') + ' player HTML');
} else {
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(new URL('index.html', output), html),
    cp(new URL('assets/', frontend), new URL('assets/', output), { recursive: true }),
    cp(new URL('manifest.webmanifest', frontend), new URL('manifest.webmanifest', output))
  ]);
  console.log('Built dist/index.html');
}

async function readPlayerConfig() {
  const file = new URL('ios/player.local.json', root);
  let source;
  try {
    source = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { session: 'ios-v1', season: 'classic' };
    throw error;
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('ios/player.local.json must contain a JSON object.');
  }
  const { answers, ending, headline, message, season } = source;
  if (answers !== undefined && (!Array.isArray(answers) || answers.length !== 5 || answers[2] !== null ||
      answers.some((word, index) => index !== 2 && (typeof word !== 'string' || !/^[A-Z]{5}$/.test(word))))) {
    throw new Error('iOS answers require four five-letter uppercase words and null at level 3.');
  }
  if (answers) {
    const words = new Set((await readFile(new URL('backend/data/words.txt', root), 'utf8')).trim().split(/\s+/));
    if (answers.some(word => word !== null && !words.has(word))) {
      throw new Error('Each fixed iOS answer has to be in the dictionary.');
    }
  }
  if (message !== undefined && (!Array.isArray(message) || message.length !== 6 ||
      message.some(line => typeof line !== 'string' || !/^[A-Z♡♥]{0,5}$/.test(line)))) {
    throw new Error('The iOS reveal needs six lines of up to five A–Z or heart characters.');
  }
  if (ending !== undefined && (typeof ending !== 'string' || ending.length > 130)) {
    throw new Error('The iOS ending must be text no longer than 130 characters.');
  }
  if (headline !== undefined && (typeof headline !== 'string' || headline.length > 60)) {
    throw new Error('The iOS headline must be text no longer than 60 characters.');
  }
  if (season !== undefined && !['classic', 'christmas', 'spring', 'halloween', 'space', 'summer', 'valentine', 'rainy'].includes(season)) {
    throw new Error('Unknown iOS seasonal theme.');
  }
  return { session: 'ios-v1', answers, ending, headline, message, season };
}
