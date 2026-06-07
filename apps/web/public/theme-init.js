// Pre-paint theme resolution to avoid a flash of the wrong theme (FOUC).
// Kept as an external, render-blocking script in <head> so a strict
// Content-Security-Policy (script-src 'self') can allow it without 'unsafe-inline'.
;(function () {
  try {
    var stored = localStorage.getItem('uc.theme')
    var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
    var resolved =
      mode === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.setAttribute('data-theme-mode', mode)
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.setAttribute('data-theme-mode', 'system')
  }
})()
