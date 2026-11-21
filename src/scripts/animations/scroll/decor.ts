import { gsap } from "../core/gsap";
import { isCalmMotion, onMotionChange } from "../core/motion";
import { qa } from "../core/utils";

/**
 * Decorative 8-bit props float on their own timelines. They are aria-hidden,
 * pointer-events:none, and stop when the reduced-motion contract is active.
 */
export function initDecor(): () => void {
  const sprites = qa<HTMLElement>("[data-decor]");
  if (sprites.length === 0) return () => undefined;

  let media: ReturnType<typeof gsap.matchMedia> | null = null;

  const build = (): void => {
    if (isCalmMotion()) {
      gsap.set(sprites, { clearProps: "transform" });
      return;
    }

    media = gsap.matchMedia();

    media.add("(min-width: 64rem)", () => {
      for (const sprite of sprites) {
        const amplitude = Number(sprite.dataset.decorAmplitude ?? "10");
        const duration = Number(sprite.dataset.decorDuration ?? "4.2");
        gsap.to(sprite, {
          y: -amplitude,
          rotation: Number(sprite.dataset.decorRotate ?? "1.5"),
          duration,
          ease: "steps(2)",
          yoyo: true,
          repeat: -1,
          delay: Number(sprite.dataset.decorDelay ?? "0"),
          scrollTrigger: {
            trigger: sprite,
            start: "top bottom",
            end: "bottom top",
            toggleActions: "play pause resume pause",
          },
        });
      }
    });

    media.add("(max-width: 63.99rem)", () => {
      for (const sprite of sprites) {
        const amplitude = Number(sprite.dataset.decorAmplitude ?? "10") * 0.6;
        const duration = Number(sprite.dataset.decorDuration ?? "4.2") * 1.2;
        gsap.to(sprite, {
          y: -amplitude,
          duration,
          ease: "steps(2)",
          yoyo: true,
          repeat: -1,
          delay: Number(sprite.dataset.decorDelay ?? "0"),
        });
      }
    });
  };

  build();

  const stopMotion = onMotionChange((mode) => {
    media?.revert();
    media = null;
    if (mode === "calm") gsap.set(sprites, { clearProps: "transform" });
    else build();
  });

  return () => {
    stopMotion();
    media?.revert();
    media = null;
    gsap.killTweensOf(sprites);
  };
}
