/**
 * Arcade achievements.
 *
 * Exploration rewards only: the module observes the real sections and stores
 * unlocked ids in session storage. Nothing is sent anywhere, no scroll listener
 * is added, and the toast stack never intercepts the page scroll.
 */
type AchievementTone = "red" | "yellow" | "blue" | "purple";

type AchievementId =
  | "first-contact"
  | "world-explorer"
  | "archive-hunter"
  | "field-observer"
  | "mission-complete"
  | "secret-level";

interface AchievementDefinition {
  id: AchievementId;
  label: string;
  detail: string;
  tone: AchievementTone;
  glyph: string;
}

const STORAGE_KEY = "sra:achievements:v1";

const ACHIEVEMENTS: Record<AchievementId, AchievementDefinition> = {
  "first-contact": {
    id: "first-contact",
    label: "First Contact",
    detail: "Signal received from the Contact terminal.",
    tone: "blue",
    glyph: "✉",
  },
  "world-explorer": {
    id: "world-explorer",
    label: "World Explorer",
    detail: "Every featured project world has crossed the viewport.",
    tone: "purple",
    glyph: "◈",
  },
  "archive-hunter": {
    id: "archive-hunter",
    label: "Archive Hunter",
    detail: "The credential vault has been opened.",
    tone: "yellow",
    glyph: "▣",
  },
  "field-observer": {
    id: "field-observer",
    label: "Field Observer",
    detail: "Field Captures entered the frame.",
    tone: "red",
    glyph: "◎",
  },
  "mission-complete": {
    id: "mission-complete",
    label: "Mission Complete",
    detail: "The post-credits save point has been reached.",
    tone: "yellow",
    glyph: "★",
  },
  "secret-level": {
    id: "secret-level",
    label: "Secret Level",
    detail: "The Konami code opened the bonus stage.",
    tone: "purple",
    glyph: "?",
  },
};

const readUnlocked = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
};

const writeUnlocked = (unlocked: Set<string>): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(unlocked)));
  } catch {
    /* Storage is optional; achievements still show for this page view. */
  }
};

export function initAchievements(): () => void {
  const stack = document.querySelector<HTMLElement>("[data-achievement-stack]");
  if (!stack) return () => undefined;

  const unlocked = readUnlocked();
  const queue: AchievementDefinition[] = [];
  let activeToast: HTMLElement | null = null;
  let secretListener: (() => void) | null = null;

  const showToast = (definition: AchievementDefinition): void => {
    const toast = document.createElement("article");
    toast.className = "achievement-toast";
    toast.dataset.tone = definition.tone;

    const glyph = document.createElement("span");
    glyph.className = "achievement-toast-glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = definition.glyph;

    const copy = document.createElement("div");
    copy.className = "achievement-toast-copy";
    const kicker = document.createElement("p");
    kicker.className = "achievement-toast-kicker";
    kicker.textContent = "Achievement unlocked";
    const title = document.createElement("p");
    title.className = "achievement-toast-title";
    title.textContent = definition.label;
    const detail = document.createElement("p");
    detail.className = "achievement-toast-detail";
    detail.textContent = definition.detail;
    copy.append(kicker, title, detail);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "achievement-toast-close";
    close.setAttribute("aria-label", `Dismiss achievement: ${definition.label}`);
    close.textContent = "✕";

    let hideTimer = 0;

    const dismiss = (): void => {
      if (toast.dataset.state === "hide") return;
      toast.dataset.state = "hide";
      window.clearTimeout(hideTimer);
      window.setTimeout(() => {
        toast.remove();
        if (activeToast === toast) activeToast = null;
        pump();
      }, 420);
    };

    close.addEventListener("click", dismiss);

    toast.append(glyph, copy, close);
    stack.append(toast);
    activeToast = toast;
    requestAnimationFrame(() => {
      toast.dataset.state = "show";
    });
    hideTimer = window.setTimeout(dismiss, 5600);
  };

  const pump = (): void => {
    if (activeToast || queue.length === 0) return;
    const next = queue.shift();
    if (next) showToast(next);
  };

  const unlock = (id: AchievementId): void => {
    if (unlocked.has(id)) return;
    const definition = ACHIEVEMENTS[id];
    if (!definition) return;
    unlocked.add(id);
    writeUnlocked(unlocked);
    queue.push(definition);
    pump();
  };

  const observers: IntersectionObserver[] = [];

  const observeOnce = (selector: string, id: AchievementId, margin = "-12% 0px -20% 0px"): void => {
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          unlock(id);
          observer.disconnect();
          return;
        }
      },
      { rootMargin: margin, threshold: 0 },
    );
    observer.observe(target);
    observers.push(observer);
  };

  observeOnce("#contact", "first-contact");
  observeOnce(".cert-workbench", "archive-hunter");
  observeOnce(".field-captures-wrap", "field-observer");
  observeOnce(".console", "mission-complete", "-8% 0px -12% 0px");

  const worlds = Array.from(document.querySelectorAll<HTMLElement>("[data-world]"));
  if (worlds.length > 0) {
    const seen = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = worlds.indexOf(entry.target as HTMLElement);
          if (index >= 0) seen.add(index);
          if (seen.size === worlds.length) {
            unlock("world-explorer");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.28 },
    );
    for (const world of worlds) observer.observe(world);
    observers.push(observer);
  }

  const onSecret = (): void => unlock("secret-level");
  document.addEventListener("sra:secret-unlocked", onSecret);
  secretListener = () => document.removeEventListener("sra:secret-unlocked", onSecret);

  return () => {
    for (const observer of observers) observer.disconnect();
    observers.length = 0;
    secretListener?.();
    secretListener = null;
    queue.length = 0;
    for (const toast of Array.from(stack.children)) toast.remove();
    activeToast = null;
  };
}

const dispose = initAchievements();
window.addEventListener("pagehide", dispose, { once: true });
