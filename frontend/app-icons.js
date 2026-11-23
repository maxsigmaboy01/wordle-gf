// The selectable app icons (Settings > App Icon). The same art brands the app-shell sidebars.
import iconClassic from './assets/app-icons/classic-128.png';
import iconChristmas from './assets/app-icons/christmas-128.png';
import iconHalloween from './assets/app-icons/halloween-128.png';
import iconSpring from './assets/app-icons/spring-128.png';
import iconSpace from './assets/app-icons/space-128.png';
import iconSummer from './assets/app-icons/summer-128.png';
import iconValentine from './assets/app-icons/valentine-128.png';
import iconRainy from './assets/app-icons/rainy-128.png';
import iconStealth from './assets/app-icons/stealth-128.png';

export const appIcons = [
  ['classic', 'Classic Dino', iconClassic],
  ['christmas', 'Christmas', iconChristmas],
  ['halloween', 'Halloween', iconHalloween],
  ['spring', 'Spring Blossom', iconSpring],
  ['space', 'Space Night', iconSpace],
  ['summer', 'Summer Picnic', iconSummer],
  ['valentine', 'Valentine', iconValentine],
  ['rainy', 'Rainy Day', iconRainy],
  ['stealth', 'Stealth Puzzle', iconStealth]
];

export const appIconSrc = id => (appIcons.find(item => item[0] === id) ?? appIcons[0])[2];
