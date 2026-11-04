const START_URL = new URL('start.html', location.href).href;
const SEARCH = 'https://www.google.com/search?q=';
const ACCENTS = ['#6c8cff', '#34c38f', '#f46a6a', '#f1b44c', '#c084fc'];
const CLOSE_SVG = '<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const $ = (id) => document.getElementById(id);
const tabsEl = $('tabs');
const viewsEl = $('views');
const urlInput = $('url');
const newTabBtn = $('new-tab');
const favBtn = $('fav');
const bookmarksEl = $('bookmarks');
const menuEl = $('menu');
const histPanel = $('history-panel');
const histList = $('hist-list');
const histSearch = $('hist-search');

// ---------- Almacenamiento ----------
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch { return fallback; }
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let tabs = [];
let activeId = null;
let counter = 0;
let theme = load('theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
let accent = load('accent', ACCENTS[0]);
let favorites = load('favorites', []);
let visits = load('history', []);

// ---------- Utilidades ----------
function toUrl(text) {
  text = text.trim();
  if (!text) return START_URL;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(text) || /^localhost(:\d+)?/.test(text)) {
    return 'https://' + text;
  }
  return SEARCH + encodeURIComponent(text);
}

function safeUrl(view) {
  try { return view.getURL(); } catch { return view.src || ''; }
}
const isStartUrl = (u) => !!u && u.split('#')[0].split('?')[0].endsWith('/start.html');
const displayUrl = (u) => (isStartUrl(u) ? '' : u);
const current = () => tabs.find((t) => t.id === activeId);
const currentUrl = () => (current() ? safeUrl(current().view) : '');

// ---------- Tema y color ----------
function injectStart(view) {
  const data = { favorites, theme, accent };
  view.executeJavaScript('window.initStart && window.initStart(' + JSON.stringify(data) + ')').catch(() => {});
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--accent', accent);
  $('theme-label').textContent = theme === 'dark' ? 'Oscuro' : 'Claro';
  document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('sel', s.dataset.color === accent));
  tabs.forEach((t) => { if (isStartUrl(safeUrl(t.view))) injectStart(t.view); });
}

ACCENTS.forEach((c) => {
  const b = document.createElement('button');
  b.className = 'swatch';
  b.dataset.color = c;
  b.style.background = c;
  b.title = c;
  b.onclick = () => { accent = c; store('accent', c); applyTheme(); };
  $('swatches').appendChild(b);
});

$('m-theme').onclick = () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  store('theme', theme);
  applyTheme();
};

// ---------- Menú ----------
function closeMenu() { menuEl.hidden = true; }
$('menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  menuEl.hidden = !menuEl.hidden;
});
menuEl.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', closeMenu);
window.addEventListener('blur', closeMenu);
$('m-history').onclick = () => { closeMenu(); toggleHistory(); };
$('m-forward').onclick = () => { closeMenu(); current()?.view.canGoForward() && current().view.goForward(); };

// ---------- Historial ----------
function addVisit(url, title) {
  if (!url || !/^https?:/i.test(url)) return;
  if (visits[0] && visits[0].url === url) return;
  visits.unshift({ url, title: title || url, time: Date.now() });
  if (visits.length > 1000) visits.length = 1000;
  store('history', visits);
}

function updateVisitTitle(url, title) {
  const v = visits.find((x) => x.url === url);
  if (v && title) { v.title = title; store('history', visits); }
}

function renderHistory() {
  const q = histSearch.value.trim().toLowerCase();
  const items = visits
    .filter((h) => !q || h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q))
    .slice(0, 200);
  histList.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hist-empty';
    empty.textContent = q ? 'Sin resultados' : 'Todavía no hay historial';
    histList.appendChild(empty);
    return;
  }
  items.forEach((h) => {
    const row = document.createElement('div');
    row.className = 'hist-item';
    const t = document.createElement('div');
    t.className = 'h-title';
    t.textContent = h.title;
    const m = document.createElement('div');
    m.className = 'h-meta';
    m.textContent = new Date(h.time).toLocaleString('es-AR') + ' · ' + h.url;
    row.append(t, m);
    row.addEventListener('click', () => {
      current()?.view.loadURL(h.url);
      histPanel.hidden = true;
    });
    histList.appendChild(row);
  });
}

function toggleHistory() {
  histPanel.hidden = !histPanel.hidden;
  if (!histPanel.hidden) {
    histSearch.value = '';
    renderHistory();
    histSearch.focus();
  }
}

$('hist-btn').onclick = toggleHistory;
$('hist-close').onclick = () => { histPanel.hidden = true; };
$('hist-clear').onclick = () => {
  if (confirm('¿Borrar todo el historial?')) {
    visits = [];
    store('history', visits);
    renderHistory();
  }
};
histSearch.addEventListener('input', renderHistory);

// ---------- Favoritos ----------
function updateStar() {
  const isFav = favorites.some((f) => f.url === currentUrl());
  favBtn.classList.toggle('on', isFav);
  favBtn.title = isFav ? 'Quitar de favoritos (Ctrl+D)' : 'Agregar a favoritos (Ctrl+D)';
}

