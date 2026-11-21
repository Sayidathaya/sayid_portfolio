import { gsap, type ScrollTrigger } from "../core/gsap";
import { isCalmMotion } from "../core/motion";

export interface ScrubOptions {
  /** ScrollTrigger start position, defaults to `"top top"`. */
  start?: string;
  /** ScrollTrigger end position, defaults to the end of the trigger range. */
  end?: string;
  /** Whether the tween should scrub with scroll. Defaults to `true`. */
  scrub?: boolean;
}

/**
 * Creates a scroll-bound GSAP tween. Downward scrolling progresses the
 * timeline, upward scrolling reverses it, and jumping back restores the state.
 */
export function createScrub<T extends Element>(
  target: T | T[],
  vars: gsap.TweenVars,
  trigger: Element,
  options: ScrubOptions = {},
): ScrollTrigger | null {
  if (isCalmMotion()) return null;
  const tween = gsap.to(target, {
    ...vars,
    ease: vars.ease ?? "none",
    scrollTrigger: {
      trigger,
      start: options.start ?? "top top",
      end: options.end,
      scrub: options.scrub ?? true,
    },
  });
  return tween.scrollTrigger ?? null;
}

/**
 * Creates a scroll parallax layer. The layer eases from its idle offset toward
 * (or away from) the scroll-driven value, so reverse scrolling undoes motion.
 */
export function createParallax<T extends Element>(
  target: T | T[],
  offset: number,
  trigger: Element,
  options: { start?: string; end?: string } = {},
): ScrollTrigger | null {
  if (isCalmMotion()) return null;
  const tween = gsap.fromTo(
    target,
    { y: 0 },
    {
      y: offset,
      ease: "none",
      scrollTrigger: {
        trigger,
        start: options.start ?? "top bottom",
        end: options.end ?? "bottom top",
        scrub: true,
        invalidateOnRefresh: true,
      },
    },
  );
  return tween.scrollTrigger ?? null;
}

/**
 * Collects elements for a staggered pixel reveal. Stagger is derived from the
 * `--d` custom property when present, then from the supplied per-element delay.
 */
export function staggerReveal(elements: Iterable<HTMLElement>, perElement = 0.05): number[] {
  const delays: number[] = [];
  for (const element of elements) {
    const fallback = perElement;
    const raw = element.style.getPropertyValue("--d").trim();
    const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
    const seconds = Number.isNaN(parsed) ? fallback : raw.endsWith("ms") ? parsed / 1000 : parsed;
    delays.push(seconds);
  }
  return delays;
}
