const root = document.documentElement;
const themeToggle = document.querySelector('[data-theme-toggle]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const mobileNav = document.querySelector('#mobile-nav');
const language = root.dataset.language || 'en';
let messages = {};

function getMessage(path) {
  return path.split('.').reduce((value, key) => value?.[key], messages);
}

function applyMessages() {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const value = getMessage(element.dataset.i18n);
    if (!value) return;
    const attribute = element.dataset.i18nAttr;
    if (attribute) element.setAttribute(attribute, value);
    else element.textContent = value;
  });
}

async function loadMessages() {
  try {
    const response = await fetch(`../../i18n/${language}/site.json`);
    if (response.ok) messages = await response.json();
  } catch {
    messages = {};
  }
  applyMessages();
}

function setTheme(theme) {
  const dark = theme === 'dark';
  root.dataset.theme = dark ? 'dark' : 'light';
  themeToggle?.setAttribute('aria-pressed', String(dark));
  const label = getMessage(dark ? 'theme.light' : 'theme.dark');
  if (label) themeToggle?.setAttribute('aria-label', label);
  localStorage.setItem('coda-theme', dark ? 'dark' : 'light');
}

const savedTheme = localStorage.getItem('coda-theme');
const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
setTheme(savedTheme || (systemDark ? 'dark' : 'light'));
loadMessages().then(() => setTheme(root.dataset.theme));

document.querySelectorAll('[data-language-link]').forEach((link) => link.addEventListener('click', () => {
  const locale = link.dataset.locale;
  if (locale === 'en' || locale === 'zh-CN') localStorage.setItem('coda-language', locale);
}));

themeToggle?.addEventListener('click', () => {
  setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});

menuToggle?.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!open));
  mobileNav.hidden = open;
  const label = getMessage(open ? 'menu.open' : 'menu.close');
  if (label) menuToggle.textContent = label;
});

mobileNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  mobileNav.hidden = true;
  menuToggle?.setAttribute('aria-expanded', 'false');
  if (menuToggle) menuToggle.textContent = getMessage('menu.open') || menuToggle.textContent;
}));

document.querySelector('[data-copy]')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const status = document.querySelector('.copy-status');
  button.setAttribute('aria-busy', 'true');
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    status.textContent = getMessage('copy.done') || 'Copied';
  } catch {
    status.textContent = getMessage('copy.failed') || 'Select the commands above to copy them.';
  } finally {
    button.removeAttribute('aria-busy');
    window.setTimeout(() => { status.textContent = ''; }, 2400);
  }
});
