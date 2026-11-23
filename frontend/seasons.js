import classicIcon from './assets/icons/classic_dino.png';
import christmasIcon from './assets/icons/christmas_dino.png';
import springIcon from './assets/icons/spring_dino.png';
import halloweenIcon from './assets/icons/halloween_dino.png';
import spaceIcon from './assets/icons/space_dino.png';
import summerIcon from './assets/icons/stealth_puzzle.png';
import classicLoop from './assets/seasons/01_classic_dino_idle.gif';
import classicStill from './assets/seasons/01_classic_dino_idle.png';
import christmasLoop from './assets/seasons/02_christmas_santa_wave.gif';
import christmasStill from './assets/seasons/02_christmas_santa_wave.png';
import springLoop from './assets/seasons/03_spring_blossom_bunny.gif';
import springStill from './assets/seasons/03_spring_blossom_bunny.png';
import halloweenLoop from './assets/seasons/04_halloween_pumpkin_ghost.gif';
import halloweenStill from './assets/seasons/04_halloween_pumpkin_ghost.png';
import spaceLoop from './assets/seasons/05_space_dino_astronaut.gif';
import spaceStill from './assets/seasons/05_space_dino_astronaut.png';
import { readStorage, saveStorage } from './storage.js';

const themes = new Map([
  ['classic', { icon: classicIcon, label: 'Classic', loop: classicLoop, still: classicStill }],
  ['christmas', { icon: christmasIcon, label: 'Christmas', loop: christmasLoop, still: christmasStill }],
  ['spring', { icon: springIcon, label: 'Spring Blossom', loop: springLoop, still: springStill }],
  ['halloween', { icon: halloweenIcon, label: 'Halloween', loop: halloweenLoop, still: halloweenStill }],
  ['space', { icon: spaceIcon, label: 'Space Night', loop: spaceLoop, still: spaceStill }],
  ['summer', { icon: summerIcon, label: 'Summer Picnic', loop: classicLoop, still: classicStill }],
  ['valentine', { icon: classicIcon, label: 'Valentine', loop: classicLoop, still: classicStill }],
  ['rainy', { icon: classicIcon, label: 'Rainy Day', loop: classicLoop, still: classicStill }]
]);

export function setupSeasons({ select, mascot, reducedMotion, settings, isEditor }) {
  const storageKey = isEditor
    ? 'daily-puzzle-season-editor'
    : 'daily-puzzle-season-' + (settings.session ?? 'default');
  const saved = readStorage(storageKey);
  let selected = themes.has(saved) ? saved : themes.has(settings.season) ? settings.season : 'classic';

  select.replaceChildren(...Array.from(themes, ([id, theme]) => new Option(theme.label, id)));

  function updateMascot() {
    const theme = themes.get(selected);
    mascot.src = reducedMotion.matches ? theme.still : theme.loop;
  }

  function applyTheme() {
    document.documentElement.dataset.season = selected;
    select.value = selected;
    document.querySelector('link[rel="icon"]').href = themes.get(selected).icon;
    if (mascot.hasAttribute('src')) updateMascot();
  }

  select.addEventListener('change', () => {
    if (!themes.has(select.value)) return;
    selected = select.value;
    saveStorage(storageKey, selected);
    applyTheme();
  });
  reducedMotion.addEventListener('change', () => {
    if (mascot.hasAttribute('src')) updateMascot();
  });

  applyTheme();
  return {
    current: () => selected,
    label: id => themes.get(id ?? selected)?.label ?? '',
    showMascot: updateMascot,
    stopMascot: () => mascot.removeAttribute('src')
  };
}