function renderFavorites() {
  bookmarksEl.innerHTML = '';
  favorites.forEach((f) => {
    const chip = document.createElement('div');
    chip.className = 'bookmark';
    chip.textContent = f.title || f.url;
    chip.title = f.url + '\n(clic derecho para borrar)';
    chip.addEventListener('click', () => current()?.view.loadURL(f.url));
    chip.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      favorites = favorites.filter((x) => x.url !== f.url);
      store('favorites', favorites);
      renderFavorites();
      updateStar();
    });
    bookmarksEl.appendChild(chip);
  });
}

function toggleFavorite() {
  const url = currentUrl();
  if (!/^https?:/i.test(url)) return;
  if (favorites.some((f) => f.url === url)) {
    favorites = favorites.filter((f) => f.url !== url);
  } else {
    const title = current().tabEl.querySelector('.title').textContent;
    favorites.push({ title, url });
  }
  store('favorites', favorites);
  renderFavorites();
  updateStar();
  tabs.forEach((t) => { if (isStartUrl(safeUrl(t.view))) injectStart(t.view); });
}

// ---------- Pestañas ----------
function createTab(url = START_URL) {
  const id = ++counter;

  const view = document.createElement('webview');
  view.setAttribute('allowpopups', '');
  view.src = url;
  viewsEl.appendChild(view);

  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.innerHTML =
    '<img class="fav-ico" alt="" hidden><span class="spinner"></span>' +
    '<span class="title">Nueva pestaña</span>' +
    '<button class="close" title="Cerrar pestaña">' + CLOSE_SVG + '</button>';
  tabsEl.insertBefore(tabEl, newTabBtn);

  const titleEl = tabEl.querySelector('.title');
  const icoEl = tabEl.querySelector('.fav-ico');
  icoEl.onerror = () => { icoEl.hidden = true; };

  tabs.push({ id, view, tabEl });

  tabEl.addEventListener('click', () => switchTab(id));
  tabEl.querySelector('.close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(id);
  });

  const syncUrl = (e) => {
    if (id === activeId && e.url) {
      urlInput.value = displayUrl(e.url);
      updateStar();
    }
  };

  view.addEventListener('page-title-updated', (e) => {
    titleEl.textContent = e.title;
    try { updateVisitTitle(view.getURL(), e.title); } catch {}
  });
  view.addEventListener('page-favicon-updated', (e) => {
    if (e.favicons && e.favicons[0]) {
      icoEl.src = e.favicons[0];
      icoEl.hidden = false;
    }
  });
  view.addEventListener('did-start-loading', () => tabEl.classList.add('loading'));
  view.addEventListener('did-stop-loading', () => tabEl.classList.remove('loading'));
  view.addEventListener('did-navigate', (e) => {
    icoEl.hidden = true;
    syncUrl(e);
    addVisit(e.url, '');
  });
  view.addEventListener('did-navigate-in-page', (e) => {
    syncUrl(e);
    if (e.isMainFrame) addVisit(e.url, '');
  });
  view.addEventListener('dom-ready', () => {
    if (isStartUrl(safeUrl(view))) injectStart(view);
  });

  switchTab(id);
  if (url === START_URL) urlInput.focus();
}

function switchTab(id) {
  activeId = id;
  tabs.forEach((t) => {
    const active = t.id === id;
    t.view.classList.toggle('active', active);
    t.tabEl.classList.toggle('active', active);
    if (active) {
      urlInput.value = displayUrl(safeUrl(t.view));
      t.tabEl.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  });
  updateStar();
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const [tab] = tabs.splice(idx, 1);
  tab.view.remove();
  tab.tabEl.remove();
  if (tabs.length === 0) {
    createTab();
  } else if (activeId === id) {
    switchTab(tabs[Math.max(0, idx - 1)].id);
  }
}

// ---------- Controles ----------
$('back').onclick = () => current()?.view.canGoBack() && current().view.goBack();
$('forward').onclick = () => current()?.view.canGoForward() && current().view.goForward();
$('reload').onclick = () => current()?.view.reload();
newTabBtn.onclick = () => createTab();
favBtn.onclick = toggleFavorite;

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    current()?.view.loadURL(toUrl(urlInput.value));
    current()?.view.focus();
  }
});
urlInput.addEventListener('focus', () => urlInput.select());

// ---------- Atajos ----------
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMenu();
    histPanel.hidden = true;
    return;
  }
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 't') { e.preventDefault(); createTab(); }
  if (k === 'w') { e.preventDefault(); closeTab(activeId); }
  if (k === 'l') { e.preventDefault(); urlInput.focus(); urlInput.select(); }
  if (k === 'r') { e.preventDefault(); current()?.view.reload(); }
  if (k === 'd') { e.preventDefault(); toggleFavorite(); }
  if (k === 'h') { e.preventDefault(); toggleHistory(); }
});

// Links target=_blank desde el proceso principal
window.browserAPI.onOpenTab((url) => createTab(url));

// ---------- Inicio ----------
applyTheme();
renderFavorites();
createTab();
