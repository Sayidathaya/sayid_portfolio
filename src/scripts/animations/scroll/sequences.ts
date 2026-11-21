import { createPixelSplit, gsap } from "../core/gsap";
import { qa } from "../core/utils";

/**
 * Shared scroll-choreography primitives.
 *
 * Every helper in this module creates tweens that live inside one scrubbed
 * timeline. Scroll progress is therefore the single source of truth: scrolling
 * down advances the timeline, scrolling up rewinds it, and stopping mid-scroll
 * leaves every element at the exact interpolated state.
 */

export type WipeDirection = "up" | "left" | false;

export interface SequenceOptions {
  /** Element whose position defines the scroll range. */
  trigger: Element;
  /** ScrollTrigger start, defaults to `"top 82%"`. */
  start?: string | (() => string);
  /** ScrollTrigger end, defaults to `"bottom 55%"`. */
  end?: string | (() => string);
  /**
   * Keep this `true` for direct scroll tracking. Numeric scrub values create a
   * second, time-based tween that keeps moving after the scroll input stops, so
   * they are intentionally not used anywhere in the portfolio.
   */
  scrub?: boolean;
  /** Extra timeline defaults. */
  defaults?: gsap.TweenVars;
}

export interface RevealOptions {
  /** Horizontal travel in pixels. */
  x?: number;
  /** Vertical travel in pixels. */
  y?: number;
  /** Initial scale offset from the resting scale of 1. */
  scale?: number;
  /** Extra rotation added to the resting rotation. */
  rotate?: number;
  /** Resting rotation, useful for tilted paper panels. */
  restRotate?: number | ((element: Element) => number);
  /** Pixel wipe direction. `false` disables clip-path animation. */
  wipe?: WipeDirection;
  duration?: number;
  stagger?: number;
  ease?: string;
  position?: gsap.Position;
  /** Only animate opacity (for elements owned by the ambient decor system). */
  fadeOnly?: boolean;
}

export interface ScaleSettleOptions {
  from?: number;
  duration?: number;
  stagger?: number;
  position?: gsap.Position;
}

const WIPE_FROM: Record<Exclude<WipeDirection, false>, string> = {
  up: "inset(0 0 100% 0)",
  left: "inset(0 100% 0 0)",
};

const MOTION_ATTR = "data-gsap-motion";
const REVEAL_ATTR = "data-reveal";
const INLINE_PROPS = [
  "opacity",
  "visibility",
  "transform",
  "transform-origin",
  "translate",
  "clip-path",
  "filter",
  "stroke-dasharray",
  "stroke-dashoffset",
  "will-change",
] as const;

const toElements = (
  target: Element | Element[] | NodeListOf<Element> | null | undefined,
): Element[] => {
  if (!target) return [];
  if (target instanceof Element) return [target];
  return Array.from(target);
};

/** Marks an element as GSAP-owned so calm mode and failure fallbacks can reset it. */
export function markMotion(elements: Iterable<Element>): void {
  for (const element of elements) element.setAttribute(MOTION_ATTR, "");
}

/** Marks the legacy CSS reveal state as satisfied while GSAP takes ownership. */
export function markRevealed(elements: Iterable<Element>): void {
  for (const element of elements) {
    element.setAttribute("data-inview", "");
    element.setAttribute(MOTION_ATTR, "");
  }
}

/** Removes only the inline properties GSAP writes; authored CSS variables stay intact. */
export function clearMotionStyles(elements: Iterable<Element>): void {
  for (const element of elements) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) continue;
    for (const property of INLINE_PROPS) element.style.removeProperty(property);
  }
}

/**
 * Restores the static, fully visible presentation. Used by calm mode and by the
 * boot-time failure fallback so no content can ever stay hidden behind a tween.
 */
export function showAllContent(scope: ParentNode = document): void {
  const revealables = qa<HTMLElement>(`[${REVEAL_ATTR}]`, scope);
  for (const element of revealables) element.setAttribute("data-inview", "");
  clearMotionStyles(qa<HTMLElement>(`[${REVEAL_ATTR}], [${MOTION_ATTR}]`, scope));
}

/**
 * One scrubbed timeline per section (or per scene). Keeping related elements in
 * a single timeline avoids a trigger per card while preserving sequential,
 * reversible progress.
 */
export function createSectionSequence({
  trigger,
  start = "top 82%",
  end = "bottom 55%",
  scrub = true,
  defaults,
}: SequenceOptions): gsap.core.Timeline {
  return gsap.timeline({
    defaults: { ease: "none", ...defaults },
    scrollTrigger: {
      trigger,
      start,
      end,
      scrub,
      invalidateOnRefresh: true,
    },
  });
}

