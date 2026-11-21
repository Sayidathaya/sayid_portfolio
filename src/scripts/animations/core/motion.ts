export type MotionMode = "full" | "calm";

export const MOTION_CHANGE_EVENT = "sra:motion-change";

const motionQuery = (): MediaQueryList => window.matchMedia("(prefers-reduced-motion: reduce)");

/** Reads the site motion contract first, then the OS preference as a fallback. */
export function getMotionMode(): MotionMode {
  const contract = document.documentElement.dataset.motion;
  if (contract === "calm") return "calm";
  if (contract === "full") return "full";
  return motionQuery().matches ? "calm" : "full";
}

export function isCalmMotion(): boolean {
  return getMotionMode() === "calm";
}

/** Called by the existing motion control so GSAP can react without polling. */
export function announceMotion(mode: MotionMode): void {
  document.dispatchEvent(
    new CustomEvent<{ mode: MotionMode }>(MOTION_CHANGE_EVENT, { detail: { mode } }),
  );
}

export function onMotionChange(handler: (mode: MotionMode) => void): () => void {
  const onContract = (event: Event): void => {
    if (event instanceof CustomEvent) {
      const detail = event.detail as { mode?: MotionMode } | null;
      if (detail?.mode) handler(detail.mode);
    }
  };

  const onSystem = (): void => {
    const stored = (() => {
      try {
        return localStorage.getItem("motion");
      } catch {
        return null;
      }
    })();
    if (stored === "full" || stored === "calm") return;
    handler(motionQuery().matches ? "calm" : "full");
  };

  const query = motionQuery();
  document.addEventListener(MOTION_CHANGE_EVENT, onContract);
  query.addEventListener("change", onSystem);

  return () => {
    document.removeEventListener(MOTION_CHANGE_EVENT, onContract);
    query.removeEventListener("change", onSystem);
  };
}
