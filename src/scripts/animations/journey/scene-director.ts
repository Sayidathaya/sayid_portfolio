import {
  getHudOffset,
  getJourneyScrollMax,
  getJourneyScrollTop,
  getJourneyTargetOffset,
  registerScrollResolver,
} from "../core/smoother";

/**
 * One scene director for the whole journey.
 *
 * It is deliberately the only module that answers "where am I?":
 *   - scroll position comes from the active scroll owner in `core/smoother`
 *     (ScrollSmoother when live, native `scrollY` otherwise);
 *   - scene boundaries are measured through the smoother's own resolver, so
 *     pinned spacers and transformed content stay in the same coordinate space;
 *   - progress, HUD text, compass state and the active atmosphere are written
 *     once per animation frame;
 *   - `sra:journey-state` fires only when the scene changes, so listeners never
 *     rebuild navigation on every scroll tick.
 *
 * Decorative velocity is clamped and applied to exactly two small targets: the
 * active atmosphere layer and the compass. It never touches copy, cards,
 * controls or content images.
 */

export type SceneTone = "red" | "yellow" | "blue" | "purple";

interface SceneDefinition {
  id: string;
  /** Short chapter label for the compass. */
  label: string;
  /** One-line scene description for the HUD. */
  chapter: string;
  tone: SceneTone;
  selector: string;
  navId: string | null;
}

const SCENES: readonly SceneDefinition[] = [
  {
    id: "top",
    label: "Title",
    chapter: "Title screen · Player 01 online",
    tone: "red",
    selector: "#top",
    navId: null,
  },
  {
    id: "about",
    label: "About",
    chapter: "Profile archive · Verified briefing",
    tone: "blue",
    selector: "#about",
    navId: "about",
  },
  {
    id: "experience",
    label: "Experience",
    chapter: "Career quest · Field timeline",
    tone: "red",
    selector: "#experience",
    navId: "experience",
  },
  {
    id: "skills",
    label: "Skills",
    chapter: "Ability matrix · Core inventory",
    tone: "purple",
    selector: "#skills",
    navId: "skills",
  },
  {
    id: "projects",
    label: "Projects",
    chapter: "Project multiverse · Case files",
    tone: "purple",
    selector: "#projects",
    navId: "projects",
  },
  {
    id: "certificates",
    label: "Vault",
    chapter: "Credential vault · Field captures",
    tone: "yellow",
    selector: "#certificates",
    navId: "certificates",
  },
  {
    id: "contact",
    label: "Comms",
    chapter: "Direct contact · Signal deck",
    tone: "blue",
    selector: "#contact",
    navId: "contact",
  },
  {
    id: "footer",
    label: "Finale",
    chapter: "Post-credits · The world still open",
    tone: "yellow",
    selector: ".console",
    navId: null,
  },
];

export interface JourneyStateDetail {
  id: string;
  label: string;
  chapter: string;
  tone: SceneTone;
  /** 1-based chapter number. */
  index: number;
  total: number;
  /** Overall journey progress, 0–1. */
  progress: number;
  /** Progress inside the active scene, 0–1. */
  local: number;
  navId: string | null;
}

type Disposer = () => void;

/** Scene switches when the next section crosses this line of the viewport. */
const SWITCH_RATIO = 0.36;
/** Screen pixels per millisecond that map to the full velocity clamp. */
const VELOCITY_RANGE = 1.9;
/** Interpolation time constant for the decorative velocity. */
const VELOCITY_DECAY = 90;
/** Milliseconds of stillness before the velocity target returns to zero. */
const SETTLE_DELAY = 110;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const clampVelocity = (value: number): number => Math.min(1, Math.max(-1, value));

