const HOME = 'https://www.google.com';
const SEARCH = 'https://www.google.com/search?q=';

const tabsEl = document.getElementById('tabs');
const viewsEl = document.getElementById('views');
const urlInput = document.getElementById('url');
const newTabBtn = document.getElementById('new-tab');

let tabs = [];
let activeId = null;
let counter = 0;

function toUrl(text) {
  text = text.trim();
  if (!text) return HOME;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(text) || /^localhost(:\d+)?/.test(text)) {
    return 'https://' + text;
  }
  return SEARCH + encodeURIComponent(text);
}

function createTab(url = HOME) {
  const id = ++counter;

  const view = document.createElement('webview');
  view.src = url;
  view.setAttribute('allowpopups', '');
  viewsEl.appendChild(view);

  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.innerHTML = '<span class="title">Nueva pestaña</span><button title="Cerrar">✕</button>';
  tabsEl.insertBefore(tabEl, newTabBtn);

  const tab = { id, view, tabEl };
  tabs.push(tab);

  tabEl.addEventListener('click', () => switchTab(id));
  tabEl.querySelector('button').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(id);
  });

  view.addEventListener('page-title-updated', (e) => {
    tabEl.querySelector('.title').textContent = e.title;
  });
  const syncUrl = (e) => {
    if (id === activeId && e.url) urlInput.value = e.url;
  };
  view.addEventListener('did-navigate', syncUrl);
  view.addEventListener('did-navigate-in-page', syncUrl);

  switchTab(id);
  return tab;
}

function switchTab(id) {
  activeId = id;
  tabs.forEach((t) => {
    const active = t.id === id;
    t.view.classList.toggle('active', active);
    t.tabEl.classList.toggle('active', active);
    if (active) {
      try { urlInput.value = t.view.getURL(); } catch { urlInput.value = t.view.src; }
    }
  });
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

const current = () => tabs.find((t) => t.id === activeId);

// Controles
document.getElementById('back').onclick = () => current()?.view.canGoBack() && current().view.goBack();
document.getElementById('forward').onclick = () => current()?.view.canGoForward() && current().view.goForward();
document.getElementById('reload').onclick = () => current()?.view.reload();
newTabBtn.onclick = () => createTab();

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    current()?.view.loadURL(toUrl(urlInput.value));
    current()?.view.focus();
  }
});

// Atajos
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 't') { e.preventDefault(); createTab(); }
  if (k === 'w') { e.preventDefault(); closeTab(activeId); }
  if (k === 'l') { e.preventDefault(); urlInput.focus(); urlInput.select(); }
  if (k === 'r') { e.preventDefault(); current()?.view.reload(); }
});

// Links target=_blank desde el proceso principal
window.browserAPI.onOpenTab((url) => createTab(url));

createTab();
