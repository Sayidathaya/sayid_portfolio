/**
 * SRA SECRET LEVEL // KONAMI CODE.
 *
 * Optional bonus stage. It never runs while the visitor is typing, while a
 * dialog is open, or during the intro. The overlay is dismissible with a real
 * button and Escape, and focus returns to the element that opened it.
 */
const SEQUENCE = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
] as const;

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

let overlay: HTMLElement | null = null;
let previousFocus: HTMLElement | null = null;
let sequenceIndex = 0;

const buildOverlay = (): HTMLElement => {
  const host = document.createElement("section");
  host.className = "secret-level";
  host.dataset.secretOverlay = "";
  host.dataset.state = "out";
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.setAttribute("aria-labelledby", "secret-title");
  host.setAttribute("aria-describedby", "secret-copy");

  const frame = document.createElement("div");
  frame.className = "secret-frame";

  const scan = document.createElement("span");
  scan.className = "secret-scan";
  scan.setAttribute("aria-hidden", "true");

  const kicker = document.createElement("p");
  kicker.className = "secret-kicker";
  kicker.textContent = "Secret level // bonus stage";

  const glyphs = document.createElement("p");
  glyphs.className = "secret-glyphs";
  glyphs.setAttribute("aria-hidden", "true");
  glyphs.textContent = "★ ▚ ★ ▞ ★";

  const title = document.createElement("h2");
  title.id = "secret-title";
  title.className = "secret-title";
  title.textContent = "You found the warp pipe.";

  const copy = document.createElement("p");
  copy.id = "secret-copy";
  copy.className = "secret-copy";
  copy.textContent =
    "The archive remembers curious players. Nothing was unlocked that you cannot close; the bonus stage is pure chromatic noise.";

  const code = document.createElement("p");
  code.className = "secret-code";
  code.textContent = "KONAMI CODE ACCEPTED · PRESS START TO RESUME";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "secret-close";
  close.dataset.secretClose = "";
  close.textContent = "Resume mission";

  frame.append(scan, kicker, glyphs, title, copy, code, close);
  host.append(frame);
  return host;
};

const closeSecret = (): void => {
  const current = overlay;
  if (!current) return;
  overlay = null;
  current.dataset.state = "out";
  document.documentElement.removeAttribute("data-secret");
  window.setTimeout(() => current.remove(), 260);

  const target = previousFocus;
  previousFocus = null;
  if (target?.isConnected) target.focus({ preventScroll: true });
};

const openSecret = (): void => {
  if (overlay) return;
  if (document.querySelector("dialog[open]")) return;
  if (document.querySelector("[data-intro]")) return;

  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const host = buildOverlay();
  overlay = host;
  document.documentElement.dataset.secret = "on";
  document.body.append(host);

  const close = host.querySelector<HTMLButtonElement>("[data-secret-close]");
  close?.addEventListener("click", closeSecret);
  host.addEventListener("click", (event) => {
    if (event.target === host) closeSecret();
  });
  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeSecret();
      return;
    }
    if (event.key !== "Tab") return;
    event.preventDefault();
    close?.focus();
  });

  requestAnimationFrame(() => {
    host.dataset.state = "in";
    close?.focus({ preventScroll: true });
  });

  document.dispatchEvent(new CustomEvent("sra:secret-unlocked"));
};

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;
  if (overlay) {
    if (event.key === "Escape") closeSecret();
    return;
  }

  const key = event.key.toLowerCase();
  if (key === SEQUENCE[sequenceIndex]) {
    sequenceIndex += 1;
    if (sequenceIndex === SEQUENCE.length) {
      sequenceIndex = 0;
      openSecret();
    }
    return;
  }
  sequenceIndex = key === SEQUENCE[0] ? 1 : 0;
};

document.addEventListener("keydown", onKeyDown);

window.addEventListener(
  "pagehide",
  () => {
    document.removeEventListener("keydown", onKeyDown);
    closeSecret();
  },
  { once: true },
);
