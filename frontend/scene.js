// Themed scenery behind the app shell (menu mode only): a pixel-art strip anchored to the bottom plus a few light
// CSS particles (snow, petals, rain, hearts). The strip art lives in assets/backgrounds/<theme>.png.
import classicBg from './assets/backgrounds/classic.png';
import christmasBg from './assets/backgrounds/christmas.png';
import halloweenBg from './assets/backgrounds/halloween.png';
import springBg from './assets/backgrounds/spring.png';
import spaceBg from './assets/backgrounds/space.png';
import summerBg from './assets/backgrounds/summer.png';
import valentineBg from './assets/backgrounds/valentine.png';
import rainyBg from './assets/backgrounds/rainy.png';
import { rng, sprite } from './pixel.js';

const strips = { classic: classicBg, christmas: christmasBg, halloween: halloweenBg, spring: springBg, space: spaceBg, summer: summerBg, valentine: valentineBg, rainy: rainyBg };
const parts = { christmas: ['snow', 22], spring: ['petal', 16], valentine: ['heart', 14], rainy: ['rain', 34] };
const HEART = ['.11.11.', '1111111', '1111111', '.11111.', '..111..', '...1...'];
const cache = new Map();

function particles(kind, count) {
  const r = rng(kind.length * 977 + count);
  let out = '<div class="sc-parts" data-kind="' + kind + '">';
  for (let i = 0; i < count; i++) {
    const style = 'left:' + Math.round(r() * 100) + '%;--d:' + (kind === 'rain' ? 1.1 + r() * .9 : 9 + r() * 9).toFixed(1) + 's;--s:' +
      Math.round(3 + r() * 4) + 'px;--sway:' + Math.round(-18 + r() * 36) + 'px;animation-delay:-' + (r() * 14).toFixed(1) + 's';
    out += '<i style="' + style + '">' + (kind === 'heart' ? '<svg viewBox="0 0 7 6" shape-rendering="crispEdges">' + sprite(HEART, { 1: 'currentColor' }) + '</svg>' : '') + '</i>';
  }
  return out + '</div>';
}

export function setupScene(getSeason) {
  const node = document.createElement('div');
  node.className = 'scene';
  node.dataset.menuOnly = '';
  node.setAttribute('aria-hidden', 'true');
  document.body.prepend(node);
  function render() {
    const id = strips[getSeason()] ? getSeason() : 'classic';
    if (!cache.has(id)) cache.set(id, '<div class="sc-bg"></div>' + (parts[id] ? particles(...parts[id]) : ''));
    node.dataset.scene = id;
    node.innerHTML = cache.get(id);
    node.firstChild.style.backgroundImage = 'url("' + strips[id] + '")';
  }
  render();
  return { render };
}
