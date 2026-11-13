// Site behavior: color mode, menu, search, chapter cursor, theme song player.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Color mode ---------- */
const root = document.documentElement;
const systemLight = matchMedia('(prefers-color-scheme: light)');

function savedMode() {
  try { return localStorage.getItem('theme') || 'system'; } catch { return 'system'; }
}

function applyMode(mode) {
  try {
    if (mode === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', mode);
  } catch { /* storage blocked: still apply for this page */ }
  const theme = mode === 'system' ? (systemLight.matches ? 'light' : 'dark') : mode;
  root.dataset.theme = theme;
  $$('[data-theme-toggle]').forEach((btn) => {
    const target = theme === 'dark' ? 'Light' : 'Dark';
    btn.textContent = target;
    btn.setAttribute('aria-label', `Switch to ${target.toLowerCase()} mode`);
  });
  $$('[data-theme-set]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.themeSet === mode)));
}

applyMode(savedMode());
systemLight.addEventListener('change', () => { if (savedMode() === 'system') applyMode('system'); });
$$('[data-theme-toggle]').forEach((btn) => btn.addEventListener('click', () =>
  applyMode(root.dataset.theme === 'dark' ? 'light' : 'dark')));
$$('[data-theme-set]').forEach((btn) => btn.addEventListener('click', () => applyMode(btn.dataset.themeSet)));

/* ---------- Dialog helpers ---------- */
// A click on the dialog element itself (not its panel) is a click on the backdrop.
function closeOnBackdrop(dialog) {
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
}

/* ---------- Mobile menu ---------- */
const menu = $('#mobile-menu');
if (menu) {
  $$('[data-menu-open]').forEach((btn) => btn.addEventListener('click', () => menu.showModal()));
  $$('[data-menu-close]', menu).forEach((btn) => btn.addEventListener('click', () => menu.close()));
}

/* ---------- Search ---------- */
const search = $('#search');
if (search) setupSearch(search);

function setupSearch(dialog) {
  const input = $('[data-search-input]', dialog);
  const results = $('[data-search-results]', dialog);
  const recent = $('[data-search-recent]', dialog);
  const list = $('[data-search-list]', dialog);
  const filtersEl = $('[data-search-filters]', dialog);
  const countEl = $('[data-search-count]', dialog);
  let pagefind = null;
  let token = 0;
  let timer = null;
  let groups = [];
  let filter = 'all';
  let selected = 0;

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  if (!isMac) $$('[data-search-key]').forEach((k) => { k.textContent = 'Ctrl K'; });

  function open() {
    if (menu?.open) menu.close();
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    loadPagefind();
  }

  async function loadPagefind() {
    if (!pagefind) {
      pagefind = import('/pagefind/pagefind.js').then(async (pf) => {
        await pf.options({ excerptLength: 22 });
        pf.init();
        return pf;
      });
    }
    return pagefind;
  }

  $$('[data-search-open]').forEach((btn) => btn.addEventListener('click', open));
  $$('[data-search-close]', dialog).forEach((btn) => btn.addEventListener('click', () => dialog.close()));
  closeOnBackdrop(dialog);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
  });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });

  input.addEventListener('keydown', (e) => {
    const items = $$('[data-result]', results).filter((el) => el.offsetParent !== null);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      selected = Math.max(0, Math.min(items.length - 1, selected + (e.key === 'ArrowDown' ? 1 : -1)));
      highlight(items);
    } else if (e.key === 'Enter') {
      const item = items[selected];
      if (item) { e.preventDefault(); location.href = item.href; }
    }
  });

  results.addEventListener('mousemove', (e) => {
    const item = e.target.closest('[data-result]');
    if (!item) return;
    const items = $$('[data-result]', results).filter((el) => el.offsetParent !== null);
    const i = items.indexOf(item);
    if (i !== selected) { selected = i; highlight(items, false); }
  });

  // Navigating to an anchor on the current page should still close the dialog.
  results.addEventListener('click', (e) => { if (e.target.closest('a')) dialog.close(); });

  function highlight(items, scroll = true) {
    items.forEach((el, i) => el.classList.toggle('is-selected', i === selected));
    if (scroll) items[selected]?.scrollIntoView({ block: 'nearest' });
  }

  async function run() {
    const query = input.value.trim();
    const mine = ++token;
    if (!query) { groups = []; render(''); return; }
    const pf = await loadPagefind();
    const found = await pf.search(query);
    if (mine !== token || !found) return;
    const pages = await Promise.all(found.results.slice(0, 25).map((r) => r.data()));
    if (mine !== token) return;
    groups = pages.map((page) => {
      const campaign = page.filters?.campaign?.[0];
      const key = campaign || (page.filters?.type?.includes('Blog') ? 'Blog' : 'Other');
      const subs = (page.sub_results?.length ? page.sub_results : [{ title: page.meta.title, url: page.url, excerpt: page.excerpt }])
        .slice(0, 4);
      return { page, key, subs };
    });
    render(query);
  }

  function chip(id, label, count, accent) {
    const pressed = filter === id;
    return `<button type="button" class="filter-chip" data-filter="${esc(id)}" data-campaign="${esc(accent)}" aria-pressed="${pressed}">${esc(label)}<span>${count}</span></button>`;
  }

  function render(query) {
    recent.hidden = Boolean(query);
    filtersEl.hidden = !query;
    if (!query) { list.innerHTML = ''; countEl.textContent = ''; selected = 0; highlight($$('[data-result]', recent), false); return; }

    // Chips: All, then each campaign with results, then Blog
    const counts = new Map();
    const accents = new Map();
    groups.forEach((g) => {
      counts.set(g.key, (counts.get(g.key) || 0) + g.subs.length);
      accents.set(g.key, g.page.meta.accent || 'fu');
    });
    if (filter !== 'all' && !counts.has(filter)) filter = 'all';
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const keys = [...counts.keys()].filter((k) => k !== 'Blog' && k !== 'Other');
    filtersEl.innerHTML = chip('all', 'All', total, root.dataset.campaign) +
      keys.map((k) => chip(k, k, counts.get(k), accents.get(k))).join('') +
      (counts.has('Blog') ? chip('Blog', 'Blog', counts.get('Blog'), accents.get('Blog')) : '');

    const shown = groups.filter((g) => filter === 'all' || g.key === filter);
    const shownCount = shown.reduce((a, g) => a + g.subs.length, 0);
    countEl.textContent = `${shownCount} result${shownCount === 1 ? '' : 's'}`;

    if (!shown.length) {
      list.innerHTML = `<p class="search-empty">No results for “${esc(query)}”</p>`;
      return;
    }
    list.innerHTML = shown.map(({ page, subs }) => `
      <div class="result-group" data-campaign="${esc(page.meta.accent || 'fu')}">
        <div class="result-head">
          ${page.meta.image ? `<img class="art" src="${esc(page.meta.image)}" alt="">` : '<span class="art art-placeholder" aria-hidden="true"></span>'}
          <span class="result-title">${esc(page.meta.title)}</span>
          ${page.meta.kicker ? `<span class="result-kicker">${esc(page.meta.kicker)}</span>` : ''}
        </div>
        ${subs.map((s) => `
          <a class="result-sub blip" href="${esc(s.url)}" data-result>
            <span class="cursor" aria-hidden="true">▶</span>
            ${s.title && s.title !== page.meta.title ? `<span class="result-heading">${esc(s.title)}</span>` : ''}
            <span class="result-excerpt">${s.excerpt}</span>
          </a>`).join('')}
      </div>`).join('');
    selected = 0;
    highlight($$('[data-result]', list), false);
  }

  filtersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    render(input.value.trim());
    input.focus();
  });

  // Recent recaps get the same keyboard selection before anything is typed
  highlight($$('[data-result]', recent), false);
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Chapter cursor ---------- */
const tocLinks = $$('[data-toc] .toc-link');
if (tocLinks.length) {
  const ids = [...new Set(tocLinks.map((a) => decodeURIComponent(a.hash.slice(1))))];
  const headings = ids.map((id) => document.getElementById(id)).filter(Boolean);
  const current = $('[data-toc-current]');
  const count = $('[data-toc-count]');
  const sheet = $('#toc-sheet');
  let active = -1;
  let frame = 0;

  function update() {
    frame = 0;
    let i = 0;
    headings.forEach((h, n) => { if (h.getBoundingClientRect().top < 180) i = n; });
    if (i === active) return;
    active = i;
    const id = headings[i]?.id;
    tocLinks.forEach((a) => {
      const on = decodeURIComponent(a.hash.slice(1)) === id;
      a.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    if (current) current.textContent = headings[i]?.textContent.trim() || '';
    if (count) count.textContent = `${i + 1} / ${headings.length}`;
  }

  addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', () => { active = -1; update(); });
  update();

  if (sheet) {
    $('[data-toc-open]')?.addEventListener('click', () => {
      sheet.showModal();
      $('.toc-link.is-current', sheet)?.focus();
    });
    closeOnBackdrop(sheet);
    sheet.addEventListener('click', (e) => { if (e.target.closest('.toc-link')) sheet.close(); });
  }
}

/* ---------- Theme song player ---------- */
$$('[data-player]').forEach((player) => {
  const audio = $('audio', player);
  const btn = $('.player-btn', player);
  const icon = $('span', btn);
  const time = $('.player-time', player);
  const bar = $('.player-bar', player);
  const fill = $('.player-fill', player);
  const label = btn.getAttribute('aria-label').replace(/^Play /, '');
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  player.classList.add('is-ready');
  audio.removeAttribute('controls');

  btn.addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
  audio.addEventListener('play', () => {
    player.classList.add('is-playing');
    icon.textContent = '❚❚';
    btn.setAttribute('aria-label', `Pause ${label}`);
  });
  audio.addEventListener('pause', () => {
    player.classList.remove('is-playing');
    icon.textContent = '▶';
    btn.setAttribute('aria-label', `Play ${label}`);
  });
  const tick = () => {
    const total = fmt(audio.duration || 0);
    time.textContent = audio.currentTime > 0 ? `${fmt(audio.currentTime)} / ${total}` : total;
    fill.style.width = audio.duration ? `${(audio.currentTime / audio.duration) * 100}%` : '0';
  };
  audio.addEventListener('timeupdate', tick);
  audio.addEventListener('loadedmetadata', tick);
  bar.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = bar.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });
});
