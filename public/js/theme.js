const THEME_STORAGE_KEY = "hydrotrack_theme";

function getSystemTheme() {
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  return prefersDark ? "dark" : "light";
}

function getSavedTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "system";
}

function resolveTheme(theme) {
  if (theme === "system") {
    return getSystemTheme();
  }

  return theme;
}

function applyTheme(theme) {
  const resolvedTheme = resolveTheme(theme);

  document.documentElement.setAttribute(
    "data-theme",
    resolvedTheme
  );

  document.documentElement.setAttribute(
    "data-theme-preference",
    theme
  );
}

function saveTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

function initializeThemeSelector() {
  const themeSelect = document.getElementById("themeSelect");

  if (!themeSelect) {
    return;
  }

  const savedTheme = getSavedTheme();

  themeSelect.value = savedTheme;

  themeSelect.addEventListener("change", event => {
    saveTheme(event.target.value);
  });
}

applyTheme(getSavedTheme());

document.addEventListener(
  "DOMContentLoaded",
  initializeThemeSelector
);

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    const savedTheme = getSavedTheme();

    if (savedTheme === "system") {
      applyTheme("system");
    }
  });

window.hydrotrackTheme = {
  applyTheme,
  saveTheme,
  getSavedTheme,
  getSystemTheme
};