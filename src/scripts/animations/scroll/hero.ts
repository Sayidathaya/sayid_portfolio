import { gsap, ScrollTrigger } from "../core/gsap";
import { isCalmMotion, onMotionChange } from "../core/motion";
import { getHudOffset } from "../core/smoother";
import { q } from "../core/utils";
import { clearMotionStyles, createSectionSequence, markMotion } from "./sequences";

type Disposer = () => void;

/**
 * Hero camera move, adapted from Spylt's scroll-controlled opening.
 *
 * Transform ownership is deliberately split by wrapper:
 *   - `.hero-shell`  → camera rotation / scale
 *   - `.hero-world`  → background depth
 *   - `.hero-copy`   → foreground copy depth
 *   - `.hero-visual` → monitor / record depth
 *
 * The READY entrance (sections.ts) animates the children of these wrappers,
 * never the wrappers themselves, so the two systems never write the same
 * transform. The previous implementation parallaxed `.hero-monitor` while the
 * entrance also wrote its `y`, which caused the visible hand-off glitch.
 */
export function initHeroCinematic(): Disposer | null {
  const hero = q<HTMLElement>(".hero");
  if (!hero) return null;

  let context: gsap.Context | null = null;
  let media: ReturnType<typeof gsap.matchMedia> | null = null;

  const world = q<HTMLElement>(".hero-world", hero);
  const shell = q<HTMLElement>(".hero-shell", hero);
  const copy = q<HTMLElement>(".hero-copy", hero);
  const visual = q<HTMLElement>(".hero-visual", hero);
  const ticker = q<HTMLElement>(".ticker", hero);
  const targets = [world, shell, copy, visual, ticker].filter(Boolean) as Element[];
  markMotion(targets);

  const clean = (): void => {
    media?.revert();
    media = null;
    context?.revert();
    context = null;
  };

  const build = (): void => {
    if (isCalmMotion()) return;
    if (ScrollTrigger.isTouch === 1) {
      /* The scroll-driven camera is a precision-pointer cinematic: it pushes
         the hero world, copy, monitor and ticker while the reader scrolls.
         Touch devices keep the authored title-screen presentation instead, so
         native touch scrolling never drags or fades the hero copy mid-read. */
      clearMotionStyles([world, shell, copy, visual, ticker].filter(Boolean) as Element[]);
      return;
    }

    context = gsap.context(() => {
      const makeTimeline = (distance: {
        worldY: number;
        worldScale: number;
        shellRotate: number;
        shellScale: number;
        copyY: number;
        copyAlpha: number;
        visualY: number;
        visualScale: number;
        visualAlpha: number;
        tickerY: number;
        tickerAlpha: number;
      }): void => {
        const timeline = createSectionSequence({
          trigger: hero,
          start: () => `top ${Math.round(getHudOffset())}px`,
          end: "bottom top",
        });

        if (world) {
          timeline.fromTo(
            world,
            { yPercent: 0, scale: 1 },
            {
              yPercent: distance.worldY,
              scale: distance.worldScale,
              duration: 1,
              ease: "none",
            },
            0,
          );
        }

        if (shell) {
          timeline.fromTo(
            shell,
            { rotate: 0, scale: 1, yPercent: 0 },
            {
              rotate: distance.shellRotate,
              scale: distance.shellScale,
              yPercent: 3,
              duration: 1,
              ease: "none",
            },
            0,
          );
        }

        if (copy) {
          timeline.fromTo(
            copy,
            { yPercent: 0, autoAlpha: 1 },
            {
              yPercent: distance.copyY,
              autoAlpha: distance.copyAlpha,
              duration: 1,
              ease: "none",
            },
            0,
          );
        }

        if (visual) {
          timeline.fromTo(
            visual,
            { yPercent: 0, scale: 1, autoAlpha: 1 },
            {
              yPercent: distance.visualY,
              scale: distance.visualScale,
              autoAlpha: distance.visualAlpha,
              duration: 1,
              ease: "none",
            },
            0,
          );
        }

        if (ticker) {
          timeline.fromTo(
            ticker,
            { yPercent: 0, autoAlpha: 1 },
            {
              yPercent: distance.tickerY,
              autoAlpha: distance.tickerAlpha,
              duration: 1,
              ease: "none",
            },
            0,
          );
        }
      };

      media = gsap.matchMedia();

      media.add("(min-width: 64rem)", () => {
        makeTimeline({
          worldY: 6,
          worldScale: 1.04,
          shellRotate: 0.6,
          shellScale: 0.982,
          copyY: -16,
          copyAlpha: 0.22,
          visualY: -10,
          visualScale: 0.96,
          visualAlpha: 0.45,
          tickerY: -34,
          tickerAlpha: 0.4,
        });
      });

      media.add("(max-width: 63.99rem)", () => {
        makeTimeline({
          worldY: 4,
          worldScale: 1.02,
          shellRotate: 0.25,
          shellScale: 0.992,
          copyY: -8,
          copyAlpha: 0.5,
          visualY: -4,
          visualScale: 0.985,
          visualAlpha: 0.75,
          tickerY: -18,
          tickerAlpha: 0.6,
        });
      });
    }, document.body);
  };

  build();

  /* Calm mode must also stop the camera. Without this listener the hero kept
     fading and scaling under reduced motion when the toggle was used after
     boot, and never started when the page booted calm. */
  const stopMotion = onMotionChange((mode) => {
    clean();
    if (mode === "full") build();
  });

  return () => {
    stopMotion();
    clean();
  };
}
