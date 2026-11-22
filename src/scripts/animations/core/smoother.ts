import { ScrollSmoother, ScrollTrigger } from "./gsap";
import { isCalmMotion, onMotionChange } from "./motion";

/**
 * One global ScrollSmoother lifecycle.
 *
 * Ownership contract:
 *   - every fixed viewport object (HUD, progress, FX, decks, overlays, curtains)
 *     lives outside `#smooth-content`;
 *   - a smoother exists only for full motion on devices with a precise pointer;
 *   - calm mode / touch-only devices keep native scrolling and CSS sticky;
 *   - all programmatic navigation goes through one resolver registry so pinned
 *     horizontal content can translate a fragment id into a scroll position.
 */

const HUD_SELECTOR = "[data-hud]";
const WRAPPER_SELECTOR = "#smooth-wrapper";
const CONTENT_SELECTOR = "#smooth-content";

export interface NavigateOptions {
  /** Defaults to true in full motion, false for a skip link. */
  smooth?: boolean;
  /** Push a same-page history entry. */
  history?: boolean;
  /** Move keyboard focus to the destination. */
  focus?: boolean;
}

type ScrollResolver = (id: string) => number | null;

const resolvers = new Set<ScrollResolver>();
const focusTargets = new WeakSet<HTMLElement>();

let smoother: ScrollSmoother | null = null;
let hudHeight = 86;
let refreshTimer = 0;
let resizeTimer = 0;
let popstateFrame = 0;
let hudObserver: ResizeObserver | null = null;
let navigationAttached = false;

/** Register a fragment resolver (for pinned/horizontal scenes). */
export function registerScrollResolver(resolver: ScrollResolver): () => void {
  resolvers.add(resolver);
  return () => resolvers.delete(resolver);
}

/** Measured height of the fixed HUD. Pins start directly below it. */
export function getHudOffset(): number {
  return hudHeight;
}

export function measureHudHeight(): number {
  const hud = document.querySelector<HTMLElement>(HUD_SELECTOR);
  if (!hud) return hudHeight;
  const next = Math.round(hud.getBoundingClientRect().height);
  if (next > 0 && next !== hudHeight) {
    hudHeight = next;
    document.documentElement.style.setProperty("--hud-height", `${next}px`);
  }
  return hudHeight;
}

export function getJourneyScrollTop(): number {
  return smoother ? smoother.scrollTop() : window.scrollY;
}

/** Maximum scroll distance of the visible journey (native or smoothed). */
export function getJourneyScrollMax(): number {
  const doc = document.scrollingElement ?? document.documentElement;
  return Math.max(0, doc.scrollHeight - window.innerHeight);
}

/**
 * Document offset based on untransformed layout boxes.
 *
 * Scroll choreography translates reveal targets while they enter the viewport.
 * Measuring `getBoundingClientRect()` at that moment includes the transient
 * translate, so a programmatic jump would aim too high and the target would
 * settle underneath the HUD once the reveal finished. Offset parents describe
 * the authored layout position and ignore those painted transforms.
 */
function layoutTop(target: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = target;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return top;
}

/**
 * Absolute journey offset of an element. When the smoother is live this uses
 * the instance's own layout resolver, so pinned spacers and transformed content
 * are measured in the same coordinate space the HUD reads.
 */
export function getJourneyTargetOffset(target: HTMLElement): number {
  if (smoother) {
    try {
      return smoother.offset(target, "top top");
    } catch {
      /* Fall through to the native layout measurement. */
    }
  }
  return layoutTop(target);
}

function smoothForWidth(): number {
  const width = window.innerWidth;
  if (width >= 1440) return 0.65;
  if (width >= 1200) return 0.58;
  if (width >= 1024) return 0.5;
  return 0.4;
}

function syncSmoothing(): void {
  if (!smoother) return;
  const next = smoothForWidth();
  /* `smooth()` is a setter on the live instance. Skip a write when the value
     already matches so a resize does not rebuild the catch-up tween. */
  if (Math.abs(smoother.smooth() - next) > 0.01) smoother.smooth(next);
}

let wrapperScrollGuard: (() => void) | null = null;

