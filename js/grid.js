/**
 * grid.js — renders the elimination grid and handles tap-to-mark.
 *
 * Marks are player-owned state, kept in app.js:
 *   marks: Map keyed "a,b,i,j" (a<b) → 0 unknown, 1 no (✗), 2 yes (✓)
 *
 * Phone layout: one category-pair sub-grid at a time with prev/next paging.
 * Wide layout: all sub-grids at once (upper-triangle arrangement).
 * Same DOM either way; CSS media query switches between them.
 */

export function markKey(a, b, i, j) {
  return a < b ? `${a},${b},${i},${j}` : `${b},${a},${j},${i}`;
}

export function getMark(marks, a, b, i, j) {
  return marks.get(markKey(a, b, i, j)) || 0;
}

/** All category pairs in display order: name-vs-each first, then the rest. */
export function categoryPairs(numCategories) {
  const pairs = [];
  for (let b = 1; b < numCategories; b++) pairs.push([0, b]);
  for (let a = 1; a < numCategories; a++) {
    for (let b = a + 1; b < numCategories; b++) pairs.push([a, b]);
  }
  return pairs;
}

const MARK_GLYPH = ['', '✗', '✓'];
const MARK_CLASS = ['unknown', 'no', 'yes'];

/**
 * Render all sub-grids into container.
 * onTap(a, b, i, j) is called when a cell is tapped.
 * Returns a refresh(marks) function to update cell visuals in place.
 */
export function renderGrid(container, theme, marks, onTap) {
  container.textContent = '';
  const pairs = categoryPairs(theme.categories.length);
  const cellEls = new Map(); // markKey → td element

  for (const [a, b] of pairs) {
    const catA = theme.categories[a];
    const catB = theme.categories[b];

    const wrap = document.createElement('div');
    wrap.className = 'subgrid';
    wrap.dataset.pair = `${a}-${b}`;

    const title = document.createElement('div');
    title.className = 'subgrid-title';
    title.textContent = `${catA.label} × ${catB.label}`;
    wrap.appendChild(title);

    const table = document.createElement('table');
    table.className = 'elim';

    // Header row
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    hr.appendChild(document.createElement('th')); // corner
    for (const item of catB.items) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = item;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 0; i < catA.items.length; i++) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = catA.items[i];
      tr.appendChild(th);
      for (let j = 0; j < catB.items.length; j++) {
        const td = document.createElement('td');
        td.className = 'cell';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cellbtn';
        btn.addEventListener('click', () => onTap(a, b, i, j));
        td.appendChild(btn);
        tr.appendChild(td);
        cellEls.set(markKey(a, b, i, j), btn);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  function refresh(currentMarks) {
    for (const [key, btn] of cellEls) {
      const v = currentMarks.get(key) || 0;
      btn.textContent = MARK_GLYPH[v];
      btn.className = 'cellbtn ' + MARK_CLASS[v];
      const [a, b, i, j] = key.split(',').map(Number);
      const itemA = theme.categories[a].items[i];
      const itemB = theme.categories[b].items[j];
      const stateWord = v === 2 ? 'yes' : v === 1 ? 'no' : 'blank';
      btn.setAttribute('aria-label', `${itemA} and ${itemB}: ${stateWord}`);
    }
  }

  refresh(marks);
  return { refresh, pairs };
}

/** Briefly highlight a cell after a change. */
export function flashCell(container, a, b, i, j) {
  const key = markKey(a, b, i, j);
  const btn = container.querySelector(`.subgrid[data-pair="${Math.min(a,b)}-${Math.max(a,b)}"]`);
  // Find via aria refresh path: simpler to query all and match — cells are few.
  const subgrid = container.querySelector(
    `.subgrid[data-pair="${a < b ? a : b}-${a < b ? b : a}"]`);
  if (!subgrid) return;
  const rows = subgrid.querySelectorAll('tbody tr');
  const ri = a < b ? i : j;
  const ci = a < b ? j : i;
  const row = rows[ri];
  if (!row) return;
  const cell = row.querySelectorAll('.cellbtn')[ci];
  if (!cell) return;
  cell.classList.add('flash');
  setTimeout(() => cell.classList.remove('flash'), 900);
}

/** Show only the sub-grid at pageIndex (phone paging). -1 shows all. */
export function showPage(container, pairs, pageIndex) {
  const subgrids = container.querySelectorAll('.subgrid');
  subgrids.forEach((el, idx) => {
    el.classList.toggle('hidden-page', pageIndex !== -1 && idx !== pageIndex);
  });
}
