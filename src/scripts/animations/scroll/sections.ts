import { gsap } from "../core/gsap";
import { isCalmMotion, onMotionChange } from "../core/motion";
import { q, qa } from "../core/utils";
import {
  addFade,
  addFullSpan,
  addReveal,
  addScaleSettle,
  addTextChars,
  clearMotionStyles,
  createSectionSequence,
  markMotion,
  markRevealed,
  showAllContent,
} from "./sequences";

type Disposer = () => void;

const tiltOf = (element: Element): number => {
  const raw = getComputedStyle(element).getPropertyValue("--tilt").trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
};

interface SweepOptions {
  /** Maximum opacity of the scanner while it crosses the host. */
  peak?: number;
  /** Start at the bottom edge and travel up instead of down. */
  reverse?: boolean;
}

/**
 * One scanner line per zone, driven by the zone's existing scrubbed timeline.
 * The element is decorative and aria-hidden; only a transform and opacity are
 * written, so it can never move or hide real content.
 */
const addSceneSweep = (
  timeline: gsap.core.Timeline,
  element: HTMLElement | null,
  host: HTMLElement | null,
  options: SweepOptions = {},
): void => {
  if (!element || !host) return;

  markMotion([element]);
  const total = Math.max(timeline.duration(), 0.001);
  const distance = (): number => Math.max(host.offsetHeight, 180);
  const { peak = 0.6, reverse = false } = options;

  timeline
    .fromTo(
      element,
      { y: reverse ? distance : -72, autoAlpha: 0 },
      {
        y: reverse ? -72 : distance,
        autoAlpha: peak,
        ease: "none",
        duration: total * 0.84,
      },
      0,
    )
    .to(element, { autoAlpha: 0, ease: "none", duration: total * 0.16 }, total * 0.84);
};

/** Photographic capture flash: a fast bloom that clears before the next card. */
const addSceneFlash = (
  timeline: gsap.core.Timeline,
  element: HTMLElement | null,
  peak = 0.72,
): void => {
  if (!element) return;

  markMotion([element]);
  const total = Math.max(timeline.duration(), 0.001);
  timeline
    .fromTo(
      element,
      { autoAlpha: 0 },
      { autoAlpha: peak, ease: "none", duration: total * 0.08 },
      0,
    )
    .to(element, { autoAlpha: 0, ease: "none", duration: total * 0.18 }, total * 0.08);
};

const revealHeading = (head: HTMLElement): void => {
  /* The CSS reveal hides the whole header. Hand the header itself to GSAP as a
     visible shell, then scrub its internal parts so the title never pops in. */
  markRevealed([head]);

  const timeline = createSectionSequence({
    trigger: head,
    start: "top 90%",
    end: "top 58%",
  });

  addReveal(timeline, q(".sec-id", head), {
    x: -18,
    wipe: "left",
    duration: 0.5,
  });
  addReveal(timeline, q(".sec-eyebrow", head), {
    y: 10,
    duration: 0.4,
    position: "<0.1",
  });
  addTextChars(timeline, head, ".sec-title", {
    y: 20,
    duration: 0.55,
    stagger: 0.022,
    position: "<0.08",
  });
  addReveal(timeline, q(".sec-note", head), {
    x: 14,
    duration: 0.45,
    position: "<0.12",
  });
};

