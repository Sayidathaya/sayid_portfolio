import { gsap } from "../core/gsap";
import { isCalmMotion, onMotionChange } from "../core/motion";
import { q } from "../core/utils";

/**
 * Landing title screen controller.
 *
 * Ownership contract:
 *   - CSS positions the switch knob (`left`) in both states and at every width.
 *   - CSS owns the ambient scene, signal bars and state copy.
 *   - GSAP owns avatar + marquee opacity/transform and the avatar image wipe.
 *   - The marquee loop is the only infinite GSAP tween and it is created only
 *     when the engine is live (the CSS marquee animation is disabled then).
 *   - The engine marker is written last, so a half-built controller leaves the
 *     CSS fallback in charge instead of disabling it.
 */
export function initLanding(): (() => void) | null {
  const landing = q<HTMLElement>("[data-landing]");
  const toggle = q<HTMLButtonElement>("[data-landing-toggle]", landing ?? document);
  if (!landing || !toggle) return null;

  const label = q<HTMLElement>(".landing-toggle-label", toggle);
  const hint = q<HTMLElement>(".landing-toggle-hint", landing);
  const bg = q<HTMLElement>("[data-landing-bg]", landing);
  const avatar = q<HTMLElement>("[data-landing-avatar]", landing);
  const avatarImg = q<HTMLElement>(".landing-avatar-img", landing);
  const marquee = q<HTMLElement>("[data-landing-marquee]", landing);
  const track = q<HTMLElement>("[data-landing-marquee-track]", landing);

  const breakpoint = { marqueeDuration: 32 };
  let active = false;
  let inView = document.visibilityState === "visible";
  let hoveringMarquee = false;

  const setState = (next: boolean): void => {
    active = next;
    landing.dataset.landingState = next ? "active" : "idle";
    toggle.setAttribute("aria-checked", String(next));
    if (label) label.textContent = next ? "ENTER" : "ENGAGE";
    if (hint) {
      hint.textContent = next
        ? "Console online. Operator link established."
        : "Activate the switch to go live.";
    }
    landing.toggleAttribute("data-landing-active", next);
  };

  const timeline = gsap.timeline({ paused: true, defaults: { ease: "steps(5)" } });

  if (bg) timeline.to(bg, { autoAlpha: 1, duration: 0.4 }, 0);
  if (avatar) timeline.to(avatar, { autoAlpha: 1, y: 0, scale: 1, duration: 0.48 }, 0.06);
  if (avatarImg) {
    timeline.to(
      avatarImg,
      {
        autoAlpha: 1,
        scale: 1,
        y: 0,
        clipPath: "inset(0 0 0 0)",
        duration: 0.58,
        ease: "power2.out",
      },
      0.1,
    );
  }
  if (marquee) timeline.to(marquee, { autoAlpha: 1, y: 0, duration: 0.42 }, 0.14);

  if (bg) gsap.set(bg, { autoAlpha: 0 });
  if (avatar) gsap.set(avatar, { autoAlpha: 0, y: 16, scale: 0.95 });
  if (avatarImg) {
    gsap.set(avatarImg, { autoAlpha: 0, scale: 0.94, y: 12, clipPath: "inset(0 0 100% 0)" });
  }
  if (marquee) gsap.set(marquee, { autoAlpha: 0, y: 12 });

  const loop = track
    ? gsap.to(track, {
        xPercent: -50,
        duration: breakpoint.marqueeDuration,
        ease: "none",
        repeat: -1,
        paused: true,
      })
    : null;

  const syncLoop = (): void => {
    if (!loop) return;
    if (active && inView && !hoveringMarquee && !isCalmMotion()) loop.play();
    else loop.pause();
  };

  const apply = (next: boolean, animate: boolean): void => {
    setState(next);
    if (animate && !isCalmMotion()) {
      if (next) timeline.play();
      else timeline.reverse();
    } else {
      timeline.progress(next ? 1 : 0);
    }
    syncLoop();
  };

  setState(false);

  const onClick = (): void => apply(!active, true);
  toggle.addEventListener("click", onClick);

  const onMarqueeEnter = (): void => {
    hoveringMarquee = true;
    syncLoop();
  };
  const onMarqueeLeave = (): void => {
    hoveringMarquee = false;
    syncLoop();
  };
  marquee?.addEventListener("pointerenter", onMarqueeEnter);
  marquee?.addEventListener("pointerleave", onMarqueeLeave);

  const onVisibility = (): void => {
    inView = document.visibilityState === "visible";
    syncLoop();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const observer =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
          (entries) => {
            inView = entries.some((entry) => entry.isIntersecting);
            syncLoop();
          },
          { threshold: 0.08 },
        );
  observer?.observe(landing);

  const mm = gsap.matchMedia();
  const setMarqueeDuration = (duration: number): void => {
    breakpoint.marqueeDuration = duration;
    loop?.duration(duration);
  };
  mm.add("(max-width: 47.99rem)", () => setMarqueeDuration(24));
  mm.add("(min-width: 48rem) and (max-width: 63.99rem)", () => setMarqueeDuration(28));
  mm.add("(min-width: 64rem)", () => setMarqueeDuration(32));

  const stopMotion = onMotionChange((mode) => {
    if (mode === "calm") {
      timeline.progress(active ? 1 : 0);
      loop?.pause();
    } else {
      syncLoop();
    }
  });

  /* All construction succeeded: hand the stage to this controller. */
  landing.dataset.landingEngine = "gsap";

  return () => {
    stopMotion();
    mm.revert();
    observer?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    marquee?.removeEventListener("pointerenter", onMarqueeEnter);
    marquee?.removeEventListener("pointerleave", onMarqueeLeave);
    toggle.removeEventListener("click", onClick);
    loop?.kill();
    timeline.kill();
    landing.removeAttribute("data-landing-engine");
    landing.removeAttribute("data-landing-active");
  };
}
