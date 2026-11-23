import { gsap } from "../core/gsap";
import { isCalmMotion, onMotionChange } from "../core/motion";
import { q } from "../core/utils";

/**
 * SRA PIXEL IDENTITY SCANNER.
 *
 * A precision-pointer portrait scanner: the pointer reveals a chromatic scan
 * band and applies a restrained perspective tilt. Touch and keyboard users get
 * the same second layer through an explicit SCAN / LOCK control, so no
 * information or state is hover-only.
 *
 * The module owns only `[data-scan-frame]` and two CSS variables. Scroll
 * reveals keep ownership of the surrounding panel, so the two systems never
 * write the same transform.
 */
export function initIdentityScanner(): (() => void) | null {
  const host = q<HTMLElement>("[data-identity-scanner]");
  if (!host) return null;

  const frame = q<HTMLElement>("[data-scan-frame]", host);
  const toggle = q<HTMLButtonElement>("[data-scan-toggle]", host);
  const label = q<HTMLElement>("[data-scan-label]", host);
  const readout = q<HTMLElement>("[data-scan-readout]", host);
  if (!frame || !toggle) return null;

  const finePointer = window.matchMedia("(pointer: fine)");
  let locked = false;
  let tiltX: ReturnType<typeof gsap.quickTo> | null = null;
  let tiltY: ReturnType<typeof gsap.quickTo> | null = null;

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

  const canTilt = (event: PointerEvent): boolean =>
    finePointer.matches && !isCalmMotion() && event.pointerType !== "touch";

  const setVars = (x: number, y: number): void => {
    host.style.setProperty("--scan-x", `${x.toFixed(1)}%`);
    host.style.setProperty("--scan-y", `${y.toFixed(1)}%`);
    host.style.setProperty("--scan-shift", `${((x - 50) * 0.34).toFixed(1)}px`);
  };

  const setLocked = (next: boolean): void => {
    locked = next;
    host.dataset.scan = next ? "locked" : "idle";
    toggle.setAttribute("aria-pressed", String(next));
    if (label) label.textContent = next ? "Lock profile" : "Scan profile";
    if (readout) readout.textContent = next ? "LOCKED · LAYER 02" : "IDLE · LAYER 01";
    if (!next && !finePointer.matches) setVars(50, 42);
  };

  const buildTilt = (): void => {
    tiltX = null;
    tiltY = null;
    if (!finePointer.matches || isCalmMotion()) {
      gsap.set(frame, { clearProps: "transform,transform-origin" });
      return;
    }
    gsap.set(frame, { transformPerspective: 900, transformOrigin: "50% 50%" });
    tiltX = gsap.quickTo(frame, "rotationX", { duration: 0.5, ease: "power2.out" });
    tiltY = gsap.quickTo(frame, "rotationY", { duration: 0.5, ease: "power2.out" });
  };

  const resetTilt = (): void => {
    tiltX?.(0);
    tiltY?.(0);
    setVars(50, 42);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!canTilt(event)) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    setVars(px * 100, py * 100);
    tiltY?.(px * 5 - 2.5);
    tiltX?.(2.5 - py * 5);
  };

  const onPointerLeave = (): void => resetTilt();

  const onToggle = (): void => setLocked(!locked);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && locked) {
      event.stopPropagation();
      setLocked(false);
    }
  };

  buildTilt();
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerleave", onPointerLeave);
  toggle.addEventListener("click", onToggle);
  host.addEventListener("keydown", onKeyDown);

  const onPointerCapability = (): void => buildTilt();
  finePointer.addEventListener("change", onPointerCapability);

  const stopMotion = onMotionChange((mode) => {
    if (mode === "calm") {
      locked = false;
      host.removeAttribute("data-scan");
      host.dataset.scan = "idle";
      toggle.setAttribute("aria-pressed", "false");
      if (label) label.textContent = "Scan profile";
      if (readout) readout.textContent = "IDLE · LAYER 01";
    }
    buildTilt();
  });

  return () => {
    stopMotion();
    finePointer.removeEventListener("change", onPointerCapability);
    host.removeEventListener("pointermove", onPointerMove);
    host.removeEventListener("pointerleave", onPointerLeave);
    toggle.removeEventListener("click", onToggle);
    host.removeEventListener("keydown", onKeyDown);
    gsap.killTweensOf(frame);
    frame.style.removeProperty("transform");
    frame.style.removeProperty("transform-origin");
    frame.style.removeProperty("perspective");
  };
}
