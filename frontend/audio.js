import bgm_christmas_party from './assets/audio/bgm_christmas_party.mp3';
import bgm_classic_arcade from './assets/audio/bgm_classic_arcade.mp3';
import bgm_halloween_bop from './assets/audio/bgm_halloween_bop.mp3';
import bgm_space_boost from './assets/audio/bgm_space_boost.mp3';
import bgm_spring_hop from './assets/audio/bgm_spring_hop.mp3';
import bgm_summer_sprint from './assets/audio/bgm_summer_sprint.mp3';
import sfx_correct_letter from './assets/audio/sfx_correct_letter.mp3';
import sfx_game_over_fakeout from './assets/audio/sfx_game_over_fakeout.mp3';
import sfx_guess_submitted from './assets/audio/sfx_guess_submitted.mp3';
import sfx_invalid_word from './assets/audio/sfx_invalid_word.mp3';
import sfx_last_try from './assets/audio/sfx_last_try.mp3';
import sfx_plot_twist_reveal from './assets/audio/sfx_plot_twist_reveal.mp3';
import sfx_tile_flip from './assets/audio/sfx_tile_flip.mp3';
import sfx_treasure_pop from './assets/audio/sfx_treasure_pop.mp3';
import ui_pop_click from './assets/audio/ui/ui-pop-click.wav';
import felt_tap_open from './assets/audio/ui/felt-tap-open.wav';
import felt_tap_success from './assets/audio/ui/felt-tap-success.wav';
import { readStorage, saveStorage } from './storage.js';

const effects = {
  correct_letter: sfx_correct_letter,
  game_over_fakeout: sfx_game_over_fakeout,
  guess_submitted: sfx_guess_submitted,
  hint_used: felt_tap_success,
  invalid_word: sfx_invalid_word,
  key_backspace: ui_pop_click,
  key_enter: felt_tap_open,
  key_tap_a: ui_pop_click,
  key_tap_b: ui_pop_click,
  last_try: sfx_last_try,
  menu_open: felt_tap_open,
  plot_twist_reveal: sfx_plot_twist_reveal,
  tile_flip: sfx_tile_flip,
  toggle: ui_pop_click,
  treasure_pop: sfx_treasure_pop
};
const tracks = {
  classic: bgm_classic_arcade,
  christmas: bgm_christmas_party,
  spring: bgm_spring_hop,
  halloween: bgm_halloween_bop,
  space: bgm_space_boost,
  summer: bgm_summer_sprint,
  valentine: bgm_classic_arcade,
  rainy: bgm_spring_hop
};

// `allowMute`: the master mute can only be flipped in the app's settings, so other builds ignore a saved one.
export function setupAudio({ soundControl, musicControl, volumeControl, seasonSelect, allowMute = false }) {
  const key = 'daily-puzzle-audio';
  const saved = readStorage(key);
  soundControl.checked = saved?.sound !== false;
  musicControl.checked = saved?.music === true;
  volumeControl.value = Number.isFinite(saved?.volume) ? saved.volume : 65;
  // Separate music/SFX levels fall back to the single persisted volume.
  const level = value => Math.min(100, Math.max(0, Number(value)));
  let musicVolume = Number.isFinite(saved?.musicVolume) ? level(saved.musicVolume) : Number(volumeControl.value);
  let sfxVolume = Number.isFinite(saved?.sfxVolume) ? level(saved.sfxVolume) : Number(volumeControl.value);
  let muted = allowMute && saved?.muted === true;
  const storedMuted = saved?.muted === true;

  const decoded = new Map();
  let context, soundGain, musicGain, loop, selection;
  let musicRequest = 0;
  let lastTap = -Infinity;
  let oddTap = false;

  function decode(source) {
    if (!decoded.has(source)) {
      const bytes = Uint8Array.from(atob(source.split(',')[1]), char => char.charCodeAt(0));
      decoded.set(source, context.decodeAudioData(bytes.buffer));
    }
    return decoded.get(source);
  }

  function applyVolume() {
    if (context) {
      soundGain.gain.value = soundControl.checked && !muted ? sfxVolume / 100 * .72 : 0;
      musicGain.gain.value = muted ? 0 : musicVolume / 100 * .25;
    }
  }

  function refreshMusic() {
    if (!context) return;
    const next = musicControl.checked && !muted && !document.hidden
      ? tracks[seasonSelect.value] ?? tracks.classic
      : null;
    if (next === selection) return;
    selection = next;
    loop?.stop();
    loop = null;
    const request = ++musicRequest;
    if (!next) return;
    decode(next).then(buffer => {
      if (request !== musicRequest) return;
      loop = context.createBufferSource();
      loop.buffer = buffer;
      loop.loop = true;
      loop.connect(musicGain);
      loop.start();
    }).catch(() => {});
  }

  function activate() {
    if (!context) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return;
      try { context = new AudioContextClass(); } catch { return; }
      soundGain = context.createGain();
      musicGain = context.createGain();
      soundGain.connect(context.destination);
      musicGain.connect(context.destination);
      applyVolume();
    }
    if (context.state !== 'running') context.resume().catch(() => {});
    refreshMusic();
  }

  function play(name) {
    if (!context || muted || !soundControl.checked || document.hidden) return;
    decode(effects[name]).then(buffer => {
      if (muted || !soundControl.checked) return;
      const effect = context.createBufferSource();
      effect.buffer = buffer;
      effect.connect(soundGain);
      effect.start();
    }).catch(() => {});
  }

  function tap() {
    const now = performance.now();
    if (now - lastTap < 35) return;
    lastTap = now;
    oddTap = !oddTap;
    play(oddTap ? 'key_tap_a' : 'key_tap_b');
  }

  function save() {
    saveStorage(key, {
      sound: soundControl.checked, music: musicControl.checked, volume: Number(volumeControl.value),
      musicVolume, sfxVolume, muted: allowMute ? muted : storedMuted
    });
    applyVolume();
    refreshMusic();
  }

  document.addEventListener('pointerdown', activate, { capture: true });
  document.addEventListener('keydown', activate, { capture: true });
  document.addEventListener('visibilitychange', refreshMusic);
  seasonSelect.addEventListener('change', refreshMusic);
  soundControl.addEventListener('change', () => { activate(); save(); play('toggle'); });
  musicControl.addEventListener('change', () => { activate(); save(); play('toggle'); });
  volumeControl.addEventListener('input', () => {
    musicVolume = sfxVolume = Number(volumeControl.value);
    save();
  });

  // Used by the settings screen: separate levels and a master mute.
  const mix = {
    get: () => ({ music: musicVolume, sfx: sfxVolume, muted, musicOn: musicControl.checked }),
    setVolume(kind, value) {
      if (kind === 'music') musicVolume = level(value);
      else sfxVolume = level(value);
      save();
    },
    setMuted(value) { muted = Boolean(value); activate(); save(); },
    setMusic(value) {
      musicControl.checked = Boolean(value);
      musicControl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  return { play, tap, mix };
}