const revealAbout = (): void => {
  const about = document.getElementById("about");
  if (!about) return;

  /* One timeline per major block. Related elements share it, but a block never
     stays hidden while another block far below is still waiting its turn. */
  const dialogue = q<HTMLElement>(".dialogue", about);
  if (dialogue) {
    const copyTimeline = createSectionSequence({
      trigger: dialogue,
      start: "top 88%",
      end: "top 42%",
    });

    addReveal(copyTimeline, dialogue, { y: 30, duration: 0.7 });
    addReveal(copyTimeline, qa(".dialogue-body p", about), {
      y: 12,
      duration: 0.5,
      stagger: 0.05,
      position: "<0.14",
    });
    addReveal(copyTimeline, q(".evidence-sheet", about), { y: 26, duration: 0.7 });
    addReveal(copyTimeline, qa(".evidence-list li", about), {
      x: -12,
      duration: 0.4,
      stagger: 0.045,
      position: "<0.12",
    });
    addFullSpan(copyTimeline, q(".zone-props", about), { y: 0 }, { y: -34 });
    /* Archive dossier: a single scan bar sweeps the full briefing panel. */
    addSceneSweep(copyTimeline, q(".dossier-scan", about), dialogue, { peak: 0.65 });
  }

  const visual = q(".about-col-visual", about);
  if (visual) {
    const visualTimeline = createSectionSequence({
      trigger: visual,
      start: "top 88%",
      end: "top 42%",
    });

    addReveal(visualTimeline, visual, {
      x: 26,
      rotate: 0.8,
      duration: 0.8,
    });
    addScaleSettle(visualTimeline, qa(".subject-photo", about), {
      from: 1.06,
      duration: 1,
      stagger: 0.05,
    });
    addReveal(visualTimeline, q(".zone-caption", about), {
      y: 6,
      wipe: "left",
      duration: 0.45,
    });
  }
};

const revealExperience = (): void => {
  const experience = document.getElementById("experience");
  if (!experience) return;

  const questShell = q<HTMLElement>(".quest-shell", experience);
  const questWorld = q(".quest-world", experience);

  if (questShell) {
    const mapTimeline = createSectionSequence({
      trigger: questShell,
      start: "top 88%",
      end: "top 42%",
    });

    addReveal(mapTimeline, questShell, { y: 34, scale: 0.992, duration: 0.8 });
    addReveal(
      mapTimeline,
      qa(".quest-hud__title, .quest-hud__legend, .quest-hud__count", experience),
      { y: 12, duration: 0.45, stagger: 0.06, position: "<0.2" },
    );
    addReveal(mapTimeline, questWorld, { y: 22, wipe: "up", duration: 0.75 });
    addReveal(mapTimeline, qa(".quest-world__hud > span, .quest-world__foot > span", experience), {
      y: 8,
      duration: 0.4,
      stagger: 0.05,
      position: "<0.15",
    });
    /* The wrapper owns the responsive map position (absolute on the desktop
       world, static in the mobile grid). Keep GSAP's reveal on an inner shell
       so a breakpoint change cannot leave the wrapper translated off-canvas. */
    addReveal(mapTimeline, qa(".quest-node-reveal", experience), {
      y: 18,
      scale: 0.88,
      duration: 0.5,
      stagger: 0.075,
      position: "<0.18",
    });
    addReveal(mapTimeline, q(".quest-shell__foot", experience), { y: 8, duration: 0.4 });

    if (questWorld) {
      addFullSpan(
        mapTimeline,
        q(".quest-world__sky", questWorld),
        { scale: 1.045, yPercent: -3 },
        { scale: 1.045, yPercent: 3 },
      );
    }
    addFullSpan(mapTimeline, q(".zone-props", experience), { y: 0 }, { y: -30 });
    /* Quest map: the scanner crosses the whole instrument, HUD included. */
    addSceneSweep(mapTimeline, q(".quest-sweep", experience), questShell, { peak: 0.5 });
  }

  const consoleBlock = q<HTMLElement>(".quest-console", experience);
  if (consoleBlock) {
    const consoleTimeline = createSectionSequence({
      trigger: consoleBlock,
      start: "top 88%",
      end: "top 42%",
    });

    addReveal(consoleTimeline, consoleBlock, { y: 30, duration: 0.8 });
    addReveal(consoleTimeline, qa(".quest-readout > *, .quest-route > *", experience), {
      y: 14,
      duration: 0.45,
      stagger: 0.06,
      position: "<0.14",
    });
    addReveal(consoleTimeline, qa(".quest-route li", experience), {
      x: 14,
      duration: 0.4,
      stagger: 0.045,
      position: "<0.1",
    });
  }
};