function createSmoother(): void {
  if (smoother || isCalmMotion() || ScrollTrigger.isTouch === 1) return;
  const wrapper = document.querySelector<HTMLElement>(WRAPPER_SELECTOR);
  const content = document.querySelector<HTMLElement>(CONTENT_SELECTOR);
  if (!wrapper || !content) return;

  try {
    smoother = ScrollSmoother.create({
      wrapper,
      content,
      smooth: smoothForWidth(),
      smoothTouch: 0,
      effects: false,
      normalizeScroll: false,
      ignoreMobileResize: true,
      /* The smoother moves the content on its own ticker, after the native
         scroll event has already fired. Let HUD/progress/scrollspy consumers
         re-read the settled transforms so they cannot remain one zone stale
         after a programmatic jump or the end of a wheel gesture. */
      onUpdate: () => {
        document.dispatchEvent(new CustomEvent("sra:smooth-update"));
      },
    });

    /* Native focus, text selection, or accidental scrollIntoView can cause
       the browser engine to scroll the fixed wrapper element directly. Keep
       the wrapper strictly pinned to (0, 0) so smooth transforms remain
       the sole owner of content placement. */
    const resetWrapperScroll = (): void => {
      if (wrapper.scrollTop !== 0) wrapper.scrollTop = 0;
      if (wrapper.scrollLeft !== 0) wrapper.scrollLeft = 0;
    };
    wrapper.addEventListener("scroll", resetWrapperScroll, { passive: true });
    wrapperScrollGuard = () => wrapper.removeEventListener("scroll", resetWrapperScroll);

    document.documentElement.dataset.smooth = "on";
    syncSmoothing();
  } catch (error) {
    console.error("[SRA smoother] create failed", error);
    smoother?.kill();
    smoother = null;
    delete document.documentElement.dataset.smooth;
  }
}

function killSmoother(): void {
  if (wrapperScrollGuard) {
    wrapperScrollGuard();
    wrapperScrollGuard = null;
  }
  if (!smoother) return;
  try {
    smoother.kill();
  } catch (error) {
    console.error("[SRA smoother] kill failed", error);
  }
  smoother = null;
  delete document.documentElement.dataset.smooth;
}

/**
 * App-level refresh entry point. Everything that changes layout schedules one
 * debounced refresh here instead of calling ScrollTrigger.refresh() directly.
 */
export function requestJourneyRefresh(delay = 80): void {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    refreshTimer = 0;
    measureHudHeight();
    ScrollTrigger.refresh();
    document.dispatchEvent(new CustomEvent("sra:journey-refresh"));
  }, delay);
}

/** One coordinated measurement after the whole journey has been built. */
export function settleJourney(): void {
  window.clearTimeout(refreshTimer);
  refreshTimer = 0;
  measureHudHeight();
  ScrollTrigger.refresh();
  document.dispatchEvent(new CustomEvent("sra:journey-refresh"));
}

function scrollToY(y: number, smooth: boolean): void {
  const doc = document.scrollingElement ?? document.documentElement;
  const max = Math.max(0, doc.scrollHeight - window.innerHeight);
  const top = Math.min(Math.max(0, y), max);
  if (smoother) {
    smoother.scrollTo(top, smooth);
    return;
  }
  window.scrollTo({ top, behavior: smooth ? "smooth" : "instant" });
}

function resolveFragment(id: string): number | null {
  for (const resolver of resolvers) {
    const value = resolver(id);
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}

function absoluteTop(target: HTMLElement): number {
  if (smoother) {
    try {
      return smoother.offset(target, "top top");
    } catch {
      /* Fallback to the native layout calculation below. */
    }
  }
  const rect = target.getBoundingClientRect();
  /* A hidden target has no layout box; keep the old rect fallback so fragment
     navigation still has a deterministic destination. */
  if (rect.width === 0 && rect.height === 0) {
    return rect.top + getJourneyScrollTop();
  }
  return layoutTop(target);
}

/** Keep a horizontally clipped gallery card visible when its anchor is used. */
function revealInGallery(target: HTMLElement, smooth: boolean): void {
  const scroller = target.closest<HTMLElement>("[data-horizontal-scroll]");
  if (!scroller) return;
  const targetRect = target.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const delta = targetRect.left - scrollerRect.left;
  const padding = 18;
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const left = Math.min(max, Math.max(0, scroller.scrollLeft + delta - padding));
  if (Math.abs(left - scroller.scrollLeft) < 2) return;
  scroller.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
}

function focusDestination(target: HTMLElement): void {
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    focusTargets.add(target);
  }
  target.focus({ preventScroll: true });
}

/** Scroll a document fragment into view through the active scroll owner. */
export function navigateToHash(hash: string, options: NavigateOptions = {}): boolean {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return false;

  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    /* Keep the raw id when the fragment is not valid percent-encoding. */
  }

  const target = document.getElementById(id);
  if (!target) return false;

  const smooth = options.smooth ?? !isCalmMotion();
  const resolved = id === "top" ? 0 : resolveFragment(id);
  const top = resolved ?? Math.max(0, absoluteTop(target) - getHudOffset() - 8);
  scrollToY(top, smooth && id !== "main");
  revealInGallery(target, smooth);
  if (options.history) history.pushState(null, "", `#${raw}`);
  if (options.focus) focusDestination(target);
  return true;
}

