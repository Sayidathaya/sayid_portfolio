import { gsap } from "../core/gsap";
import { isCalmMotion } from "../core/motion";
import { q, qa } from "../core/utils";

type IntroPhase = "boot" | "title" | "ready" | "go" | "exit";

const PARTICLE_COLORS = ["#ff303f", "#ffd83d", "#2864ff", "#873bff", "#ffffff"];

/**
 * Arcade boot gate. The server renders the overlay immediately; this module
 * upgrades it with a GSAP timeline, particles, a glitch wipe and a safe exit.
 * A watchdog in the layout removes the gate if this module never arrives.
 */
export function initIntro(): (() => void) | null {
  const intro = q<HTMLElement>("[data-intro]");
  const ready = q<HTMLButtonElement>("[data-intro-ready]", intro ?? document);
  if (!intro || !ready) return null;

  intro.dataset.introEngine = "gsap";

  const root = document.documentElement;
  const reduced = isCalmMotion();

  // Reloads restore the previous scroll position; the gate must always open
  // on the landing stage, while explicit hash deep-links are preserved.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const jumpToLanding = (): void => {
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };
  jumpToLanding();

  const frame = q<HTMLElement>("[data-intro-frame]", intro);
  const bar = q<HTMLElement>("[data-intro-bar]", intro);
  const title = q<HTMLElement>(".intro-title", intro);
  const lines = qa<HTMLElement>(".intro-line", intro);
  const sprites = qa<HTMLElement>(".intro-sprite", intro);
  const glitch = q<HTMLElement>("[data-intro-glitch]", intro);
  const readyWrap = q<HTMLElement>("[data-intro-ready-wrap]", intro);
  const particleStage = q<HTMLElement>("[data-intro-particles]", intro);

  let phase: IntroPhase = "boot";
  let exiting = false;
  let finished = false;
  let particleLoop: gsap.core.Tween | null = null;

  const setPhase = (next: IntroPhase): void => {
    phase = next;
    intro.dataset.introPhase = next;
    if (next === "ready") {
      intro.setAttribute("aria-busy", "false");
      readyWrap?.removeAttribute("inert");
      ready.tabIndex = 0;
      ready.focus({ preventScroll: true });
    }
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    particleLoop?.kill();

    intro.remove();
    root.classList.remove("intro-lock");
    jumpToLanding();
    root.dataset.introDone = "true";
    document.dispatchEvent(new CustomEvent("sra:intro-complete"));

    const landingToggle = q<HTMLButtonElement>("[data-landing-toggle]");
    landingToggle?.focus({ preventScroll: true });
  };

  if (particleStage) {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 24; index += 1) {
      const particle = document.createElement("span");
      particle.className = "intro-particle";
      particle.style.left = `${gsap.utils.random(4, 96)}%`;
      particle.style.top = `${gsap.utils.random(8, 92)}%`;
      particle.style.setProperty("--s", `${Math.round(gsap.utils.random(2, 6))}px`);
      particle.style.background = PARTICLE_COLORS[index % PARTICLE_COLORS.length] ?? "#ffffff";
      fragment.append(particle);
    }
    particleStage.append(fragment);
  }

  const particles = qa<HTMLElement>(".intro-particle", intro);

  const context = gsap.context(() => {
    gsap.set(frame, {
      autoAlpha: reduced ? 1 : 0,
      y: reduced ? 0 : 18,
      scale: reduced ? 1 : 0.985,
    });
    gsap.set(lines, { autoAlpha: reduced ? 1 : 0, x: reduced ? 0 : -10 });
    gsap.set(title, { autoAlpha: 0, scale: reduced ? 1 : 1.08 });
    gsap.set(readyWrap, { autoAlpha: 0, y: reduced ? 0 : 10 });
    gsap.set(bar, { scaleX: 0, transformOrigin: "left center" });
    gsap.set(sprites, { autoAlpha: reduced ? 1 : 0, y: reduced ? 0 : 14 });
    gsap.set(glitch, { autoAlpha: 0 });
    gsap.set(particles, { autoAlpha: reduced ? 0.35 : 0 });

    if (!reduced && particles.length > 0) {
      particleLoop = gsap.to(particles, {
        y: () => -gsap.utils.random(24, 130),
        autoAlpha: () => gsap.utils.random(0.18, 0.9),
        duration: () => gsap.utils.random(1.1, 2.8),
        ease: "none",
        repeat: -1,
        delay: () => gsap.utils.random(0.1, 1.2),
      });
    }

    const boot = gsap.timeline({ defaults: { ease: "steps(6)" } });

    boot
      .to(frame, { autoAlpha: 1, y: 0, scale: 1, duration: reduced ? 0.04 : 0.38 })
      .to(
        lines,
        {
          autoAlpha: 1,
          x: 0,
          duration: reduced ? 0.03 : 0.16,
          stagger: reduced ? 0.005 : 0.26,
        },
        reduced ? 0.02 : 0.14,
      )
      .to(bar, { scaleX: 1, duration: reduced ? 0.05 : 1.85, ease: "steps(10)" }, 0.12)
      .to(sprites, { autoAlpha: 1, y: 0, duration: reduced ? 0.03 : 0.32, stagger: 0.08 }, 0.3)
      .add(() => setPhase("title"), reduced ? 0.12 : 1.65)
      .to(title, { autoAlpha: 1, scale: 1, duration: reduced ? 0.03 : 0.35 }, "<")
      .to(readyWrap, { autoAlpha: 1, y: 0, duration: reduced ? 0.03 : 0.24 }, "<0.18")
      .add(() => setPhase("ready"), reduced ? 0.16 : 2.15);

    if (!reduced) {
      gsap.to(sprites, {
        y: "+=6",
        duration: 2.6,
        ease: "steps(2)",
        yoyo: true,
        repeat: -1,
        stagger: 0.4,
      });
    }
  }, intro);

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Tab") {
      event.preventDefault();
      if (phase === "ready" && !exiting) ready.focus({ preventScroll: true });
      else intro.focus({ preventScroll: true });
      return;
    }
    if (
      (event.key === "Enter" || event.key === " ") &&
      phase === "ready" &&
      !exiting &&
      document.activeElement !== ready
    ) {
      event.preventDefault();
      ready.click();
    }
  };

  const startExit = (): void => {
    if (phase !== "ready" || exiting) return;
    exiting = true;
    ready.disabled = true;
    setPhase("go");

    const timeline = gsap.timeline({
      defaults: { ease: "steps(6)" },
      onComplete: finish,
    });

    if (reduced) {
      setPhase("exit");
      timeline.to(intro, { autoAlpha: 0, duration: 0.12 });
      return;
    }

    timeline
      .to(frame, { scale: 0.97, y: -5, duration: 0.12 }, 0)
      .to(glitch, { autoAlpha: 1, scale: 1.04, duration: 0.08 }, 0)
      .to(
        sprites,
        {
          x: () => gsap.utils.random(-34, 34),
          y: () => gsap.utils.random(-28, 28),
          autoAlpha: 0,
          duration: 0.32,
          stagger: 0.03,
        },
        0,
      )
      .to(
        particles,
        {
          y: () => -window.innerHeight * 0.55,
          autoAlpha: 0,
          duration: 0.5,
          stagger: 0.004,
        },
        0,
      )
      .to(glitch, { autoAlpha: 0, duration: 0.1 }, 0.18)
      .to(frame, { autoAlpha: 0, y: -18, scale: 0.96, duration: 0.25 }, 0.16)
      .add(() => setPhase("exit"), 0.16)
      .to(
        intro,
        {
          yPercent: -100,
          duration: 0.55,
          ease: "steps(8)",
        },
        0.14,
      )
      .to(intro, { autoAlpha: 0, duration: 0.1 }, 0.7);
  };

  ready.addEventListener("click", startExit);
  intro.addEventListener("keydown", onKeydown);
  intro.focus({ preventScroll: true });

  return () => {
    particleLoop?.kill();
    ready.removeEventListener("click", startExit);
    intro.removeEventListener("keydown", onKeydown);
    context.revert();
    if (!finished) root.classList.remove("intro-lock");
  };
}