const revealSkills = (): void => {
  const skills = document.getElementById("skills");
  if (!skills) return;

  const board = q<HTMLElement>(".ability-board", skills);
  const stage = q(".ability-stage", skills);

  if (board) {
    const boardTimeline = createSectionSequence({
      trigger: board,
      start: "top 88%",
      end: "top 42%",
    });

    addReveal(boardTimeline, board, { y: 32, scale: 0.992, duration: 0.8 });
    addReveal(
      boardTimeline,
      qa(".ability-hud__title, .ability-hud__legend, .ability-hud__count", skills),
      { y: 12, duration: 0.45, stagger: 0.055, position: "<0.2" },
    );
    addReveal(boardTimeline, stage, { y: 24, wipe: "up", duration: 0.75 });
    addFade(boardTimeline, q(".ability-core", skills), { duration: 0.55 });
    addReveal(boardTimeline, q(".ability-core__ring", skills), {
      scale: 0.5,
      duration: 0.6,
      position: "<0.05",
    });
    addReveal(boardTimeline, qa(".ability-zone", skills), {
      x: 10,
      duration: 0.45,
      stagger: 0.05,
      position: "<0.1",
    });
    addReveal(boardTimeline, qa(".ability-nodes li", skills), {
      y: 16,
      scale: 0.84,
      duration: 0.45,
      stagger: 0.035,
      position: "<0.12",
    });
    addReveal(boardTimeline, q(".ability-board__foot", skills), { y: 8, duration: 0.4 });
    addFullSpan(boardTimeline, q(".zone-props", skills), { y: 0 }, { y: -30 });
    /* Ability tree: the charge travels upward into the core, opposite the
       archive and quest scanners, so the inventory zone reads differently. */
    addSceneSweep(boardTimeline, q(".ability-charge", skills), board, {
      peak: 0.7,
      reverse: true,
    });
  }

  const consoleBlock = q<HTMLElement>(".ability-console", skills);
  if (consoleBlock) {
    const consoleTimeline = createSectionSequence({
      trigger: consoleBlock,
      start: "top 88%",
      end: "top 42%",
    });

    addReveal(consoleTimeline, consoleBlock, { y: 30, duration: 0.8 });
    addReveal(consoleTimeline, qa(".ability-readout > *, .ability-readout__main > *", skills), {
      y: 14,
      duration: 0.45,
      stagger: 0.055,
      position: "<0.14",
    });
    addReveal(consoleTimeline, qa(".ability-index__group", skills), {
      x: 12,
      duration: 0.4,
      stagger: 0.045,
      position: "<0.1",
    });
  }

  /*
   * The touch module view sits above the console in the stacked layout
   * (<= 59.99rem). Chaining it to the console trigger left the modules fully
   * visible but at opacity 0 until the console scrolled four hundred pixels
   * further, which read as a large blank panel. Give it its own trigger.
   */
  const modules = q<HTMLElement>(".ability-modules", skills);
  if (modules && getComputedStyle(modules).display !== "none") {
    const modulesTimeline = createSectionSequence({
      trigger: modules,
      start: "top 92%",
      end: "top 60%",
    });
    addReveal(modulesTimeline, modules, { y: 24, duration: 0.7 });
  }
};

