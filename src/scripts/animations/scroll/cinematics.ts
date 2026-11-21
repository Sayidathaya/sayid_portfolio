import { gsap, ScrollTrigger } from "../core/gsap";
import { isCalmMotion, onMotionChange } from "../core/motion";
import { getHudOffset, registerScrollResolver } from "../core/smoother";
import { q, qa } from "../core/utils";
import { addReveal, markMotion, markRevealed } from "./sequences";

type Disposer = () => void;

/**
 * Structural set pieces that cannot live inside a section sequence:
 *
 *   - the pinned project reel (desktop) and its per-world content reveals
 *   - the pinned contact terminal and its scan sweep
 *   - the clip-path scene curtains between zones
 *   - the draw-on overlays for the career / skill routes
 *   - ScrollTrigger pin emulation for sidebars that use CSS sticky natively
 *
 * Every effect is built inside one context so the motion contract can tear it
 * down and restore the CSS/no-JS presentation. All of them are scrubbed, so
 * scrolling back up rewinds the exact same state.
 */
export function initSectionCinematics(): Disposer | null {
  const hasContent = q(
    ".scene-seam, #about, #experience, #skills, #projects, #certificates, #contact, .console, .dossier-side",
  );
  if (!hasContent) return null;

  let context: gsap.Context | null = null;
  let media: ReturnType<typeof gsap.matchMedia> | null = null;
  let drawClones: SVGPathElement[] = [];
  let curtains: HTMLElement[] = [];

  const removeDrawClones = (): void => {
    for (const clone of drawClones) clone.remove();
    drawClones = [];
  };

  const removeCurtains = (): void => {
    for (const curtain of curtains) curtain.remove();
    curtains = [];
  };

  const clean = (): void => {
    removeDrawClones();
    removeCurtains();
    media?.revert();
    media = null;
    context?.revert();
    context = null;
  };

  /**
   * All segments of one route share a single scrubbed timeline. A stroke-dash
   * clone draws over the static route, segment after segment, and rewinds when
   * the user scrolls back up.
   */
  const drawRoutes = (
    scope: HTMLElement,
    selector: string,
    trigger: Element,
    start: string,
    end: string,
  ): void => {
    const routes: Array<{ clone: SVGPathElement; length: number }> = [];

    for (const source of qa<SVGPathElement>(selector, scope)) {
      const length = source.getTotalLength();
      if (!Number.isFinite(length) || length < 1) continue;

      const clone = source.cloneNode(false) as SVGPathElement;
      clone.classList.add("cine-draw");
      source.after(clone);
      drawClones.push(clone);
      markMotion([clone]);
      routes.push({ clone, length });
    }

    if (routes.length === 0) return;

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger,
        start,
        end,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    routes.forEach(({ clone, length }, index) => {
      timeline.fromTo(
        clone,
        { strokeDasharray: length, strokeDashoffset: length },
        { strokeDashoffset: 0, ease: "none", duration: 1 },
        index * 0.8,
      );
    });
  };

  /** One fixed pixel curtain per seam, kept outside the smooth content. */
  const createCurtain = (seam: HTMLElement, label: HTMLElement | null): HTMLElement | null => {
    const host = q<HTMLElement>("[data-scene-curtains]");
    if (!host) return null;

    const tone =
      Array.from(seam.classList)
        .find((name) => name.startsWith("scene-seam--"))
        ?.replace("scene-seam--", "") ?? "archive";

    const curtain = document.createElement("span");
    curtain.className = `scene-curtain scene-curtain--${tone}`;
    if (label) {
      const copy = document.createElement("span");
      copy.className = "scene-curtain-label";
      copy.textContent = label.textContent?.trim() ?? "";
      curtain.append(copy);
    }
    host.append(curtain);
    curtains.push(curtain);
    return curtain;
  };

  const pinSticky = (
    elementSelector: string,
    containerSelector: string,
    breakpoint: string,
  ): void => {
    media?.add(breakpoint, () => {
      /* A native sticky element already works on touch/calm. The pin is only
         needed when the smoother's transformed content defeats CSS sticky. */
      if (document.documentElement.dataset.smooth !== "on") return;
      const element = document.querySelector<HTMLElement>(elementSelector);
      const container = element?.closest<HTMLElement>(containerSelector);
      if (!element || !container) return;

      /* CSS sticky is defeated by the smoother's transformed content. Mark the
         element only while the pin exists, so allowing native sticky again is
         automatic if the pin is torn down or fails to build. */
      element.setAttribute("data-sticky-pin", "");

      try {
        const trigger = ScrollTrigger.create({
          trigger: container,
          start: () => `top ${Math.round(getHudOffset())}px`,
          end: () => `bottom ${Math.round(getHudOffset() + element.offsetHeight)}px`,
          pin: element,
          pinSpacing: false,
          invalidateOnRefresh: true,
        });

        return () => {
          trigger.kill();
          element.removeAttribute("data-sticky-pin");
        };
      } catch (error) {
        element.removeAttribute("data-sticky-pin");
        throw error;
      }
    });
  };

  const build = (): void => {
    if (isCalmMotion()) return;

    context = gsap.context(() => {
      /* ---------- Responsive pins ----------------------------------------- */
      /* Pins are created first: every downstream ScrollTrigger must measure a
         layout that already contains the pin spacers, or its start stays stale. */
      media = gsap.matchMedia();

      /* Project reel: full-frame worlds travel sideways while the section is
         pinned below the fixed HUD. Each world is sized so that, after the fit
         scale is applied, the final stop lands on the last world with no
         residual sliver and no growing blank gutter on the right. */
      media.add("(min-width: 80rem)", () => {
        const projectsSection = document.getElementById("projects");
        const worlds = projectsSection ? q<HTMLElement>("[data-mv-worlds]", projectsSection) : null;
        const track = projectsSection
          ? q<HTMLElement>("[data-mv-worlds-track]", projectsSection)
          : null;
        if (!projectsSection || !worlds || !track) return;

        const worldList = qa<HTMLElement>(".world", track);
        if (worldList.length < 2) return;

        worlds.dataset.mvHorizontal = "true";

        /* The reel replaces the generic reveal for every world article. GSAP
           owns the inner content; the article itself stays as a visible shell. */
        markRevealed(worldList);
        markMotion([track]);

        const stops = qa<HTMLElement>(".mv-stop", projectsSection);
        const hud = q<HTMLElement>("[data-mv-reel-hud]", projectsSection);
        const hudCurrent = q<HTMLElement>("[data-mv-reel-current]", projectsSection);
        const hudTotal = q<HTMLElement>("[data-mv-reel-total]", projectsSection);
        const hudProgress = q<HTMLElement>("[data-mv-reel-progress]", projectsSection);
        const totalLabel = String(worldList.length).padStart(2, "0");
        if (hudTotal) hudTotal.textContent = totalLabel;

        /* Right-hand breathing room inside the pinned frame. */
        const RAIL_INSET = 28;
        let railScale = 1;

        /* Negative margins (feature panel) can put content below the article's
           own layout box, so measure the real bottom of every direct child. */
        const contentHeight = (world: HTMLElement): number => {
          let bottom = world.offsetHeight;
          for (const child of world.children) {
            if (!(child instanceof HTMLElement)) continue;
            bottom = Math.max(bottom, child.offsetTop + child.offsetHeight);
          }
          return bottom;
        };

        /* World width and fit scale depend on each other: a wider world makes
           its artwork taller, which lowers the scale, which allows more width.
           Four layout passes converge well inside a single frame budget. */
        const applyScale = (): void => {
          const targetWidth = Math.max(0, worlds.clientWidth - RAIL_INSET);
          if (targetWidth <= 0) return;

          let scale = railScale;
          for (let pass = 0; pass < 4; pass += 1) {
            worlds.style.setProperty("--mv-world-w", `${targetWidth / scale}px`);
            let tallest = 0;
            for (const world of worldList) tallest = Math.max(tallest, contentHeight(world));
            if (tallest <= 0) break;

            /* Leave room for the reel HUD above and a breathing edge below. */
            const available = worlds.clientHeight - 84;
            const next = Math.min(1, Math.max(0.55, available / tallest));
            const settled = Math.abs(next - scale) < 0.004;
            scale = next;
            if (settled) break;
          }

          railScale = scale;
          worlds.style.setProperty("--mv-world-w", `${targetWidth / scale}px`);
          gsap.set(track, { scale, transformOrigin: "left center" });
        };

        /* Derive travel from the real content rail (worlds + gaps), not the
           last card alone. `scrollWidth` can include a trailing fractional
           remnant, which leaves a wider blank gutter at the final stop;
           measuring the first/last world boxes gives the exact end edge. */
        const travel = (): number => {
          const targetWidth = Math.max(0, worlds.clientWidth - RAIL_INSET);
          if (targetWidth <= 0) return 0;
          const first = worldList[0];
          const last = worldList[worldList.length - 1];
          if (!first || !last) return 0;
          const railStart = first.offsetLeft;
          const railEnd = last.offsetLeft + last.offsetWidth;
          const railWidth = Math.max(0, railEnd - railStart);
          return Math.max(0, Math.ceil(railWidth * railScale - targetWidth));
        };

        let activeIndex = -1;
        const setActive = (index: number, progress: number): void => {
          if (hudProgress) hudProgress.style.transform = `scaleX(${progress.toFixed(4)})`;
          if (index === activeIndex) return;
          activeIndex = index;
          for (let i = 0; i < worldList.length; i += 1) {
            worldList[i]?.toggleAttribute("data-world-active", i === index);
          }
          for (let i = 0; i < stops.length; i += 1) {
            stops[i]?.toggleAttribute("data-current", i === index);
          }
          if (hudCurrent) hudCurrent.textContent = String(index + 1).padStart(2, "0");

          /* The background shader listens for this to tint the world palette.
             It fires on world changes only, never on every scroll tick. */
          const world = worldList[index];
          document.dispatchEvent(
            new CustomEvent("sra:world-change", {
              detail: {
                index: index + 1,
                total: worldList.length,
                id: world?.id ?? "",
                tone: world?.dataset.tone ?? "purple",
                title: world?.querySelector<HTMLElement>(".world-title")?.textContent?.trim() ?? "",
              },
            }),
          );
        };

        applyScale();
        setActive(0, 0);
        if (hud) hud.toggleAttribute("data-ready", true);

        /* One timeline owns the horizontal travel and every content reveal.
           Its duration is `worlds - 1`, so position `index` is the moment that
           world sits in the middle of the pinned frame. */
        const reelLength = worldList.length - 1;
        const reel = gsap.timeline({
          scrollTrigger: {
            trigger: worlds,
            start: () => `top ${Math.round(getHudOffset())}px`,
            end: () => `+=${travel()}`,
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            /* Re-measure and re-size before ScrollTrigger writes the new start,
               end and pin spacing. */
            onRefreshInit: applyScale,
            onUpdate: (self) => {
              const progress = Math.min(1, Math.max(0, self.progress));
              const raw = Math.round(progress * (worldList.length - 1));
              const index = Math.min(worldList.length - 1, Math.max(0, raw));
              setActive(index, progress);
            },
          },
        });

        const reelTrigger = reel.scrollTrigger;
        const disposeResolver = registerScrollResolver((id) => {
          if (!id.startsWith("world-") || !reelTrigger) return null;
          const target = document.getElementById(id);
          const index = target ? worldList.indexOf(target as HTMLElement) : -1;
          if (index < 0) return null;
          const progress = index / (worldList.length - 1);
          return reelTrigger.start + (reelTrigger.end - reelTrigger.start) * progress + 1;
        });

        reel.to(
          track,
          { x: () => -travel(), ease: "none", duration: reelLength },
          0,
        );

        for (let index = 1; index < worldList.length; index += 1) {
          const world = worldList[index];
          if (!world) continue;
          /* Each world reveals as it slides in and completes just before the
             active-state switch at `index - 0.5`. */
          const start = Math.max(0, index - 1);
          addReveal(reel, q(".world-strap", world), {
            x: 14,
            duration: 0.2,
            position: start,
          });
          addReveal(reel, q(".world-visual", world), {
            y: 26,
            duration: 0.32,
            position: start + 0.05,
          });
          addReveal(reel, q(".world-panel", world), {
            y: 34,
            duration: 0.36,
            position: start + 0.12,
          });
          addReveal(reel, qa(".world-panel .px-btn, .world-panel .world-panel-links a", world), {
            y: 8,
            duration: 0.18,
            stagger: 0.04,
            position: start + 0.3,
          });
        }

        return () => {
          disposeResolver();
          for (const world of worldList) world.removeAttribute("data-world-active");
          for (const stop of stops) stop.removeAttribute("data-current");
          if (hud) hud.removeAttribute("data-ready");
          if (hudCurrent) hudCurrent.textContent = "01";
          if (hudProgress) hudProgress.style.removeProperty("transform");
          worlds.removeAttribute("data-mv-horizontal");
          worlds.style.removeProperty("--mv-world-w");
          gsap.set(track, { clearProps: "transform,transformOrigin" });
        };
      });

      /* Native sticky is disabled while the wrapper is transformed. Pin the
         sidebar contents through the same scroll range CSS sticky would cover.
         `pinSpacing:false` keeps the authored grid rhythm intact. */
      pinSticky(".cert-sidebar", ".cert-workbench", "(min-width: 64rem)");
      pinSticky(".dossier-side", ".dossier-body", "(min-width: 68rem)");

      /* Contact: no pin. Pinning the signal deck while the section timeline also
         wrote its transform left a residual `translateY(pinDistance)` after
         unpin, pushing the deck over the footer. The scan is a pure
         scroll-linked sweep on an un-pinned wrapper, so the deck keeps its
         natural dimensions and the footer starts exactly where the contact
         section ends. */
      const contact = document.getElementById("contact");
      const commsStage = contact ? q<HTMLElement>(".comms-stage", contact) : null;
      const commsScan = contact ? q<HTMLElement>(".comms-scan", contact) : null;
      if (contact && commsStage && commsScan) {
        markMotion([commsScan]);

        gsap.fromTo(
          commsScan,
          { yPercent: -140 },
          {
            yPercent: 560,
            ease: "none",
            scrollTrigger: {
              trigger: commsStage,
              start: "top 82%",
              end: "bottom 55%",
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );

        const rings = qa<HTMLElement>(".signal-rings i", contact);
        if (rings.length > 0) {
          markMotion(rings);
          gsap.fromTo(
            rings,
            { scale: 0.35, autoAlpha: 0 },
            {
              scale: 1.65,
              autoAlpha: 0.45,
              ease: "none",
              stagger: 0.14,
              scrollTrigger: {
                trigger: commsStage,
                start: "top 78%",
                end: "bottom 44%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          );
        }
      }

      /* ---------- Scene seams: fixed curtains between zones ---------------- */
      for (const seam of qa<HTMLElement>(".scene-seam")) {
        const label = q<HTMLElement>(".seam-label", seam);
        const curtain = createCurtain(seam, label);
        if (curtain) markMotion([curtain]);
        else markMotion(label ? [seam, label] : [seam]);

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: seam,
            start: "top 95%",
            end: "top 66%",
            scrub: true,
            invalidateOnRefresh: true,
          },
        });

        timeline.fromTo(
          seam,
          { clipPath: "inset(0 100% 0 0)" },
          { clipPath: "inset(0 0% 0 0)", ease: "none", duration: 1 },
          0,
        );

        if (curtain) {
          timeline
            .fromTo(
              curtain,
              { clipPath: "inset(0 100% 0 0)", autoAlpha: 0 },
              { clipPath: "inset(0 0% 0 0)", autoAlpha: 1, ease: "none", duration: 0.34 },
              0,
            )
            .to(
              curtain,
              { clipPath: "inset(0 0 0 100%)", autoAlpha: 0, ease: "none", duration: 0.34 },
              0.66,
            );
        }

        if (label) {
          timeline.fromTo(
            label,
            { autoAlpha: 0, x: -18 },
            { autoAlpha: 1, x: 0, ease: "none", duration: 0.6 },
            0.2,
          );
        }
      }

      /* ---------- Experience: route draw-on ------------------------------- */
      const experience = document.getElementById("experience");
      const questWorld = experience ? q<HTMLElement>(".quest-world", experience) : null;
      if (experience && questWorld) {
        drawRoutes(experience, ".quest-segment__line", questWorld, "top 78%", "bottom 34%");
      }

      /* ---------- Skills: route draw-on ----------------------------------- */
      const skills = document.getElementById("skills");
      const abilityStage = skills ? q<HTMLElement>(".ability-stage", skills) : null;
      if (skills && abilityStage) {
        drawRoutes(skills, ".ability-link__line", abilityStage, "top 80%", "bottom 36%");
      }

      /* ---------- Projects: constellation trace --------------------------- */
      const projects = document.getElementById("projects");
      const atlas = projects ? q<HTMLElement>(".mv-atlas", projects) : null;
      if (projects && atlas) {
        drawRoutes(projects, ".mv-constellation-line", atlas, "top 82%", "bottom 42%");
      }
    }, document.body);
  };

  build();

  const stopMotion = onMotionChange((mode) => {
    clean();
    if (mode === "full") build();
  });

  return () => {
    stopMotion();
    clean();
  };
}
