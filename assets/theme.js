/**
 * URS DS Tools — light ↔ dark theme (shared across pages)
 */
const THEME_STORAGE_KEY = 'urs-ds-theme';

function getInitialTheme() {
    try {
        const v = localStorage.getItem(THEME_STORAGE_KEY);
        if (v === 'light' || v === 'dark') return v;
    } catch (_) { /* private browsing */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeColorMeta(theme) {
    let el = document.getElementById('theme-color-dynamic');
    if (!el) {
        el = document.createElement('meta');
        el.name = 'theme-color';
        el.id = 'theme-color-dynamic';
        document.head.appendChild(el);
    }
    el.content = theme === 'dark' ? '#000000' : '#f5f5f7';
}

function updateThemeToggleUI(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isDark = theme === 'dark';
    btn.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
    btn.setAttribute('title', isDark ? '浅色模式' : '深色模式');
    btn.dataset.theme = theme;
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeColorMeta(theme);
    updateThemeToggleUI(theme);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) { /* ignore */ }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

function initTheme() {
    applyTheme(getInitialTheme());
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggleTheme);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