const revealProjects = (media: ReturnType<typeof gsap.matchMedia> | null): void => {
  const projects = document.getElementById("projects");
  if (!projects) return;

  const head = q<HTMLElement>(".mv-head", projects);
  if (head) {
    markRevealed([head]);
    const headTimeline = createSectionSequence({
      trigger: head,
      start: "top 88%",
      end: "top 54%",
    });

    addReveal(headTimeline, q(".mv-head-id", head), { x: -18, wipe: "left", duration: 0.5 });
    addReveal(headTimeline, q(".mv-eyebrow", head), { y: 8, duration: 0.4, position: "<0.1" });
    addTextChars(headTimeline, head, ".mv-title-top", {
      y: 22,
      duration: 0.6,
      stagger: 0.022,
      position: "<0.06",
    });
    addTextChars(headTimeline, head, ".mv-title-bottom", {
      y: 22,
      duration: 0.6,
      stagger: 0.022,
      position: "<0.06",
    });
    addReveal(headTimeline, qa(".mv-head-lede, .mv-head-note", head), {
      y: 10,
      duration: 0.45,
      stagger: 0.06,
      position: "<0.12",
    });
  }

  const atlas = q<HTMLElement>(".mv-atlas", projects);
  if (atlas) {
    markRevealed([atlas]);
    /* The atlas is a tall, readable panel. Completing its reveal while the
       panel top is still entering the upper-middle of the viewport keeps every
       paragraph legible after a direct #projects jump; the old `bottom 58%`
       end left the whole panel at ~33% opacity until the reader scrolled much
       further. The end edge sits above the HUD-adjusted landing position, so a
       fragment jump that parks the panel top in the upper third is instantly
       fully revealed instead of catching the panel mid-wipe. */
    const atlasTimeline = createSectionSequence({
      trigger: atlas,
      start: "top 92%",
      end: "top 62%",
    });

    addReveal(atlasTimeline, atlas, { y: 28, scale: 0.994, duration: 0.7 });
    addReveal(atlasTimeline, qa(".mv-atlas-bar > span, .mv-atlas-foot > span", atlas), {
      y: 8,
      wipe: "left",
      duration: 0.45,
      stagger: 0.06,
      position: "<0.18",
    });
    addReveal(
      atlasTimeline,
      qa(
        ".mv-brief-kicker, .mv-thesis, .mv-brief-copy, .mv-jump, .mv-legend",
        atlas,
      ),
      { y: 14, duration: 0.5, stagger: 0.07, position: "<0.12" },
    );
    addReveal(atlasTimeline, qa(".mv-route-heading, .mv-constellation", atlas), {
      x: 12,
      duration: 0.45,
      stagger: 0.05,
      position: "<0.12",
    });
    addReveal(atlasTimeline, qa(".mv-stop", atlas), {
      y: 16,
      duration: 0.45,
      stagger: 0.06,
      position: "<0.1",
    });
  }

  /* The world choreography is breakpoint-scoped on purpose. Building it once
     outside matchMedia left the vertical reveal transforms/opacity alive after
     crossing into the horizontal reel, which made every `.world` invisible
     inside the pinned frame. matchMedia now reverts one mode completely before
     the other is built. */
  media?.add("(min-width: 80rem)", () => {
    const worldsHost = q<HTMLElement>("[data-mv-worlds]", projects);
    const worlds = qa<HTMLElement>("[data-world]", projects);
    if (!worldsHost || worlds.length === 0) return;

    /* The reel owns the world choreography (Cinematics builds before this
       module). Clear the CSS reveal shell so only the reel timeline writes
       transforms inside each world. */
    markRevealed(worlds);

    const first = worlds[0];
    if (!first) return;
    const preReel = createSectionSequence({
      trigger: worldsHost,
      start: "top 94%",
      end: "top top",
    });
    addReveal(preReel, q(".world-strap", first), { x: 14, duration: 0.4 });
    addReveal(preReel, q(".world-visual", first), { y: 26, duration: 0.7 });
    addReveal(preReel, q(".world-panel", first), { y: 34, duration: 0.7 });
  });

  media?.add("(max-width: 79.999rem)", () => {
    const worlds = qa<HTMLElement>("[data-world]", projects);
    for (const world of worlds) {
      const timeline = createSectionSequence({
        trigger: world,
        start: "top 88%",
        end: "top 38%",
      });
      addReveal(timeline, world, { y: 40, scale: 0.988, rotate: 0.35, duration: 0.8 });
      addReveal(timeline, q(".world-panel", world), { y: 24, duration: 0.7 });
      addReveal(timeline, q(".world-strap", world), { x: 14, duration: 0.4, position: "<0.1" });
    }
  });
};

