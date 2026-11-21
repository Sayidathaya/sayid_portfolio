import { gsap } from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);
}

export { gsap, ScrollSmoother, ScrollTrigger };
export { SplitText };

const splitCache = new WeakMap<HTMLElement, SplitText>();

/** Splits text into character lines for pixel-style scrub reveals. */
export function createPixelSplit(
  scope: ParentNode,
  selector: string,
  vars: SplitText.Vars,
): SplitText | null {
  const target = scope.querySelector<HTMLElement>(selector);
  if (!target) return null;
  const existing = splitCache.get(target);
  // A context revert can restore the original text while the cached SplitText
  // object survives; rebuild it instead of returning an empty split.
  if (existing?.chars.length && existing.chars[0]?.isConnected) return existing;
  if (existing) splitCache.delete(target);
  const split = SplitText.create(target, { ...vars, type: vars.type ?? "chars" });
  splitCache.set(target, split);
  return split;
}

/** Splits text into words/lines for scroll-driven color or reveal choreography. */
export function createPixelWordSplit(
  scope: ParentNode,
  selector: string,
  splitType: "words" | "lines" | "words, lines",
  vars: SplitText.Vars,
): SplitText | null {
  const target = scope.querySelector<HTMLElement>(selector);
  if (!target) return null;
  const existing = splitCache.get(target);
  if (existing?.chars.length && existing.chars[0]?.isConnected) return existing;
  if (existing) splitCache.delete(target);
  const split = SplitText.create(target, { ...vars, type: splitType });
  splitCache.set(target, split);
  return split;
}

export const PIXEL_EASE = "steps(5)";

export function refreshScroll(): void {
  ScrollTrigger.refresh();
}
