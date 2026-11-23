// Reactions for the classic dino (menu mode only), using the real action GIFs from assets/mascots/classic_*.gif.
// An action swaps the sprite's src for a moment, then goes back to the idle loop (img.dataset.idle).
// Reduced motion keeps the still PNG and plays nothing. Costume dinos have no reactions.
import { actions } from './mascots.js';

// Whole loops of the GIFs (840-1020 ms each), in ms.
const DURATION = { blink: 840, wave: 1800, tail_wag: 1680, bounce: 1680, sparkle_pop: 2040 };

export function setupDinoFx({ reducedMotion }) {
  const timers = new WeakMap();
  const busy = new WeakSet();

  function playFx(img, name) {
    if (!img || reducedMotion.matches || img.dataset.mascot !== 'classic' || !actions[name] || !img.dataset.idle) return;
    clearTimeout(timers.get(img));
    img.src = actions[name].loop;
    busy.add(img);
    timers.set(img, setTimeout(() => {
      busy.delete(img);
      if (img.dataset.idle) img.src = img.dataset.idle;
    }, DURATION[name]));
  }

  // Idle blink at random moments, only while something on screen shows the classic dino and nothing else is playing.
  function scheduleBlink() {
    setTimeout(() => {
      if (!document.hidden) {
        for (const img of document.querySelectorAll('#menuMascot, #playMascot, .side-dino')) {
          if (img.offsetParent && !busy.has(img)) playFx(img, 'blink');
        }
      }
      scheduleBlink();
    }, 3500 + Math.random() * 4500);
  }
  scheduleBlink();

  document.addEventListener('mouseover', event => {
    const target = event.target.closest?.('.home-mascot, .side-dino, .play-mascot');
    if (!target || target.contains(event.relatedTarget)) return;
    playFx(target, target.classList.contains('play-mascot') ? 'tail_wag' : 'wave');
  });

  // Dispatched by app.js after a guess is graded and when a level is solved.
  document.addEventListener('puzzlefx', event => {
    const mascot = document.getElementById('playMascot');
    const { type, greens = 0 } = event.detail ?? {};
    if (type === 'win') playFx(mascot, 'bounce');
    else if (greens >= 3) playFx(mascot, 'sparkle_pop');
  });

  return { playFx };
}
