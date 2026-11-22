export type Theme = 'light' | 'dark'

const THEME_KEY = 'tenk:theme:v1'

export function getPreferredTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Use the system setting when browser storage is unavailable.
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function saveTheme(theme: Theme) {
  applyTheme(theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Keep the selected theme for this page even when storage is unavailable.
  }
}

export function initializeTheme() {
  const theme = getPreferredTheme()
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}
