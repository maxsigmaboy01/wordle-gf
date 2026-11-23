// Tiny pixel-art helpers: everything is built from <rect>s so it stays crisp at any size and needs no image files.
export const rect = (x, y, w, h, fill) =>
  '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"/>';

// ASCII sprite: each character is a palette key, '.' is empty. Horizontal runs are merged into one rect.
export function sprite(rows, palette, x = 0, y = 0, scale = 1) {
  let out = '';
  rows.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      const ch = row[i];
      let k = i;
      while (k < row.length && row[k] === ch) k++;
      if (ch !== '.' && palette[ch]) out += rect(x + i * scale, y + j * scale, (k - i) * scale, scale, palette[ch]);
      i = k;
    }
  });
  return out;
}

export function disc(cx, cy, r, fill) {
  let out = '';
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r + r * .6 - dy * dy)));
    out += rect(cx - half, cy + dy, half * 2 + 1, 1, fill);
  }
  return out;
}

// Stair-stepped triangle, apex at (cx, top).
export function tri(cx, top, h, fill) {
  let out = '';
  for (let i = 0; i < h; i++) out += rect(cx - i, top + i, i * 2 + 1, 1, fill);
  return out;
}

export function svg(w, h, inner, cls, par = 'xMidYMax slice') {
  return '<svg class="' + cls + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="' + par +
    '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + inner + '</svg>';
}

// Small deterministic random numbers so scenery never jumps between renders.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
