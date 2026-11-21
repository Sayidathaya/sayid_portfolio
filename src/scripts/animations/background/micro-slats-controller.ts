import { onMotionChange } from "../core/motion";
import { q } from "../core/utils";
import { createMicroSlats, type MicroSlatsInstance } from "./micro-slats";

interface Palette {
  color: string;
  glintColor: string;
  backgroundColor: string;
  opacity: number;
}

type SceneTone = "red" | "yellow" | "blue" | "purple";

const TONES = new Set<string>(["red", "yellow", "blue", "purple"]);

const PALETTES: Record<"dark" | "light", Palette> = {
  dark: {
    color: "#2c2466",
    glintColor: "#8fa9ff",
    backgroundColor: "rgba(5, 5, 7, 0)",
    opacity: 0.72,
  },
  light: {
    color: "#b9c8ff",
    glintColor: "#2864ff",
    backgroundColor: "rgba(255, 253, 247, 0)",
    opacity: 0.62,
  },
};

/* Scene tints use the ink tokens: pale accents on the dark canvas, deep
   accents on the light one. The shader stays the same; only three uniforms and
   one opacity change, and only when the scene or world changes. */
const SCENE_TINTS: Record<"dark" | "light", Record<SceneTone, string>> = {
  dark: {
    red: "#ff929b",
    yellow: "#ffe791",
    blue: "#9db4ff",
    purple: "#cfb2ff",
  },
  light: {
    red: "#b00f22",
    yellow: "#6b5100",
    blue: "#1740c4",
    purple: "#6423c8",
  },
};

const SCENE_OPACITY: Record<"dark" | "light", Record<SceneTone, number>> = {
  dark: { red: 0.76, yellow: 0.7, blue: 0.72, purple: 0.74 },
  light: { red: 0.66, yellow: 0.6, blue: 0.62, purple: 0.64 },
};

const asTone = (value: string | null | undefined): SceneTone | null =>
  value && TONES.has(value) ? (value as SceneTone) : null;

const currentTheme = (): "dark" | "light" =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

export function initMicroSlatsBackground(): (() => void) | null {
  const stage = q<HTMLElement>("[data-micro-slats]");
  const mount = stage ? q<HTMLElement>("[data-micro-slats-canvas]", stage) : null;
  if (!stage || !mount || stage.dataset.microSlatsReady === "true") return null;
  stage.dataset.microSlatsReady = "true";

  const palette = PALETTES[currentTheme()];

  const instance: MicroSlatsInstance | null = createMicroSlats(mount, {
    preset: "tide",
    color: palette.color,
    glintColor: palette.glintColor,
    backgroundColor: palette.backgroundColor,
    slatWidth: 13,
    slatHeight: 30,
    gap: 4,
    roundness: 0.78,
    introDuration: 1.6,
    overrides: {
      scale: 1.15,
      speed: 0.38,
      direction: 258,
      chop: 0.32,
      stretch: 0.08,
      glint: currentTheme() === "light" ? 0.35 : 0.5,
      contrast: 1.1,
      perspective: 0.52,
      fog: 0.58,
    },
  });

  if (!instance) {
    stage.dataset.microSlatsFallback = "true";
    return null;
  }

  stage.dataset.microSlatsActive = "true";
  stage.style.setProperty("--micro-slats-opacity", String(palette.opacity));

  const root = document.documentElement;
  const activeWorldTone = (): SceneTone | null =>
    asTone(document.querySelector<HTMLElement>("[data-world][data-world-active]")?.dataset.tone);
  const initialTone = (): SceneTone => {
    if (root.dataset.scene === "projects") return activeWorldTone() ?? "purple";
    return (
      asTone(root.dataset.journeyTone) ??
      asTone(document.querySelector<HTMLElement>("[data-journey]")?.dataset.tone) ??
      "blue"
    );
  };
  let activeTone: SceneTone = initialTone();

  const applyTheme = (): void => {
    const theme = currentTheme();
    const next = PALETTES[theme];
    instance.setTheme(next.color, SCENE_TINTS[theme][activeTone], next.backgroundColor);
    stage.style.setProperty("--micro-slats-opacity", String(SCENE_OPACITY[theme][activeTone]));
    stage.dataset.microSlatsTheme = theme;
    stage.dataset.microSlatsTone = activeTone;
  };

  const applyTone = (value: string | null | undefined): void => {
    const tone = asTone(value);
    if (!tone || tone === activeTone) return;
    activeTone = tone;
    applyTheme();
  };

  applyTheme();

  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  const onJourneyState = (event: Event): void => {
    const detail = (event as CustomEvent<{ id?: string; tone?: string }>).detail;
    /* Inside the project multiverse the active world owns the palette; the
       scene tone applies everywhere else and restores on exit. */
    applyTone(detail?.id === "projects" ? (activeWorldTone() ?? detail?.tone) : detail?.tone);
  };

  const onWorldChange = (event: Event): void => {
    const detail = (event as CustomEvent<{ tone?: string }>).detail;
    applyTone(detail?.tone);
  };

  document.addEventListener("sra:journey-state", onJourneyState);
  document.addEventListener("sra:world-change", onWorldChange);

  const stopMotion = onMotionChange((mode) => {
    instance.setMotion(mode === "calm");
    stage.dataset.microSlatsMotion = mode;
  });

  const onIntroComplete = (): void => instance.playIntro();
  document.addEventListener("sra:intro-complete", onIntroComplete);

  /* When the controller is created after the gate (the deferred boot path),
     start the swell immediately instead of waiting for another page load. */
  if (document.documentElement.dataset.introDone === "true") instance.playIntro();

  const onVisibility = (): void => instance.setPaused(document.hidden);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    themeObserver.disconnect();
    stopMotion();
    document.removeEventListener("sra:intro-complete", onIntroComplete);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("sra:journey-state", onJourneyState);
    document.removeEventListener("sra:world-change", onWorldChange);
    instance.destroy();
    stage.removeAttribute("data-micro-slats-active");
    stage.removeAttribute("data-micro-slats-ready");
    delete stage.dataset.microSlatsTone;
  };
}
