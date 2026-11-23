// The full-screen My Stats page (streak, overall numbers, calendar, medals, chests).
// Progress math lives in backend/progress.js; this file only draws it.
import { achievements, calendarMonth, dailyStreak, localDay, treasure } from '../backend/progress.js';
import { flameImg, medalImg, starSvg } from './art.js';
import { loadProgress, mergeEntries } from './progress-store.js';
import { el, renderStats } from './views.js';

const icon = name => '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const monthLabel = (year, month, long) => new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: long ? 'long' : 'short', year: 'numeric' });
const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

export function setupProgress({ reducedMotion, getHistory, sidebar, chestSrc }) {
  let snap = null;
  const today = () => localDay();

  function snapshot() {
    const day = today();
    const entries = mergeEntries(getHistory());
    const progress = loadProgress();
    const options = { themesTried: progress.themesTried.size, revealsSeen: progress.revealsSeen };
    const list = achievements(entries, options);
    // A campaign's five levels all have to be cleared in the same campaign, so that one uses only the current history.
    const own = achievements(getHistory(), options).find(item => item.id === 'treasure-hunter');
    snap = {
      day, entries, achievements: list.map(item => (item.id === 'treasure-hunter' ? own : item)),
      streak: dailyStreak(entries, day), chests: treasure(entries)
    };
    return snap;
  }

  // ---- shared bits --------------------------------------------------------
  function flame(streak, big) {
    const box = el('div', 'flame-box' + (big ? ' is-big' : ''));
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', streak.current + ' Day Streak!');
    box.insertAdjacentHTML('beforeend', flameImg(streak.current > 0, reducedMotion.matches));
    box.append(el('b', 'flame-n', String(streak.current)), el('span', 'flame-banner', 'Day Streak!'));
    return box;
  }

  function calendar(full) {
    const wrap = el('div', 'cal' + (full ? ' cal-full' : ''));
    const now = new Date();
    const state = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const nav = (label, name, step) => {
      const button = el('button', 'cal-nav');
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.insertAdjacentHTML('beforeend', icon(name));
      button.addEventListener('click', event => {
        event.stopPropagation();
        state.month += step;
        if (state.month < 1) { state.month = 12; state.year--; }
        if (state.month > 12) { state.month = 1; state.year++; }
        draw();
      });
      return button;
    };
    const prev = nav('Previous month', 'chev-left', -1), next = nav('Next month', 'chev-right', 1);
    const title = el('b', 'cal-title');
    title.setAttribute('aria-live', 'polite');
    const head = el('div', 'cal-head');
    head.append(prev, title, next);
    const grid = el('div', 'cal-grid');
    grid.setAttribute('role', 'group');
    wrap.append(head, grid);

    function draw() {
      const data = calendarMonth(snap.entries, state.year, state.month, snap.day);
      const nowMonth = Number(snap.day.slice(0, 4)) * 12 + Number(snap.day.slice(5, 7));
      const atEnd = state.year * 12 + state.month >= nowMonth;
      if (atEnd && document.activeElement === next) prev.focus({ preventScroll: true });
      next.disabled = atEnd;
      title.textContent = monthLabel(state.year, state.month, full);
      const played = data.days.filter(item => item.played).length;
      grid.setAttribute('aria-label', monthLabel(state.year, state.month, true) + ', ' + plural(played, 'day') + ' played');
      const cells = [];
      if (full) for (const letter of ['M', 'T', 'W', 'T', 'F', 'S', 'S']) cells.push(el('span', 'cal-wd', letter));
      for (let i = 0; i < data.offset; i++) cells.push(el('span', 'cal-blank'));
      for (const item of data.days) {
        const cell = el('span', 'cal-d');
        const number = Number(item.day.slice(8));
        cell.setAttribute('role', 'img');
        cell.setAttribute('aria-label', number + (item.isToday ? ', today' : '') + (item.played ? ', played' : ''));
        if (item.played) cell.classList.add('is-played');
        if (item.isToday) cell.classList.add('is-today');
        if (item.day > snap.day) cell.classList.add('is-future');
        if (item.isToday) cell.insertAdjacentHTML('beforeend', starSvg());
        else if (item.played) cell.insertAdjacentHTML('beforeend', icon('check'));
        if (full) cell.append(el('small', '', String(number)));
        cells.push(cell);
      }
      grid.replaceChildren(...cells);
    }
    return { node: wrap, draw };
  }

  // ---- My Stats screen ----------------------------------------------------
  const screen = el('div', 'menu stats-screen');
  screen.id = 'statsScreen';
  screen.hidden = true;
  screen.dataset.menuOnly = '';
  const side = sidebar.cloneNode(true);
  side.id = 'statsSide';
  for (const item of side.querySelectorAll('[aria-current]')) item.removeAttribute('aria-current');
  side.querySelector('[data-menu="stats"]').setAttribute('aria-current', 'page');
  const main = el('section', 'menu-main st-main');
  const wrap = el('div', 'st-wrap');
  wrap.tabIndex = -1;
  screen.append(side, main);
  main.append(wrap);

  const head = el('header', 'set-head st-head');
  head.innerHTML = '<span class="set-head-ic">' + icon('chart') + '</span><div><h1>My Stats</h1><p>Your puzzle journey so far.</p></div>';
  const hero = el('section', 'st-card st-hero');
  const metrics = el('dl', 'stats-grid st-metrics');
  const chart = el('ol', 'distribution st-chart');
  chart.setAttribute('aria-label', 'Completed rounds by number of guesses');
  const metricCard = el('section', 'st-card');
  metricCard.append(el('h2', '', 'Overall'), metrics, el('h3', '', 'Guess distribution'), chart);
  const fullCal = calendar(true);
  const calSection = el('section', 'st-card st-cal');
  calSection.append(el('h2', '', 'Daily calendar'), fullCal.node);
  const medals = el('ul', 'st-medals');
  medals.setAttribute('aria-label', 'Achievements');
  const medalSection = el('section', 'st-card');
  medalSection.append(el('h2', '', 'Achievements'), medals);
  const chestList = el('div', 'st-chests');
  const chestSection = el('section', 'st-card');
  chestSection.append(el('h2', '', 'Treasure chests'), chestList);
  const cols = el('div', 'st-cols');
  cols.append(metricCard, calSection);
  wrap.append(head, hero, cols, medalSection, chestSection);

  function drawStats() {
    const { streak, achievements: list, chests, entries } = snap;
    hero.replaceChildren(flame(streak, true));
    const text = el('div', 'st-hero-text');
    text.append(el('h2', '', streak.current ? plural(streak.current, 'day') + ' in a row!' : 'No streak yet'),
      el('p', '', streak.playedToday ? 'You already played today. Come back tomorrow to keep it going.' : 'Finish a puzzle today to ' + (streak.current ? 'keep your streak alive.' : 'start a streak.')));
    const facts = el('div', 'st-facts');
    for (const [label, value] of [['Current', plural(streak.current, 'day')], ['Best', plural(streak.best, 'day')], ['Today', streak.playedToday ? 'Played' : 'Not yet']]) {
      const item = el('span', 'st-fact');
      item.append(el('small', '', label), el('b', '', value));
      facts.append(item);
    }
    text.append(facts);
    hero.append(text);
    renderStats(metrics, chart, entries.filter(item => !item.surprise));
    fullCal.draw();
    medals.replaceChildren(...list.map(item => {
      const card = el('li', 'st-medal' + (item.unlocked ? '' : ' is-locked'));
      card.insertAdjacentHTML('beforeend', medalImg(item.id, item.unlocked));
      const body = el('div', 'st-medal-body');
      const percent = Math.round(item.progress.value / item.progress.target * 100);
      const bar = el('div', 'st-bar');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', item.title);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(item.progress.target));
      bar.setAttribute('aria-valuenow', String(item.progress.value));
      bar.append(el('i'));
      bar.firstChild.style.width = percent + '%';
      body.append(el('b', '', item.title), el('small', '', item.description), bar,
        el('span', 'st-count', item.unlocked ? 'Unlocked' : item.progress.value + ' / ' + item.progress.target));
      card.append(body);
      return card;
    }));
    const earned = Math.min(chests.chests, 10);
    const items = [];
    for (let i = 0; i < earned; i++) {
      const img = el('img', 'st-chest');
      img.alt = 'Chest ' + (i + 1);
      img.src = chestSrc;
      items.push(img);
    }
    if (chests.chests > earned) items.push(el('b', 'st-more', '+' + (chests.chests - earned)));
    if (!chests.chests) items.push(el('p', 'st-empty', 'No chests yet. Win ' + chests.progress.target + ' puzzles to open your first one.'));
    const next = el('div', 'st-next');
    const locked = el('img', 'st-chest is-locked');
    locked.alt = '';
    locked.src = chestSrc;
    const bar = el('div', 'st-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Next chest');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(chests.progress.target));
    bar.setAttribute('aria-valuenow', String(chests.progress.value));
    bar.append(el('i'));
    bar.firstChild.style.width = chests.progress.value / chests.progress.target * 100 + '%';
    const label = el('span', 'st-count', chests.progress.value + ' / ' + chests.progress.target + ' wins to the next chest');
    const info = el('div', 'st-next-body');
    info.append(el('b', '', plural(chests.chests, 'chest') + ' unlocked'), bar, label);
    next.append(locked, info);
    chestList.replaceChildren(el('div', 'st-chest-row', ''), next);
    chestList.firstChild.append(...items);
  }

  // The page is built from a snapshot, so rebuild them when the app returns after midnight.
  let shownDay = today();
  const refreshIfNewDay = () => {
    if (document.visibilityState === 'hidden' || today() === shownDay || !snap) return;
    shownDay = today();
    api.refresh();
  };
  document.addEventListener('visibilitychange', refreshIfNewDay);
  window.addEventListener('focus', refreshIfNewDay);
  const api = {
    screen,
    visible: () => !screen.hidden,
    refresh() {
      snapshot();
      if (!screen.hidden) drawStats();
    },
    show() {
      snapshot();
      drawStats();
      screen.hidden = false;
      wrap.scrollTop = 0;
      main.scrollTop = 0;
      wrap.focus({ preventScroll: true });
    },
    hide() { screen.hidden = true; }
  };
  return api;
}
