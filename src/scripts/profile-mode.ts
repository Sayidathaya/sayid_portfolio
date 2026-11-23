/**
 * Builder / Creator profile class switch.
 *
 * The two panels are rendered from the existing skill groups and experience
 * records at build time. This module only switches state: it never introduces
 * a second content database. The active mode also drives the About palette and
 * the identity scanner tone through `data-profile-mode` on the section.
 */
type ProfileMode = "builder" | "creator";

const STORAGE_KEY = "sra:profile-mode";

const readStoredMode = (): ProfileMode | null => {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return value === "builder" || value === "creator" ? value : null;
  } catch {
    return null;
  }
};

const writeStoredMode = (mode: ProfileMode): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* Session storage is a convenience, never a requirement. */
  }
};

const initProfileMode = (): void => {
  const section = document.querySelector<HTMLElement>("[data-profile-mode]");
  if (!section) return;

  const buttons = Array.from(
    section.querySelectorAll<HTMLButtonElement>("[data-profile-mode-btn]"),
  );
  const panels = Array.from(section.querySelectorAll<HTMLElement>("[data-mode-panel]"));
  if (buttons.length === 0) return;

  const isMode = (value: string | undefined): value is ProfileMode =>
    value === "builder" || value === "creator";

  const apply = (mode: ProfileMode, persist: boolean): void => {
    section.dataset.profileMode = mode;
    document.documentElement.dataset.profileMode = mode;
    for (const button of buttons) {
      const active = button.dataset.profileModeBtn === mode;
      button.setAttribute("aria-pressed", String(active));
    }
    for (const panel of panels) {
      const active = panel.dataset.modePanel === mode;
      panel.setAttribute("aria-hidden", String(!active));
      if (active) panel.removeAttribute("inert");
      else panel.setAttribute("inert", "");
    }
    if (persist) writeStoredMode(mode);
  };

  const initial = readStoredMode();
  apply(initial ?? "builder", false);

  for (const button of buttons) {
    button.addEventListener("click", () => {
      if (isMode(button.dataset.profileModeBtn)) apply(button.dataset.profileModeBtn, true);
    });
  }

  const group = section.querySelector<HTMLElement>(".profile-mode-switch");
  group?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = buttons[(index + step + buttons.length) % buttons.length];
    if (!next) return;
    next.focus();
    if (isMode(next.dataset.profileModeBtn)) apply(next.dataset.profileModeBtn, true);
  });
};

initProfileMode();
