import classicLoop from './assets/seasons/01_classic_dino_idle.gif';
import classicStill from './assets/seasons/01_classic_dino_idle.png';
import spaceLoop from './assets/seasons/05_space_dino_astronaut.gif';
import spaceStill from './assets/seasons/05_space_dino_astronaut.png';
import christmasLoop from './assets/mascots/christmas.gif';
import christmasStill from './assets/mascots/christmas.png';
import halloweenLoop from './assets/mascots/halloween.gif';
import halloweenStill from './assets/mascots/halloween.png';
import springLoop from './assets/mascots/spring.gif';
import springStill from './assets/mascots/spring.png';
import summerLoop from './assets/mascots/summer.gif';
import summerStill from './assets/mascots/summer.png';
import valentineLoop from './assets/mascots/valentine.gif';
import valentineStill from './assets/mascots/valentine.png';
import rainyLoop from './assets/mascots/rainy.gif';
import rainyStill from './assets/mascots/rainy.png';
import blinkLoop from './assets/mascots/classic_blink.gif';
import blinkStill from './assets/mascots/classic_blink.png';
import waveLoop from './assets/mascots/classic_wave.gif';
import waveStill from './assets/mascots/classic_wave.png';
import wagLoop from './assets/mascots/classic_tail_wag.gif';
import wagStill from './assets/mascots/classic_tail_wag.png';
import bounceLoop from './assets/mascots/classic_bounce.gif';
import bounceStill from './assets/mascots/classic_bounce.png';
import sparkleLoop from './assets/mascots/classic_sparkle_pop.gif';
import sparkleStill from './assets/mascots/classic_sparkle_pop.png';

// Mascot picker (Settings). "match" follows the current theme's costume dino (Classic and Space keep their own).
export const mascots = [
  { id: 'classic', name: 'Dino Classic', tag: 'Always classic', loop: classicLoop, still: classicStill },
  { id: 'match', name: 'Match theme', tag: 'Default: dresses up for each theme', loop: classicLoop, still: classicStill },
  { id: 'christmas', name: 'Christmas Dino', tag: 'Cozy and festive', loop: christmasLoop, still: christmasStill },
  { id: 'halloween', name: 'Halloween Dino', tag: 'Spooky, but cute', loop: halloweenLoop, still: halloweenStill },
  { id: 'spring', name: 'Spring Dino', tag: 'Fresh and blooming', loop: springLoop, still: springStill },
  { id: 'space', name: 'Space Dino', tag: 'Ready for launch', loop: spaceLoop, still: spaceStill },
  { id: 'summer', name: 'Summer Dino', tag: 'Picnic ready', loop: summerLoop, still: summerStill },
  { id: 'valentine', name: 'Valentine Dino', tag: 'Sweet and a little extra', loop: valentineLoop, still: valentineStill },
  { id: 'rainy', name: 'Rainy Dino', tag: 'Puddle jumper', loop: rainyLoop, still: rainyStill }
];

// One-shot reactions for the classic dino. Each is a real GIF with a PNG still for reduced motion.
export const actions = {
  blink: { loop: blinkLoop, still: blinkStill },
  wave: { loop: waveLoop, still: waveStill },
  tail_wag: { loop: wagLoop, still: wagStill },
  bounce: { loop: bounceLoop, still: bounceStill },
  sparkle_pop: { loop: sparkleLoop, still: sparkleStill }
};

export const mascotById = id => mascots.find(item => item.id === id) ?? mascots[0];

// Points an <img> at the chosen mascot. Reduced motion gets the PNG still instead of the GIF loop.
export function paintMascot(img, pref, reduced, season = 'classic') {
  const mascot = mascotById(pref === 'match' ? season : pref);
  const src = reduced ? mascot.still : mascot.loop;
  img.src = src;
  img.dataset.idle = src;
  img.classList.remove('is-tile');
  img.dataset.mascot = mascot.id;
}
