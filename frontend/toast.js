// A small live-region toast, bottom center. Created once, text swapped per message.
let node = null, timer = 0;

export function initToast() {
  if (node) return;
  node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
  node.dataset.menuOnly = '';
  document.body.appendChild(node);
}

export function showToast(text, ms = 2200) {
  if (!node) return;
  clearTimeout(timer);
  node.textContent = text;
  // Restart the transition if a toast is already up.
  node.classList.remove('is-on');
  void node.offsetWidth;
  node.classList.add('is-on');
  timer = setTimeout(() => node.classList.remove('is-on'), ms);
}