function onDocumentClick(event: MouseEvent): void {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return;
  }
  if (
    url.origin !== window.location.origin ||
    url.pathname !== window.location.pathname ||
    url.search !== window.location.search ||
    !url.hash ||
    url.hash === "#"
  ) {
    return;
  }

  const isSkip = anchor.classList.contains("skip-link");
  const navigated = navigateToHash(url.hash, {
    smooth: !isSkip,
    history: !isSkip,
    focus: isSkip,
  });
  if (!navigated) return;
  event.preventDefault();
}

function syncFromAddress(): void {
  window.cancelAnimationFrame(popstateFrame);
  /* One frame lets the browser finish its own fragment scroll before the
     smoother resolves pinned targets and restores the authored offset. */
  popstateFrame = window.requestAnimationFrame(() => {
    popstateFrame = 0;
    if (!window.location.hash) {
      /* The initial history entry has no fragment. Its native scroll position
         is not reliable inside the transformed smooth content, so restore the
         title screen explicitly when the user navigates back to it. */
      scrollToY(0, false);
      return;
    }
    navigateToHash(window.location.hash, {
      smooth: false,
      history: false,
      focus: false,
    });
  });
}

/** Restore a deep link once all cinematic measurements are in place. */
export function applyInitialHash(): void {
  if (!window.location.hash) return;
  const restore = (): void => {
    if (!window.location.hash) return;
    /* The scroll runs through the smoother, so let the frame in which the
       intro gate was released settle before resolving the deep link. An
       immediate scroll from inside the intro-complete handler can land before
       the smoothed content has rebuilt its scroll bounds. */
    window.requestAnimationFrame(() => {
      if (window.location.hash)
        navigateToHash(window.location.hash, { smooth: false, history: false, focus: false });
    });
  };
  /* The intro gate locks document overflow, so a scroll issued behind it is
     discarded. Defer the deep link until the gate has actually opened. */
  if (document.documentElement.classList.contains("intro-lock")) {
    document.addEventListener("sra:intro-complete", restore, { once: true });
    return;
  }
  restore();
}

function attachNavigation(): void {
  if (navigationAttached) return;
  navigationAttached = true;
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("popstate", syncFromAddress);
  window.addEventListener("hashchange", syncFromAddress);
  window.addEventListener("resize", onResize, { passive: true });
}

function detachNavigation(): void {
  if (!navigationAttached) return;
  navigationAttached = false;
  document.removeEventListener("click", onDocumentClick);
  window.removeEventListener("popstate", syncFromAddress);
  window.removeEventListener("hashchange", syncFromAddress);
  window.removeEventListener("resize", onResize);
}

function onResize(): void {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    resizeTimer = 0;
    syncSmoothing();
  }, 120);
}

function observeHud(): void {
  const hud = document.querySelector<HTMLElement>(HUD_SELECTOR);
  if (!hud || typeof ResizeObserver === "undefined") return;
  hudObserver?.disconnect();
  hudObserver = new ResizeObserver(() => {
    const before = hudHeight;
    measureHudHeight();
    if (hudHeight !== before) requestJourneyRefresh(120);
  });
  hudObserver.observe(hud);
}

export function initSmoothScroll(): () => void {
  measureHudHeight();
  observeHud();
  attachNavigation();

  const startMode = isCalmMotion() ? "calm" : "full";
  let currentMode = startMode;
  createSmoother();

  /* This listener is registered before the scroll modules so calm → full
     creates the scroller before their pins rebuild, and full → calm kills it
     before their pins are reverted. */
  const stopMotion = onMotionChange((mode) => {
    if (mode === currentMode) return;
    currentMode = mode;
    if (mode === "calm") killSmoother();
    else createSmoother();
  });

  return () => {
    stopMotion();
    detachNavigation();
    window.clearTimeout(refreshTimer);
    window.clearTimeout(resizeTimer);
    window.cancelAnimationFrame(popstateFrame);
    refreshTimer = 0;
    resizeTimer = 0;
    hudObserver?.disconnect();
    hudObserver = null;
    for (const target of Array.from(document.querySelectorAll<HTMLElement>("[tabindex='-1']"))) {
      if (focusTargets.has(target)) target.removeAttribute("tabindex");
    }
    killSmoother();
  };
}