export function initSceneDirector(): Disposer | null {
  if (document.documentElement.dataset.journeyOn === "true") return null;

  const compass = document.querySelector<HTMLElement>("[data-journey]");
  if (!compass) return null;

  const root = document.documentElement;
  const hud = document.querySelector<HTMLElement>("[data-hud]");
  const globalProgress = document.querySelector<HTMLElement>("[data-progress]");
  const progressFill = compass.querySelector<HTMLElement>("[data-journey-progress]");
  const percentLabel = compass.querySelector<HTMLElement>("[data-journey-percent]");
  const zoneLabel = compass.querySelector<HTMLElement>("[data-journey-zone]");
  const titleLabel = compass.querySelector<HTMLElement>("[data-journey-title]");
  const chapterLabel = compass.querySelector<HTMLElement>("[data-journey-chapter]");
  const indexLabel = compass.querySelector<HTMLElement>("[data-journey-index]");
  const stops = Array.from(compass.querySelectorAll<HTMLAnchorElement>("[data-journey-stop]"));

  interface SceneRange {
    scene: SceneDefinition;
    start: number;
    end: number;
  }

  let ranges: SceneRange[] = [];
  let scrollMax = 0;
  let activeId: string | null = null;
  let activeFx: HTMLElement | null = null;
  let lastPercent = -1;
  let lastScrolled: boolean | null = null;

  let frame = 0;
  let resizeTimer = 0;
  let motionTimer = 0;

  let velocity = 0;
  let velocityTarget = 0;
  let velocityFrame = 0;
  let velocityClock = 0;
  let lastTop = 0;
  let lastSample = 0;
  let lastMoveAt = 0;

  const measure = (): void => {
    scrollMax = getJourneyScrollMax();
    const starts: number[] = [];
    let previous = 0;

    for (let index = 0; index < SCENES.length; index += 1) {
      const scene = SCENES[index];
      if (!scene) continue;
      let start = 0;
      if (index > 0) {
        const element = document.querySelector<HTMLElement>(scene.selector);
        start = element ? getJourneyTargetOffset(element) : scrollMax;
      }
      start = Math.min(scrollMax, Math.max(previous, Math.max(0, start)));
      starts.push(start);
      previous = start;
    }

    ranges = SCENES.map((scene, index) => {
      const start = starts[index] ?? 0;
      const next = starts[index + 1] ?? scrollMax;
      return { scene, start, end: Math.max(start, next) };
    });
  };

  const resolveIndex = (top: number): number => {
    if (ranges.length === 0) return 0;
    if (scrollMax <= 1) return 0;
    if (top >= scrollMax - 2) return ranges.length - 1;

    const probe = top + window.innerHeight * SWITCH_RATIO;
    let index = 0;
    for (let candidate = 0; candidate < ranges.length; candidate += 1) {
      if (probe >= (ranges[candidate]?.start ?? 0)) index = candidate;
    }
    return index;
  };

  const applyScene = (index: number, progress: number, top: number): void => {
    const range = ranges[index];
    if (!range) return;
    const { scene } = range;
    if (scene.id === activeId) return;

    activeId = scene.id;

    const previousFx = activeFx;
    if (previousFx) {
      previousFx.removeAttribute("data-active");
      previousFx.style.setProperty("--fx-vel", "0");
    }

    activeFx = document.querySelector<HTMLElement>(`[data-scene-fx="${scene.id}"]`);
    activeFx?.setAttribute("data-active", "");
    activeFx?.style.setProperty("--fx-vel", velocity.toFixed(3));

    root.dataset.scene = scene.id;
    root.dataset.journeyScene = scene.id;
    root.dataset.journeyTone = scene.tone;
    compass.dataset.tone = scene.tone;
    compass.dataset.scene = scene.id;

    const number = String(index + 1).padStart(2, "0");
    if (zoneLabel) zoneLabel.textContent = number;
    if (indexLabel) indexLabel.textContent = number;
    if (titleLabel) titleLabel.textContent = scene.label;
    if (chapterLabel) chapterLabel.textContent = scene.chapter;

    for (const stop of stops) {
      const stopId = stop.dataset.journeyStop;
      const current = stopId === scene.id;
      const stopIndex = SCENES.findIndex((entry) => entry.id === stopId);
      if (current) stop.setAttribute("aria-current", "location");
      else stop.removeAttribute("aria-current");
      stop.dataset.state =
        stopIndex < index && stopIndex >= 0 ? "done" : current ? "current" : "next";
    }

    const local = clamp01((top - range.start) / Math.max(1, range.end - range.start));
    const detail: JourneyStateDetail = {
      id: scene.id,
      label: scene.label,
      chapter: scene.chapter,
      tone: scene.tone,
      index: index + 1,
      total: SCENES.length,
      progress,
      local,
      navId: scene.navId,
    };
    document.dispatchEvent(new CustomEvent<JourneyStateDetail>("sra:journey-state", { detail }));
    document.dispatchEvent(new CustomEvent<JourneyStateDetail>("sra:scene-change", { detail }));
  };

  const applyProgress = (top: number): void => {
    const progress = scrollMax > 0 ? clamp01(top / scrollMax) : 0;
    if (progressFill) progressFill.style.transform = `scaleX(${progress.toFixed(4)})`;
    if (globalProgress) globalProgress.style.setProperty("--progress", progress.toFixed(4));
    compass.style.setProperty("--journey-progress", progress.toFixed(4));

    const percent = Math.round(progress * 100);
    if (percentLabel && percent !== lastPercent) {
      lastPercent = percent;
      percentLabel.textContent = `${percent}%`;
    }

    const scrolled = top > 8;
    if (hud && scrolled !== lastScrolled) {
      lastScrolled = scrolled;
      hud.toggleAttribute("data-scrolled", scrolled);
    }
  };

  const startVelocity = (): void => {
    if (velocityFrame) return;
    velocityClock = performance.now();
    velocityFrame = requestAnimationFrame(stepVelocity);
  };

  const applyVelocity = (): void => {
    const value = velocity.toFixed(3);
    if (activeFx) activeFx.style.setProperty("--fx-vel", value);
    compass.style.setProperty("--journey-velocity", value);
  };

  function stepVelocity(now: number): void {
    velocityFrame = 0;
    const dt = Math.min(64, Math.max(8, now - velocityClock));
    velocityClock = now;

    if (document.hidden || now - lastMoveAt > SETTLE_DELAY) velocityTarget = 0;
    velocity += (velocityTarget - velocity) * (1 - Math.exp(-dt / VELOCITY_DECAY));
    if (velocityTarget === 0 && Math.abs(velocity) < 0.002) velocity = 0;

    applyVelocity();
    if (velocity !== 0 || velocityTarget !== 0) velocityFrame = requestAnimationFrame(stepVelocity);
  }

  const sampleVelocity = (top: number): void => {
    const now = performance.now();
    if (lastSample > 0) {
      const delta = top - lastTop;
      const elapsed = Math.max(8, now - lastSample);
      if (Math.abs(delta) > window.innerHeight * 1.5) {
        /* A deep link or a programmatic jump is navigation, not a gesture. */
        velocityTarget = 0;
        lastMoveAt = 0;
        startVelocity();
      } else if (Math.abs(delta) > 0.2) {
        velocityTarget =
          root.dataset.motion === "calm" ? 0 : clampVelocity(delta / elapsed / VELOCITY_RANGE);
        lastMoveAt = now;
        startVelocity();
      }
    }
    lastTop = top;
    lastSample = now;
  };

  const update = (): void => {
    frame = 0;
    if (ranges.length === 0) measure();

    const top = Math.max(0, Math.min(scrollMax, getJourneyScrollTop()));
    const index = resolveIndex(top);
    const range = ranges[index];
    const progress = scrollMax > 0 ? clamp01(top / scrollMax) : 0;

    applyProgress(top);
    applyScene(index, progress, top);
    if (range && activeId === range.scene.id) {
      const local = clamp01((top - range.start) / Math.max(1, range.end - range.start));
      compass.style.setProperty("--scene-progress", local.toFixed(4));
    }
    sampleVelocity(top);
  };

  const schedule = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(update);
  };

  const remeasure = (): void => {
    measure();
    lastSample = 0;
    schedule();
  };

  const onResize = (): void => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(remeasure, 120);
  };

  const onMotionChange = (): void => {
    window.clearTimeout(motionTimer);
    if (root.dataset.motion === "calm") {
      velocityTarget = 0;
      lastMoveAt = 0;
      startVelocity();
    }
    motionTimer = window.setTimeout(remeasure, 60);
  };

  const onRefresh = (): void => remeasure();

  const onVisibility = (): void => {
    if (!document.hidden) {
      schedule();
      return;
    }
    velocity = 0;
    velocityTarget = 0;
    if (velocityFrame) {
      cancelAnimationFrame(velocityFrame);
      velocityFrame = 0;
    }
    applyVelocity();
  };

  const onFonts = (): void => remeasure();

  /* The finale link targets the heading, but the heading is reveal-transformed
     while the footer is still entering. Resolve `#footer-title` against the
     untransformed save panel so the post-credits opener lands cleanly below the
     HUD instead of drifting under it once the reveal settles. */
  const disposeFooterAnchor = registerScrollResolver((id) => {
    if (id !== "footer-title") return null;
    const save = document.querySelector<HTMLElement>(".console-save");
    if (!save) return null;
    return Math.max(0, getJourneyTargetOffset(save) - getHudOffset() - 8);
  });

  measure();
  root.dataset.journeyOn = "true";
  update();

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("sra:smooth-update", schedule);
  document.addEventListener("sra:journey-refresh", onRefresh);
  document.addEventListener("sra:motion-change", onMotionChange);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("sra:intro-complete", schedule);
  window.addEventListener("load", remeasure, { once: true });
  void document.fonts?.ready.then(onFonts).catch(() => undefined);

  return () => {
    window.clearTimeout(resizeTimer);
    window.clearTimeout(motionTimer);
    cancelAnimationFrame(frame);
    cancelAnimationFrame(velocityFrame);
    frame = 0;
    velocityFrame = 0;
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("sra:smooth-update", schedule);
    document.removeEventListener("sra:journey-refresh", onRefresh);
    document.removeEventListener("sra:motion-change", onMotionChange);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("sra:intro-complete", schedule);
    window.removeEventListener("load", remeasure);
    disposeFooterAnchor();
    activeFx?.removeAttribute("data-active");
    activeFx?.style.setProperty("--fx-vel", "0");
    for (const stop of stops) {
      stop.removeAttribute("aria-current");
      delete stop.dataset.state;
    }
    compass.style.setProperty("--journey-velocity", "0");
    delete root.dataset.scene;
    delete root.dataset.journeyScene;
    delete root.dataset.journeyTone;
    delete root.dataset.journeyOn;
  };
}
