type Theme = "light" | "dark";

const root = document.documentElement;
const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
const label = document.querySelector<HTMLElement>("[data-theme-label]");
const themeColor = document.querySelector<HTMLMetaElement>("[data-theme-color]");
const themeQuery = window.matchMedia("(prefers-color-scheme: light)");
let shiftTimer = 0;

const current = (): Theme => (root.dataset.theme === "light" ? "light" : "dark");

const storedTheme = (): string | null => {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
};

const apply = (theme: Theme, animate = false): void => {
  root.dataset.theme = theme;
  const light = theme === "light";
  if (button) {
    const action = light ? "Switch to dark theme" : "Switch to light theme";
    button.setAttribute("aria-pressed", String(light));
    button.setAttribute("aria-label", action);
    button.setAttribute("data-tip", action);
  }
  if (label) label.textContent = light ? "Light" : "Dark";
  if (themeColor) themeColor.content = light ? "#FFFDF7" : "#0A0A0D";

  if (!animate) return;
  window.clearTimeout(shiftTimer);
  root.classList.add("theme-shift");
  shiftTimer = window.setTimeout(() => root.classList.remove("theme-shift"), 240);
};

if (button) {
  apply(current());
  button.addEventListener("click", () => {
    const next: Theme = current() === "light" ? "dark" : "light";
    apply(next, true);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage can be blocked; the choice then lasts for this page view only.
    }
  });
} else if (label) {
  label.textContent = current() === "light" ? "Light" : "Dark";
}

// Follow the operating system only while the visitor has not made an explicit choice.
themeQuery.addEventListener("change", (event) => {
  const stored = storedTheme();
  if (stored === "light" || stored === "dark") return;
  apply(event.matches ? "light" : "dark", true);
});

export {};
