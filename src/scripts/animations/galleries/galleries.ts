import { gsap } from "../core/gsap";
import { isCalmMotion } from "../core/motion";
import { q, qa } from "../core/utils";

type Disposer = () => void;

/**
 * Gallery enhancements only. Native overflow, touch swiping, links, buttons
 * and the certificate modal stay untouched. There is deliberately no scroll
 * snap, so a gallery stops exactly where the user releases it. Desktop pointer
 * dragging is limited to the horizontal axis and never captures the page.
 */
export function initGalleries(): () => void {
  const disposers: Disposer[] = [];
  const zones = qa<HTMLElement>("[data-horizontal-zone]");

  for (const zone of zones) {
    const scroller = q<HTMLElement>("[data-horizontal-scroll]", zone);
    if (!scroller || scroller.dataset.galleryReady === "true") continue;
    scroller.dataset.galleryReady = "true";

    const indicator = q<HTMLElement>("[data-gallery-pos]", zone);
    const prev = q<HTMLButtonElement>("[data-gallery-prev]", zone);
    const next = q<HTMLButtonElement>("[data-gallery-next]", zone);

    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let moved = false;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("a, button, iframe")) return;

      dragging = true;
      moved = false;
      startX = event.clientX;
      startScroll = scroller.scrollLeft;
      scroller.classList.add("is-dragging");
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return;
      const delta = event.clientX - startX;
      if (Math.abs(delta) <= 4) return;
      moved = true;
      scroller.scrollLeft = startScroll - delta;
      event.preventDefault();
    };

    const onPointerUp = (): void => {
      if (!dragging) return;
      dragging = false;
      scroller.classList.remove("is-dragging");
    };

    const onClick = (event: MouseEvent): void => {
      if (!moved) return;
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    };

    const pulse = (): void => {
      if (!indicator || isCalmMotion()) return;
      gsap.fromTo(
        indicator,
        { scale: 1.18 },
        { scale: 1, duration: 0.3, ease: "steps(4)", overwrite: true },
      );
    };

    scroller.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    scroller.addEventListener("click", onClick, true);
    prev?.addEventListener("click", pulse);
    next?.addEventListener("click", pulse);

    disposers.push(() => {
      scroller.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      scroller.removeEventListener("click", onClick, true);
      prev?.removeEventListener("click", pulse);
      next?.removeEventListener("click", pulse);
      gsap.killTweensOf(indicator);
      scroller.classList.remove("is-dragging");
      scroller.removeAttribute("data-gallery-ready");
    });
  }

  return () => {
    for (const dispose of disposers) dispose();
  };
}
