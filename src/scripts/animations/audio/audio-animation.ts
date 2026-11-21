import { gsap } from "../core/gsap";
import { onMotionChange } from "../core/motion";
import { q, qa } from "../core/utils";

/**
 * Ambient deck motion. The controller owns playback state; this module only
 * decorates the panel and never changes the ON/OFF contract.
 */
export function initAudioAmbience(): () => void {
  const deck = q<HTMLElement>("[data-audio-deck]");
  if (!deck) return () => undefined;

  const eq = q<HTMLElement>("[data-audio-eq]", deck);
  const bars = qa<HTMLElement>("i", eq ?? deck);
  let loop: gsap.core.Timeline | null = null;
  let introTween: gsap.core.Tween | null = null;

  const buildLoop = (): void => {
    loop?.kill();
    if (bars.length === 0) return;
    loop = gsap.timeline({ paused: true, repeat: -1, defaults: { ease: "steps(4)" } });
    loop.to(bars, {
      scaleY: () => gsap.utils.random(0.25, 1),
      opacity: () => gsap.utils.random(0.55, 1),
      duration: 0.32,
      stagger: { each: 0.06, from: "random" },
      yoyo: true,
      repeat: 1,
    });
  };

  const sync = (): void => {
    const playing = deck.dataset.audioPlaying === "true";
    if (playing) {
      loop?.play();
    } else {
      loop?.pause();
      gsap.to(bars, {
        scaleY: 0.18,
        opacity: 0.35,
        duration: 0.2,
        ease: "steps(3)",
        overwrite: true,
      });
    }
  };

  const applyMotion = (calm: boolean): void => {
    if (calm) {
      loop?.pause();
      gsap.set(bars, { scaleY: 0.2, opacity: 0.4 });
    } else {
      sync();
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(deck, { attributes: true, attributeFilter: ["data-audio-playing"] });

  const onIntro = (): void => {
    introTween?.kill();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    introTween = gsap.from(deck, {
      opacity: 0,
      y: 18,
      duration: 0.5,
      ease: "steps(5)",
      delay: 0.2,
      clearProps: "opacity,transform",
    });
  };

  buildLoop();
  sync();
  document.addEventListener("sra:intro-complete", onIntro, { once: true });
  const stopMotion = onMotionChange((mode) => applyMotion(mode === "calm"));

  return () => {
    observer.disconnect();
    stopMotion();
    document.removeEventListener("sra:intro-complete", onIntro);
    loop?.kill();
    introTween?.kill();
  };
}

export function initAudioDeckMotion(): () => void {
  const cleanup: Array<() => void> = [];
  const ambience = initAudioAmbience();
  cleanup.push(ambience);

  /* The deck is fixed outside the smooth content, so its entrance never changes
     the scroll height. No refresh is needed here. */
  return () => {
    for (const dispose of cleanup) dispose();
  };
}
