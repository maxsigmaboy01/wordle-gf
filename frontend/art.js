// Art for the progress cards: achievement badges and the streak flame are image assets; the calendar star is a tiny inline SVG.
import { sprite, svg } from './pixel.js';
import firstSteps from './assets/achievements/first-steps.png';
import sharpEye from './assets/achievements/sharp-eye.png';
import hatTrick from './assets/achievements/hat-trick.png';
import weekWarrior from './assets/achievements/week-warrior.png';
import puzzlePro from './assets/achievements/puzzle-pro.png';
import treasureHunter from './assets/achievements/treasure-hunter.png';
import fashionista from './assets/achievements/fashionista.png';
import gotBaited from './assets/achievements/got-baited.png';
import flameGif from './assets/effects/streak_flame.gif';
import flameStill from './assets/effects/streak_flame.png';

const badges = {
  'first-steps': firstSteps, 'sharp-eye': sharpEye, 'hat-trick': hatTrick, 'week-warrior': weekWarrior,
  'puzzle-pro': puzzlePro, 'treasure-hunter': treasureHunter, fashionista, 'got-baited': gotBaited
};

// Locked badges are the same art, greyed out in CSS (.is-locked).
export function medalImg(id, unlocked) {
  return '<img class="art-medal' + (unlocked ? '' : ' is-locked') + '" alt="" width="64" height="64" src="' + (badges[id] ?? firstSteps) + '">';
}

export const flameImg = (lit, reduced) =>
  '<img class="art-flame' + (lit ? '' : ' is-locked') + '" alt="" width="128" height="128" src="' + (reduced ? flameStill : flameGif) + '">';

const STAR = ['...1...', '...1...', '1111111', '.11111.', '..111..', '.11.11.', '.1...1.'];
export const starSvg = () => svg(7, 7, sprite(STAR, { 1: '#e2a712' }), 'art-star', 'xMidYMid meet');
