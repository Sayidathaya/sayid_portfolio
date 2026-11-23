import { initAudioDeckMotion } from "./audio/audio-animation";
import { initAudioDeck } from "./audio/audio-controller";
import { initMicroSlatsBackground } from "./background/micro-slats-controller";
import { applyInitialHash, initSmoothScroll, requestJourneyRefresh, settleJourney } from "./core/smoother";
import { initGalleries } from "./galleries/galleries";
import { initIdentityScanner } from "./identity/scanner";
import { initIntro } from "./intro/intro";
import { initSceneDirector } from "./journey/scene-director";
import { initLanding } from "./landing/landing";
import { initSectionCinematics } from "./scroll/cinematics";
import { initDecor } from "./scroll/decor";
import { initHeroCinematic } from "./scroll/hero";
import { showAllContent } from "./scroll/sequences";
import { initScrollSections } from "./scroll/sections";

type Disposer = () => void;

const root = document.documentElement;
root.dataset.gsap = "on";

const controllers: Disposer[] = [];

const announceFailure = (label: string, error: unknown): void => {
  console.error(`[SRA animations] ${label} failed`, error);
};

const attempt = (label: string, setup: () => Disposer | null): boolean => {
  try {
    const dispose = setup();
    if (dispose) controllers.push(dispose);
    return true;
  } catch (error) {
    announceFailure(label, error);
    /* A partially built controller may already have written hidden/offset
       inline styles. Restore the static presentation immediately. */
    showAllContent();
    return false;
  }
};

const releaseIntro = (): void => {
  const intro = document.querySelector<HTMLElement>("[data-intro]");
  if (!intro) return;
  intro.remove();
  root.classList.remove("intro-lock");
  root.dataset.introDone = "true";
  document.dispatchEvent(new CustomEvent("sra:intro-complete"));
  document.querySelector<HTMLButtonElement>("[data-landing-toggle]")?.focus({
    preventScroll: true,
  });
};

const start = (): void => {
  /* DOM → boot gate / landing → one smoother → cinematics → sections →
     galleries → measurements → one refresh → ready. The previous deferred
     idle/timeout gate let scrollable content stay unavailable long after the
     intro finished; every module now builds in this deterministic order. */
  const introReady = attempt("intro", initIntro);
  if (!introReady) releaseIntro();

  if (!attempt("landing", initLanding)) showAllContent();

  attempt("smoother", initSmoothScroll);

  /* Cinematics owns the pins, so it must build before the generic section
     triggers: those triggers need to measure the final pin-spacer layout. */
  attempt("section cinematics", initSectionCinematics);
  if (!attempt("sections", initScrollSections)) showAllContent();
  if (!attempt("galleries", initGalleries)) showAllContent();

  attempt("decor", initDecor);
  attempt("hero cinematic", initHeroCinematic);
  attempt("identity scanner", initIdentityScanner);
  attempt("scene director", initSceneDirector);
  attempt("audio deck", initAudioDeck);
  attempt("audio motion", initAudioDeckMotion);

  settleJourney();
  applyInitialHash();
  root.dataset.animations = "ready";

  /* WebGL shader compilation is the most expensive startup task; keep it off
     the boot gate entirely and let the background swell in after ENGAGE. */
  const buildBackground = (): void => {
    attempt("micro slats", initMicroSlatsBackground);
  };
  if (introReady) document.addEventListener("sra:intro-complete", buildBackground, { once: true });
  else buildBackground();

  /* Fonts and the load event only change pinned ranges once. Image dimensions
     are explicit, so decode never needs to gate the scroll experience. */
  const scheduleAssetRefresh = (): void => requestJourneyRefresh(160);
  window.addEventListener("load", scheduleAssetRefresh, { once: true });
  void document.fonts?.ready.then(scheduleAssetRefresh).catch(() => undefined);
  if (document.readyState === "complete") scheduleAssetRefresh();
};

/* A motion rebuild can change pin spacing after every controller has run;
   coalesce that into the same single refresh entry point. */
document.addEventListener("sra:motion-change", () => requestJourneyRefresh(60));

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}

window.addEventListener("pagehide", () => {
  for (const dispose of controllers.splice(0)) {
    try {
      dispose();
    } catch (error) {
      announceFailure("cleanup", error);
    }
  }
});
