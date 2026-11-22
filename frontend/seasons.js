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
  ['classic', { label: 'Classic', loop: classicLoop, still: classicStill }],
  ['christmas', { label: 'Christmas', loop: christmasLoop, still: christmasStill }],
  ['spring', { label: 'Spring Blossom', loop: springLoop, still: springStill }],
  ['halloween', { label: 'Halloween', loop: halloweenLoop, still: halloweenStill }],
  ['space', { label: 'Space Night', loop: spaceLoop, still: spaceStill }],
  ['summer', { label: 'Summer Picnic', loop: classicLoop, still: classicStill }]
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
    showMascot: updateMascot,
    stopMascot: () => mascot.removeAttribute('src')
  };
}