/**
 * Adds a reversible reveal to a shared timeline. `fromTo` tweens are used so
 * the rendered state is deterministic at any scroll position, including after a
 * rapid jump or a refresh.
 */
export function addReveal(
  timeline: gsap.core.Timeline,
  targets: Element | Element[] | NodeListOf<Element> | null | undefined,
  options: RevealOptions = {},
): void {
  const elements = toElements(targets);
  if (elements.length === 0) return;

  markRevealed(elements);

  const {
    x = 0,
    y = 0,
    scale = 1,
    rotate = 0,
    restRotate = 0,
    wipe = false,
    duration = 0.7,
    stagger = 0.06,
    ease = "none",
    position = ">",
    fadeOnly = false,
  } = options;

  const from: gsap.TweenVars = { autoAlpha: 0 };
  const to: gsap.TweenVars = { autoAlpha: 1, duration, stagger, ease };

  if (!fadeOnly) {
    const restFor = (element: Element): number =>
      typeof restRotate === "function" ? restRotate(element) : restRotate;

    from.x = x;
    from.y = y;
    from.scale = scale;
    from.rotate = (_index: number, element: Element) => restFor(element) + rotate;
    to.x = 0;
    to.y = 0;
    to.scale = 1;
    to.rotate = (_index: number, element: Element) => restFor(element);
  }

  if (wipe) {
    from.clipPath = WIPE_FROM[wipe];
    to.clipPath = "inset(-2px)";
  }

  timeline.fromTo(elements, from, to, position);
}

/** Opacity-only reveal for elements whose transform is owned by ambient motion. */
export function addFade(
  timeline: gsap.core.Timeline,
  targets: Element | Element[] | NodeListOf<Element> | null | undefined,
  options: { duration?: number; stagger?: number; position?: gsap.Position } = {},
): void {
  addReveal(timeline, targets, {
    fadeOnly: true,
    duration: options.duration ?? 0.5,
    stagger: options.stagger ?? 0.06,
    position: options.position ?? ">",
  });
}

/**
 * Character-level heading reveal. SplitText owns the temporary markup; the
 * cached split is rebuilt automatically after a motion-contract revert.
 */
export function addTextChars(
  timeline: gsap.core.Timeline,
  scope: ParentNode,
  selector: string,
  options: Omit<RevealOptions, "fadeOnly" | "wipe"> = {},
): void {
  const split = createPixelSplit(scope, selector, {
    /* Word wrappers keep line breaks between words when the heading wraps on
       narrow screens; splitting chars alone lets the browser break inside a
       word ("EXPERIENC / E JOURNEY"), which reads as a layout bug. */
    type: "words,chars",
    charsClass: "cine-char",
  });
  if (!split || split.chars.length === 0) return;

  addReveal(timeline, split.chars, {
    y: 16,
    rotate: 1.5,
    duration: 0.5,
    stagger: 0.018,
    ...options,
  });
}

/**
 * A slow photographic push-in. The element stays visible and settles from a
 * slightly oversized frame as the section scrolls through the viewport.
 */
export function addScaleSettle(
  timeline: gsap.core.Timeline,
  targets: Element | Element[] | NodeListOf<Element> | null | undefined,
  options: ScaleSettleOptions = {},
): void {
  const elements = toElements(targets);
  if (elements.length === 0) return;
  markMotion(elements);

  timeline.fromTo(
    elements,
    { scale: options.from ?? 1.06, transformOrigin: "50% 50%" },
    {
      scale: 1,
      duration: options.duration ?? 0.9,
      stagger: options.stagger ?? 0.04,
      ease: "none",
    },
    options.position ?? ">",
  );
}

/**
 * Adds a tween that spans the whole timeline. Used for scene parallax so it
 * shares the section trigger instead of creating a second ScrollTrigger.
 */
export function addFullSpan(
  timeline: gsap.core.Timeline,
  targets: Element | Element[] | NodeListOf<Element> | null | undefined,
  from: gsap.TweenVars,
  to: gsap.TweenVars,
): void {
  const elements = toElements(targets);
  if (elements.length === 0) return;
  markMotion(elements);

  const duration = Math.max(timeline.duration(), 0.001);
  timeline.fromTo(elements, from, { ...to, duration, ease: "none" }, 0);
}

/** Convenience for elements that only need the motion marker. */
export function markSequenceTargets(
  targets: Element | Element[] | NodeListOf<Element> | null | undefined,
): Element[] {
  const elements = toElements(targets);
  markMotion(elements);
  return elements;
}