const revealCertificates = (): void => {
  const certificates = document.getElementById("certificates");
  if (!certificates) return;

  /* The certificate workbench is very tall. Each group is a scene of its own,
     so a group header or card row can never wait behind a later group. */
  const index = q<HTMLElement>(".cert-index", certificates);
  if (index) {
    const indexTimeline = createSectionSequence({
      trigger: index,
      start: "top 88%",
      end: "top 42%",
    });
    addReveal(indexTimeline, index, { x: -24, y: 10, duration: 0.65 });
  }

  /* Vault scan: one long-range scanner crosses every archive group, because
     tying it to a single group would stop the vault's signature halfway. */
  const workbench = q<HTMLElement>(".cert-workbench", certificates);
  const vaultScan = q<HTMLElement>(".vault-scan", certificates);
  if (workbench && vaultScan) {
    markMotion([vaultScan]);
    gsap
      .timeline({
        scrollTrigger: {
          trigger: workbench,
          start: "top 88%",
          end: "bottom 34%",
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
      .fromTo(
        vaultScan,
        { y: -72, autoAlpha: 0 },
        {
          y: () => Math.max(workbench.offsetHeight, 180),
          autoAlpha: 0.55,
          duration: 0.84,
          ease: "none",
        },
        0,
      )
      .to(vaultScan, { autoAlpha: 0, duration: 0.16, ease: "none" }, 0.84);
  }

  for (const group of qa<HTMLElement>(".archive-group", certificates)) {
    const timeline = createSectionSequence({
      trigger: group,
      start: "top 88%",
      end: "top 42%",
    });

    const head = q(".archive-group-head", group);
    addReveal(timeline, head, { y: 18, wipe: "left", duration: 0.5 });

    /* The card keeps its designed pixel-cut and hover transform; the wrapper
       carries the scroll reveal. */
    const cards = qa<HTMLElement>(".archive-card", group);
    markRevealed(cards);
    const wraps = qa<HTMLElement>(".archive-card-wrap", group);
    addReveal(timeline, wraps, {
      y: 22,
      duration: 0.45,
      stagger: 0.05,
      position: "<0.1",
    });
    addScaleSettle(timeline, qa(".archive-card-preview img", group), {
      from: 1.05,
      duration: 0.7,
      stagger: 0.03,
    });
  }

  const capturesWrap = q<HTMLElement>(".field-captures-wrap", certificates);
  if (capturesWrap) {
    const timeline = createSectionSequence({
      trigger: capturesWrap,
      start: "top 88%",
      end: "top 42%",
    });

    addReveal(timeline, q(".field-captures-head", certificates), {
      y: 20,
      wipe: "left",
      duration: 0.55,
    });
    addFade(timeline, q(".field-captures-camera", certificates), { duration: 0.5 });

    const captures = qa<HTMLElement>(".archive-capture", certificates);
    addReveal(timeline, captures, {
      y: 24,
      rotate: 1.2,
      restRotate: tiltOf,
      duration: 0.5,
      stagger: 0.06,
    });
    addScaleSettle(timeline, qa(".archive-capture img", certificates), {
      from: 1.05,
      duration: 0.8,
      stagger: 0.05,
    });
    addFullSpan(timeline, q(".zone-props", certificates), { y: 0 }, { y: -28 });
    /* Field captures: a single camera flash as the strip enters the frame. */
    addSceneFlash(timeline, q(".capture-flash", certificates));
  }
};

const revealContact = (): void => {
  const contact = document.getElementById("contact");
  const stage = contact ? q<HTMLElement>(".comms-stage", contact) : null;
  const comms = contact ? q<HTMLElement>(".comms", contact) : null;
  if (!contact || !stage || !comms) return;

  /* The wrapper owns the entrance transform. The signal deck itself stays free
     of GSAP transforms so the scroll-linked scan can never compete for the same
     matrix. */
  const timeline = createSectionSequence({
    trigger: stage,
    start: "top 88%",
    end: "top 38%",
  });

  addReveal(timeline, stage, { y: 26, duration: 0.8 });
  addReveal(timeline, q(".comms-bar", comms), {
    y: -8,
    wipe: "left",
    duration: 0.45,
    position: "<0.1",
  });
  addReveal(timeline, q(".comms-operator", comms), {
    x: -22,
    duration: 0.55,
    position: "<0.08",
  });
  addReveal(timeline, q(".comms-main", comms), {
    x: 22,
    duration: 0.55,
    position: "<0.05",
  });
  addReveal(
    timeline,
    qa(
      ".comms-kicker, .comms-title, .comms-copy, .comms-email-row, .comms-actions, .comms-foot, .comms-link",
      comms,
    ),
    { y: 12, duration: 0.45, stagger: 0.045, position: "<0.12" },
  );
  addReveal(timeline, qa(".comms-footer > span", comms), {
    y: 6,
    duration: 0.4,
    stagger: 0.05,
  });
  addFullSpan(timeline, q(".zone-props", contact), { y: 0 }, { y: -26 });
};

const revealFooter = (): void => {
  const footer = q<HTMLElement>(".console");
  if (!footer) return;

  const timeline = createSectionSequence({
    trigger: footer,
    start: "top 88%",
    /* Complete the remaining 58% of the reveal while the footer is still
       entering the viewport. Anchoring the end to `bottom bottom` left the
       footer half-hidden until maximum scroll, so its note and buttons looked
       broken during the Contact -> Footer hand-off. */
    end: "top 30%",
  });

  addReveal(timeline, q(".console-kicker", footer), {
    y: 8,
    wipe: "left",
    duration: 0.5,
  });
  addReveal(timeline, q(".console-title", footer), {
    y: 20,
    scale: 0.985,
    wipe: "left",
    duration: 0.8,
  });
  addReveal(timeline, q(".console-subtitle", footer), { y: 12, duration: 0.5 });
  addReveal(timeline, q(".console-progress", footer), {
    y: 10,
    duration: 0.45,
    position: "<0.1",
  });
  addReveal(timeline, q(".console-note", footer), { y: 14, duration: 0.5 });
  addReveal(timeline, q(".console-actions", footer), { y: 16, duration: 0.55 });
  addReveal(timeline, qa(".console-cta", footer), {
    y: 10,
    duration: 0.4,
    stagger: 0.05,
    position: "<0.12",
  });
  addReveal(timeline, q(".console-return", footer), { y: 8, duration: 0.4 });
  addReveal(timeline, q(".console-credits", footer), {
    y: 18,
    wipe: "up",
    duration: 0.65,
    position: "<0.15",
  });
  addReveal(timeline, qa(".console-credits-list > div", footer), {
    y: 6,
    duration: 0.35,
    stagger: 0.04,
    position: "<0.1",
  });
  addReveal(timeline, q(".console-bottom", footer), { y: 8, duration: 0.4 });

  addFullSpan(timeline, q(".console-scene", footer), { scale: 1.055 }, { scale: 1 });
  addFullSpan(timeline, q(".console-stars", footer), { y: 0 }, { y: 34 });
  addFullSpan(timeline, q(".console-sun", footer), { y: 0 }, { y: 58 });
  addFullSpan(timeline, q(".console-skyline", footer), { y: 0 }, { y: 20 });
  addFullSpan(timeline, q(".console-clouds", footer), { y: 0 }, { y: -26 });
  addFullSpan(timeline, q(".console-castle", footer), { y: 0 }, { y: -14 });
  /* Mission-complete CRT sweep across the end-screen landscape. */
  addSceneSweep(timeline, q(".console-scanline", footer), footer);
};

/** Catches any future `data-reveal` markup that has no dedicated choreography. */
const revealLeftovers = (): void => {
  for (const element of qa<HTMLElement>("[data-reveal]:not([data-gsap-motion])")) {
    const timeline = createSectionSequence({
      trigger: element,
      start: "top 88%",
      end: "top 56%",
    });
    const isPanel =
      element.classList.contains("paper-panel") || element.classList.contains("px-panel");
    addReveal(timeline, element, { y: 22, wipe: isPanel ? false : "up", duration: 0.6 });
  }
};

export function initScrollSections(): () => void {
  let context: gsap.Context | null = null;
  let media: ReturnType<typeof gsap.matchMedia> | null = null;
  let disposers: Disposer[] = [];

  const showEverything = (): void => {
    showAllContent();
    /* Extra shells that are not marked with data-reveal. */
    clearMotionStyles(
      qa<HTMLElement>(
        ".hero-copy, .hero-visual, .hero-shell, .hero-world, .ticker, .world-panel, .world-strap, .console-scene",
      ),
    );
  };

  const clean = (): void => {
    for (const dispose of disposers) dispose();
    disposers = [];
    media?.revert();
    media = null;
    context?.revert();
    context = null;
  };

  const build = (): void => {
    if (isCalmMotion()) {
      showEverything();
      return;
    }

    context = gsap.context(() => {
      media = gsap.matchMedia();

      /* ---------- Hero title-screen entrance -----------------------------
         This is a user-triggered entrance after READY, not a scroll reveal.
         Scroll choreography for the hero lives in hero.ts and only touches
         different wrapper elements, so the two systems never fight. */
      const hero = q<HTMLElement>(".hero");
      if (hero) {
        const titleLines = qa<HTMLElement>(".game-title-line", hero);
        const copy = qa<HTMLElement>(
          ".hero-eyebrow, .hero-subject, .hero-tagline, .hero-intro, .hero-commands, .hero-stats",
          hero,
        );
        const chrome = q(".hero-chrome", hero);
        const monitor = q(".hero-monitor", hero);
        const record = q(".hero-record", hero);
        const bottomline = q(".hero-bottomline", hero);
        markMotion([chrome, monitor, record, bottomline, ...titleLines, ...copy].filter(Boolean) as Element[]);

        const entrance = gsap.timeline({
          paused: true,
          defaults: { ease: "steps(6)" },
        });

        entrance
          .from(chrome, { autoAlpha: 0, y: -10, duration: 0.3 })
          .from(
            titleLines,
            {
              autoAlpha: 0,
              yPercent: 28,
              skewY: 1.2,
              clipPath: "inset(0 0 100% 0)",
              duration: 0.52,
              stagger: 0.1,
            },
            "<0.05",
          )
          .from(copy, { autoAlpha: 0, y: 16, duration: 0.34, stagger: 0.055 }, "<0.18")
          .from(monitor, { autoAlpha: 0, y: 22, duration: 0.5 }, "<0.05")
          .from(record, { autoAlpha: 0, x: 18, y: 14, rotate: 2, duration: 0.45 }, "<0.12")
          .from(bottomline, { autoAlpha: 0, y: 10, duration: 0.3 }, "<0.1");

        const playEntrance = (): void => {
          entrance.play(0);
        };

        if (document.documentElement.dataset.introDone === "true" || !q("[data-intro]")) {
          playEntrance();
        } else {
          const onIntro = (): void => playEntrance();
          document.addEventListener("sra:intro-complete", onIntro, { once: true });
          disposers.push(() => document.removeEventListener("sra:intro-complete", onIntro));
        }
      }

      for (const head of qa<HTMLElement>(".sec-head")) revealHeading(head);

      revealAbout();
      revealExperience();
      revealSkills();
      revealProjects(media);
      revealCertificates();
      revealContact();
      revealFooter();
      revealLeftovers();

      /* ---------- Hover feedback (independent of scroll) ----------------- */
      media?.add("(min-width: 64rem)", () => {
        for (const world of qa<HTMLElement>("[data-world]")) {
          /* Scroll choreography owns `.world-visual`; hover feedback lives on
             the inner art so the two transform systems never overlap. */
          const visual = q<HTMLElement>(".world-art", world);
          if (!visual) continue;
          const enter = (): void => {
            gsap.to(visual, { scale: 1.018, y: -4, duration: 0.28, ease: "steps(4)" });
          };
          const leave = (): void => {
            gsap.to(visual, { scale: 1, y: 0, duration: 0.32, ease: "steps(4)" });
          };
          world.addEventListener("pointerenter", enter);
          world.addEventListener("pointerleave", leave);
          disposers.push(() => {
            world.removeEventListener("pointerenter", enter);
            world.removeEventListener("pointerleave", leave);
          });
        }

        for (const node of qa<HTMLElement>("[data-quest-node]")) {
          const enter = (): void => {
            gsap.to(node, { y: -3, duration: 0.18, ease: "steps(3)" });
          };
          const leave = (): void => {
            gsap.to(node, { y: 0, duration: 0.22, ease: "steps(3)" });
          };
          node.addEventListener("pointerenter", enter);
          node.addEventListener("pointerleave", leave);
          disposers.push(() => {
            node.removeEventListener("pointerenter", enter);
            node.removeEventListener("pointerleave", leave);
          });
        }
      });
    }, document.body);
  };

  build();

  const stopMotion = onMotionChange((mode) => {
    clean();
    if (mode === "calm") showEverything();
    else build();
  });

  return () => {
    stopMotion();
    clean();
  };
}
