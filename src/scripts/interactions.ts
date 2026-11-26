const root = document.documentElement;
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

type MotionMode = "full" | "calm";

const currentMotion = (): MotionMode => (root.dataset.motion === "calm" ? "calm" : "full");
const motionButton = document.querySelector<HTMLButtonElement>("[data-motion-toggle]");
const motionState = document.querySelector<HTMLElement>("[data-motion-state]");
const hud = document.querySelector<HTMLElement>("[data-hud]");
const journeyDirector = (): boolean => root.dataset.journeyOn === "true";

/* The smoother measures the HUD during boot. This mirror keeps content clear of
   the fixed header even if the animation bundle never initializes. */
const syncHudHeight = (): void => {
  if (!hud) return;
  const height = Math.round(hud.getBoundingClientRect().height);
  if (height <= 0) return;
  const current = root.style.getPropertyValue("--hud-height");
  if (current !== `${height}px`) root.style.setProperty("--hud-height", `${height}px`);
};
syncHudHeight();
window.addEventListener("resize", syncHudHeight, { passive: true });
void document.fonts?.ready.then(syncHudHeight).catch(() => undefined);

/* ---------- Motion preference -------------------------------------------- */
const setMotionUI = (mode: MotionMode, announce = true): void => {
  root.dataset.motion = mode;
  const calm = mode === "calm";
  if (motionButton) {
    const label = calm ? "Enable full motion" : "Reduce motion";
    motionButton.setAttribute("aria-pressed", String(calm));
    motionButton.setAttribute("aria-label", label);
    motionButton.setAttribute("data-tip", label);
  }
  if (motionState) motionState.textContent = calm ? "Calm" : "Full";
  /* The initial paint syncs the UI only. Dispatching here would tear down and
     rebuild every scroll controller immediately after the animation bundle
     finished constructing it. */
  if (announce) {
    document.dispatchEvent(new CustomEvent("sra:motion-change", { detail: { mode } }));
  }
};

setMotionUI(currentMotion(), false);

/* ---------- Scroll reveals ----------------------------------------------- */
const revealables = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
let revealObserver: IntersectionObserver | null = null;

const revealAll = (): void => {
  for (const element of revealables) element.setAttribute("data-inview", "");
};

const startReveals = (): void => {
  // GSAP owns the reveal timelines when the animation bundle is active. The
  // old observer remains the fallback if that bundle failed to initialize.
  if (root.dataset.gsap === "on") return;
  if (revealables.length === 0) return;
  if (currentMotion() === "calm" || !("IntersectionObserver" in window)) {
    revealAll();
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      // Every freshly-visible batch cascades in step-time (60ms per element,
      // capped like a heartbeat). Inline `--d` from the markup always wins.
      let step = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        if (!element.style.getPropertyValue("--d")) {
          element.style.setProperty("--d", `${Math.min(step * 60, 300)}ms`);
        }
        step += 1;
        element.setAttribute("data-inview", "");
        revealObserver?.unobserve(element);
      }
    },
    // The hidden reveal state clips the element to zero height, so Chrome reports an
    // intersection ratio of 0 even while the layout box is on screen. Threshold 0 still
    // reports `isIntersecting`, which is the signal we need.
    { rootMargin: "0px 0px -6% 0px", threshold: 0 },
  );
  for (const element of revealables) revealObserver.observe(element);
};

startReveals();

/* ---------- Pause ambient animation when the tab is hidden --------------- */
const syncPaused = (): void => {
  root.setAttribute("data-paused", document.hidden ? "true" : "false");
};
syncPaused();
document.addEventListener("visibilitychange", syncPaused);

/* ---------- Mobile menu --------------------------------------------------- */
const menuButton = document.querySelector<HTMLButtonElement>("[data-menu-button]");
const menu = document.querySelector<HTMLElement>("[data-menu]");
const menuLabel = document.querySelector<HTMLElement>("[data-menu-label]");

if (menuButton && menu) {
  const setOpen = (open: boolean): void => {
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.toggleAttribute("data-open", open);
    if (menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
  };

  menuButton.addEventListener("click", () => {
    setOpen(menuButton.getAttribute("aria-expanded") !== "true");
  });

  menu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) setOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!menu.hasAttribute("data-open")) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (menu.contains(target) || menuButton.contains(target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.hasAttribute("data-open")) {
      setOpen(false);
      menuButton.focus();
    }
  });

  const desktopQuery = window.matchMedia("(min-width: 75rem)");
  desktopQuery.addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

/* ---------- Certificate index --------------------------------------------- */
const certIndex = document.querySelector<HTMLDetailsElement>("[data-cert-index]");
const certDesktopQuery = window.matchMedia("(min-width: 64rem)");
const certLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-cert-link]"));
const certCards = Array.from(document.querySelectorAll<HTMLElement>("[data-certificate]"));
const certSection = document.getElementById("certificates");

if (certIndex) {
  // The index is open on desktop and collapsed by default on small screens. A user choice
  // survives until the breakpoint changes, so the drawer never fights the reader.
  let mobileChoice = false;
  const syncCertIndex = (): void => {
    if (certDesktopQuery.matches) {
      mobileChoice = false;
      certIndex.open = true;
    } else if (!mobileChoice) {
      certIndex.open = false;
    }
  };

  syncCertIndex();

  certDesktopQuery.addEventListener("change", (event) => {
    mobileChoice = false;
    certIndex.open = event.matches;
  });

  certIndex.addEventListener("toggle", () => {
    if (!certDesktopQuery.matches) mobileChoice = true;
  });

  for (const link of certLinks) {
    link.addEventListener("click", () => {
      if (certDesktopQuery.matches) return;
      certIndex.open = false;
      mobileChoice = true;
    });
  }
}

let currentCertId: string | null = null;

const applyCurrentCertificate = (id: string | null): void => {
  if (id === currentCertId) return;
  currentCertId = id;
  for (const link of certLinks) {
    if (link.dataset.certLink === id) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  }
};

/* Reads only. Layout writes happen later in `updateScrollState` so a single
   scroll frame never interleaves measurements with style invalidations. */
const findCurrentCertificate = (): { known: boolean; id: string | null } => {
  if (certLinks.length === 0 || certCards.length === 0 || !certSection) {
    return { known: false, id: null };
  }
  const line = window.innerHeight * 0.35;
  if (certSection.getBoundingClientRect().bottom < line) return { known: true, id: null };
  let currentId: string | null = null;
  for (const card of certCards) {
    if (card.getBoundingClientRect().top > line) break;
    currentId = card.dataset.certificate ?? null;
  }
  return { known: true, id: currentId };
};

/* The certificate ledger is only read while its scene is active, and at most
   once per ~120 ms. Every other zone avoids the card measurements entirely. */
let certificateScene = root.dataset.scene === "certificates";
let certificateTimer = 0;

const refreshCurrentCertificate = (): void => {
  if (!certificateScene) {
    applyCurrentCertificate(null);
    return;
  }
  const certificate = findCurrentCertificate();
  if (certificate.known) applyCurrentCertificate(certificate.id);
};

const requestCertificateUpdate = (): void => {
  if (certificateTimer) return;
  certificateTimer = window.setTimeout(() => {
    certificateTimer = 0;
    refreshCurrentCertificate();
  }, 120);
};

document.addEventListener("sra:journey-state", (event) => {
  const detail = (event as CustomEvent<{ id?: string }>).detail;
  certificateScene = detail?.id === "certificates";
  if (certificateScene) refreshCurrentCertificate();
  else applyCurrentCertificate(null);
});

/* ---------- Certificate preview modal ------------------------------------- */
const certModal = document.querySelector<HTMLDialogElement>("[data-cert-modal]");
if (certModal) {
  const modalNum = certModal.querySelector<HTMLElement>("[data-modal-num]");
  const modalType = certModal.querySelector<HTMLElement>("[data-modal-type]");
  const modalTitle = certModal.querySelector<HTMLElement>("[data-modal-title]");
  const modalIssuer = certModal.querySelector<HTMLElement>("[data-modal-issuer]");
  const modalDate = certModal.querySelector<HTMLElement>("[data-modal-date]");
  const modalDetail = certModal.querySelector<HTMLElement>("[data-modal-detail]");
  const modalViewer = certModal.querySelector<HTMLElement>("[data-modal-viewer]");
  const modalFactCred = certModal.querySelector<HTMLElement>("[data-modal-fact-cred]");
  const modalCred = certModal.querySelector<HTMLElement>("[data-modal-cred]");
  const modalFactVerify = certModal.querySelector<HTMLElement>("[data-modal-fact-verify]");
  const modalVerify = certModal.querySelector<HTMLAnchorElement>("[data-modal-verify]");
  const modalOrigLink = certModal.querySelector<HTMLAnchorElement>("[data-modal-orig-link]");
  const modalOrigType = certModal.querySelector<HTMLElement>("[data-modal-orig-type]");
  const modalVerifyLink = certModal.querySelector<HTMLAnchorElement>("[data-modal-verify-link]");
  const closeButtons = Array.from(certModal.querySelectorAll<HTMLElement>("[data-modal-close]"));

  const closeModal = (): void => {
    certModal.close();
  };

  certModal.addEventListener("close", () => {
    if (modalViewer) modalViewer.replaceChildren();
  });

  for (const btn of closeButtons) {
    btn.addEventListener("click", closeModal);
  }

  certModal.addEventListener("click", (event) => {
    if (event.target === certModal) closeModal();
  });

  const openModalForCard = (card: HTMLElement): void => {
    const num = card.dataset.certNum ?? "";
    const type = card.dataset.certType ?? "image";
    const title = card.dataset.certTitle ?? "";
    const issuer = card.dataset.certIssuer ?? "";
    const date = card.dataset.certDate ?? "";
    const file = card.dataset.certFile ?? "";
    const detail = card.dataset.certDetail ?? "";
    const cred = card.dataset.certCred ?? "";
    const verify = card.dataset.certVerify ?? "";

    if (modalNum) modalNum.textContent = num;
    if (modalType) modalType.textContent = type === "pdf" ? "PDF DOCUMENT" : "IMAGE FILE";
    if (modalTitle) modalTitle.textContent = title;
    if (modalIssuer) modalIssuer.textContent = issuer;
    if (modalDate) modalDate.textContent = date;
    if (modalDetail) modalDetail.textContent = detail;

    if (modalFactCred && modalCred) {
      if (cred) {
        modalCred.textContent = cred;
        modalFactCred.hidden = false;
      } else {
        modalFactCred.hidden = true;
      }
    }

    if (modalFactVerify && modalVerify) {
      if (verify) {
        modalVerify.href = verify;
        modalFactVerify.hidden = false;
      } else {
        modalFactVerify.hidden = true;
      }
    }

    if (modalVerifyLink) {
      if (verify) {
        modalVerifyLink.href = verify;
        modalVerifyLink.hidden = false;
      } else {
        modalVerifyLink.hidden = true;
      }
    }

    if (modalOrigLink) {
      modalOrigLink.href = file;
    }
    if (modalOrigType) {
      modalOrigType.textContent = `${type.toUpperCase()} ↗`;
    }

    if (modalViewer) {
      modalViewer.replaceChildren();
      if (type === "pdf") {
        const frame = document.createElement("iframe");
        frame.src = `${file}#toolbar=0`;
        frame.title = title;
        frame.className = "cert-modal-pdf-frame";
        modalViewer.append(frame);
      } else {
        const img = document.createElement("img");
        img.src = file;
        img.alt = title;
        img.className = "cert-modal-full-img";
        modalViewer.append(img);
      }
    }

    certModal.showModal();
  };

  const openTriggers = Array.from(document.querySelectorAll<HTMLElement>("[data-open-modal]"));
  for (const trigger of openTriggers) {
    trigger.addEventListener("click", () => {
      const id = trigger.dataset.openModal;
      if (!id) return;
      const card = document.getElementById(`cert-${id}`);
      if (card) openModalForCard(card);
    });
  }
}

/* ---------- Current zone marker ------------------------------------------ */
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"));
const navTargets = navLinks
  .map((link) => {
    const targetId = link.hash.slice(1);
    const target = targetId ? document.getElementById(targetId) : null;
    /* The scene director names the finale scene `footer`, while its link points
       at the heading (`#footer-title`). Use the chapter hook as the canonical
       nav key so aria-current can follow the scene instead of the fragment. */
    const id = link.dataset.journeyStop ?? targetId;
    return target ? { link, target, id } : null;
  })
  .filter(
    (item): item is { link: HTMLAnchorElement; target: HTMLElement; id: string } => item !== null,
  );

let currentNavId: string | null = null;

const applyCurrentSection = (id: string | null): void => {
  if (id === currentNavId) return;
  currentNavId = id;
  for (const item of navTargets) {
    if (item.id === id) {
      item.link.setAttribute("aria-current", "location");
    } else {
      item.link.removeAttribute("aria-current");
    }
  }
};

const sceneNavId = (id: string | null): string | null =>
  id && navTargets.some((item) => item.id === id) ? id : null;

/* The scene director is the single author of the active journey scene. This
   listener mirrors its decision into the primary navigation. */
document.addEventListener("sra:journey-state", (event) => {
  const detail = (event as CustomEvent<{ id?: string; navId?: string | null }>).detail;
  if (!detail) return;
  applyCurrentSection(detail.navId ?? sceneNavId(detail.id ?? null));
});

applyCurrentSection(sceneNavId(root.dataset.scene ?? null));

/* The sections are deliberately uneven in height, so intersection ratios
   mislead. This native fallback only runs when the scene director is absent —
   for example when the animation bundle failed to initialize. */
function findActiveSection(): string | null {
  if (navTargets.length === 0) return null;
  const line = window.innerHeight * 0.35;
  let current: string | null = null;
  for (const item of navTargets) {
    if (item.target.getBoundingClientRect().top <= line) current = item.id;
  }
  return current;
}

/* ---------- Scroll progress + header state (fallback) -------------------- */
const progressBar = document.querySelector<HTMLElement>("[data-progress]");
let scrollTicking = false;
let lastProgress = -1;
let lastScrolled: boolean | null = null;

const updateScrollState = (): void => {
  scrollTicking = false;
  if (journeyDirector()) return;

  const doc = document.scrollingElement ?? document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const scrollY = window.scrollY;
  const ratio = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;

  /* Measure everything first, then write. */
  const activeId = findActiveSection();

  if (progressBar && ratio !== lastProgress) {
    lastProgress = ratio;
    progressBar.style.setProperty("--progress", ratio.toFixed(4));
  }

  const scrolled = scrollY > 8;
  if (hud && scrolled !== lastScrolled) {
    lastScrolled = scrolled;
    hud.toggleAttribute("data-scrolled", scrolled);
  }

  applyCurrentSection(activeId);
  refreshCurrentCertificate();
};

const requestScrollState = (): void => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(updateScrollState);
};

const onJourneyScroll = (): void => {
  if (!journeyDirector()) {
    requestScrollState();
    return;
  }
  if (certificateScene) requestCertificateUpdate();
};

if (navTargets.length > 0 || progressBar || hud || certLinks.length > 0) {
  window.addEventListener("scroll", onJourneyScroll, { passive: true });
  /* ScrollSmoother moves the page on its own ticker after the native scroll
     event. Re-read once more when it settles, otherwise the last native event
     can leave a consumer one frame behind. */
  document.addEventListener("sra:smooth-update", onJourneyScroll);
  window.addEventListener("resize", onJourneyScroll, { passive: true });
  onJourneyScroll();
  updateScrollState();
}

/* Native fallback for deep links if the animation bundle never attached its
   resolver and scene director. */
if (!journeyDirector() && navTargets.length > 0) {
  const fromHash = (): void => {
    const id = window.location.hash.slice(1);
    if (navTargets.some((item) => item.target.id === id)) applyCurrentSection(id);
  };

  fromHash();
  window.addEventListener("hashchange", fromHash);
}

/* ---------- Hero parallax (pointer devices, full motion only) ------------ */
const parallaxLayers = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
const hero = document.querySelector<HTMLElement>(".hero");

const resetParallax = (): void => {
  for (const layer of parallaxLayers) {
    layer.style.removeProperty("--px");
    layer.style.removeProperty("--py");
  }
};

if (hero && parallaxLayers.length > 0 && finePointer) {
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;

  const applyParallax = (): void => {
    frame = 0;
    if (currentMotion() === "calm") return;
    for (const layer of parallaxLayers) {
      const depth = Number(layer.dataset.depth ?? "2");
      layer.style.setProperty("--px", (pointerX * depth).toFixed(2));
      layer.style.setProperty("--py", (pointerY * depth).toFixed(2));
    }
  };

  hero.addEventListener(
    "pointermove",
    (event) => {
      if (currentMotion() === "calm") return;
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
      if (frame) return;
      frame = requestAnimationFrame(applyParallax);
    },
    { passive: true },
  );

  hero.addEventListener("pointerleave", () => {
    pointerX = 0;
    pointerY = 0;
    resetParallax();
  });
}

/* ---------- Ambient visibility -------------------------------------------- */
const ambientStages = Array.from(
  document.querySelectorAll<HTMLElement>(
    "[data-quest-world], [data-skill-stage], [data-multiverse-stage], [data-world-stage]",
  ),
);

if (ambientStages.length > 0) {
  if ("IntersectionObserver" in window) {
    const ambientObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target instanceof HTMLElement) {
            entry.target.dataset.visible = entry.isIntersecting ? "true" : "false";
          }
        }
      },
      { rootMargin: "120px 0px", threshold: 0.01 },
    );
    for (const stage of ambientStages) ambientObserver.observe(stage);
  } else {
    for (const stage of ambientStages) stage.dataset.visible = "true";
  }
}

/* ---------- Career quest map ---------------------------------------------- */
const careerMap = document.querySelector<HTMLElement>("[data-career-map]");

if (careerMap) {
  const details = Array.from(careerMap.querySelectorAll<HTMLElement>("[data-quest-detail]"));
  const questLinks = Array.from(careerMap.querySelectorAll<HTMLAnchorElement>("[data-quest-node]"));
  const segments = Array.from(careerMap.querySelectorAll<SVGGElement>("[data-segment]"));
  const questStatus = careerMap.querySelector<HTMLElement>("[data-quest-status]");
  const readout = careerMap.querySelector<HTMLElement>("[data-quest-readout]");
  const questSteps = Array.from(
    careerMap.querySelectorAll<HTMLButtonElement>("[data-quest-step]"),
  );
  const questPosition = careerMap.querySelector<HTMLElement>("[data-quest-position]");
  const questProgress = careerMap.querySelector<HTMLElement>("[data-quest-progress]");
  const questHint = careerMap.querySelector<HTMLElement>("[data-quest-hint]");

  const questOrder = details
    .map((detail) => detail.dataset.questDetail)
    .filter((id): id is string => Boolean(id));

  const idFromHash = (): string | null => {
    const match = window.location.hash.match(/^#quest-detail-(.+)$/);
    return match?.[1] ?? null;
  };

  const initialDetail =
    details.find((detail) => detail.dataset.questDetail === idFromHash()) ??
    details.find((detail) => detail.hasAttribute("data-active")) ??
    details[0];

  let activeId = initialDetail?.dataset.questDetail ?? null;

  const applyQuest = (id: string, announce: boolean): void => {
    const selected = details.find((detail) => detail.dataset.questDetail === id);
    if (!selected) return;
    activeId = id;
    const activeIndex = questOrder.indexOf(id);

    for (const detail of details) {
      const isActive = detail.dataset.questDetail === id;
      detail.toggleAttribute("data-active", isActive);
      detail.hidden = !isActive;
    }

    for (const link of questLinks) {
      const isActive = link.dataset.questNode === id;
      link.toggleAttribute("data-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
      const state = link.querySelector<HTMLElement>(".quest-node__state");
      if (state) state.textContent = isActive ? "VIEWING" : "OPEN";
      const arrow = link.querySelector<HTMLElement>(".quest-route__arrow");
      if (arrow) arrow.textContent = isActive ? "◀" : "▶";
    }

    for (const segment of segments) {
      const segmentIndex = questOrder.indexOf(segment.dataset.to ?? "");
      const state =
        activeIndex < 0 || segmentIndex < 0
          ? "future"
          : segmentIndex < activeIndex
            ? "past"
            : segmentIndex === activeIndex
              ? "active"
              : "future";
      segment.dataset.state = state;
      segment.toggleAttribute("data-lit", state === "active");
    }

    if (readout) readout.dataset.activeQuest = id;
    if (questHint) {
      const role =
        selected.querySelector<HTMLElement>(".quest-detail__role")?.textContent ?? "Career entry";
      questHint.textContent = `${role} // ${String(activeIndex + 1).padStart(2, "0")} of ${String(
        questOrder.length,
      ).padStart(2, "0")}`;
    }
    if (questPosition) {
      questPosition.textContent = String(activeIndex + 1).padStart(2, "0");
    }
    if (questProgress) {
      const ratio = questOrder.length > 0 ? (activeIndex + 1) / questOrder.length : 0;
      questProgress.style.width = `${Math.round(ratio * 100)}%`;
    }
    for (const step of questSteps) {
      const direction = Number(step.dataset.questStep);
      if (!Number.isFinite(direction)) continue;
      step.disabled =
        direction < 0 ? activeIndex <= 0 : activeIndex >= questOrder.length - 1;
    }

    if (announce && questStatus) {
      const role =
        selected.querySelector<HTMLElement>(".quest-detail__role")?.textContent ?? "Career entry";
      const org = selected.querySelector<HTMLElement>(".quest-detail__org")?.textContent ?? "";
      questStatus.textContent = `Field dossier updated: ${role}${org ? ` at ${org}` : ""}.`;
    }
  };

  if (activeId) applyQuest(activeId, false);
  careerMap.setAttribute("data-quest-ready", "");

  for (const link of questLinks) {
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const id = link.dataset.questNode;
      if (!id) return;
      event.preventDefault();
      applyQuest(id, true);
      try {
        window.history.replaceState(null, "", `#quest-detail-${id}`);
      } catch {
        // A static host or an embedded frame may reject history updates; selection still works.
      }
    });
  }

  const selectQuest = (id: string): void => {
    applyQuest(id, true);
    try {
      window.history.replaceState(null, "", `#quest-detail-${id}`);
    } catch {
      /* Selection still works without history. */
    }
  };

  for (const step of questSteps) {
    step.addEventListener("click", () => {
      if (!activeId) return;
      const index = questOrder.indexOf(activeId);
      if (index < 0) return;
      const direction = Math.sign(Number(step.dataset.questStep));
      const nextId = questOrder[index + direction];
      if (nextId) selectQuest(nextId);
    });
  }

  /* Arrow keys step through the route only while a waypoint owns focus. */
  careerMap.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const origin = target.closest<HTMLElement>("[data-quest-node]");
    if (!origin || !activeId) return;
    const index = questOrder.indexOf(activeId);
    if (index < 0) return;
    const nextId = questOrder[index + (event.key === "ArrowRight" ? 1 : -1)];
    if (!nextId) return;
    event.preventDefault();
    selectQuest(nextId);
    const inRoute = Boolean(origin.closest(".quest-route"));
    const nextLink = questLinks.find(
      (link) => link.dataset.questNode === nextId && Boolean(link.closest(".quest-route")) === inRoute,
    );
    nextLink?.focus({ preventScroll: true });
  });

  window.addEventListener("hashchange", () => {
    const id = idFromHash();
    if (id) applyQuest(id, true);
  });
}

/* ---------- Pixel ability matrix ------------------------------------------ */
const skillMatrix = document.querySelector<HTMLElement>("[data-skill-matrix]");

if (skillMatrix) {
  const buttons = Array.from(skillMatrix.querySelectorAll<HTMLButtonElement>("[data-skill-node]"));
  const readout = skillMatrix.querySelector<HTMLElement>("[data-skill-readout]");
  const readName = readout?.querySelector<HTMLElement>("[data-skill-name]");
  const readContext = readout?.querySelector<HTMLElement>("[data-skill-context]");
  const readCount = readout?.querySelector<HTMLElement>("[data-skill-count]");
  const readIndex = readout?.querySelector<HTMLElement>("[data-skill-item-index]");
  const readSigil = readout?.querySelector<HTMLElement>("[data-skill-sigil]");
  const readSiblings = readout?.querySelector<HTMLElement>("[data-skill-siblings]");
  const skillStatus = skillMatrix.querySelector<HTMLElement>("[data-skill-status]");
  const indexItems = Array.from(skillMatrix.querySelectorAll<HTMLElement>("[data-index-skill]"));
  const skillOrder = indexItems
    .map((item) => item.dataset.indexSkill)
    .filter((name): name is string => Boolean(name));
  const skillSteps = Array.from(
    skillMatrix.querySelectorAll<HTMLButtonElement>("[data-skill-step]"),
  );
  const skillPosition = skillMatrix.querySelector<HTMLElement>("[data-skill-position]");
  const circuitButtons = Array.from(
    skillMatrix.querySelectorAll<HTMLButtonElement>("[data-skill-circuit]"),
  );
  const categoryTargets = Array.from(
    readout?.querySelectorAll<HTMLElement>("[data-skill-category]") ?? [],
  );
  const abilityLinks = Array.from(skillMatrix.querySelectorAll<HTMLElement>(".ability-link"));

  const applySkill = (button: HTMLButtonElement, announce: boolean): void => {
    const name = button.dataset.skillName;
    const group = button.dataset.skillGroup;
    const category = button.dataset.skillCategory;
    const tone = button.dataset.skillTone ?? "blue";
    const itemIndex = button.dataset.skillItemIndex ?? "—";
    if (!name || !group || !category) return;

    skillMatrix.dataset.selectedGroup = group;
    skillMatrix.dataset.selectedTone = tone;
    skillMatrix.dataset.tone = tone;
    if (readout) readout.dataset.tone = tone;

    /* Cable choreography: the trunk of the selected group plus the branch that
       leads to the clicked component light up. Any other cable stays dark. */
    for (const link of abilityLinks) {
      const lit =
        link.dataset.linkGroup === group &&
        (link.dataset.linkKind === "bus" || link.dataset.linkNode === name);
      link.toggleAttribute("data-active", lit);
    }

    for (const candidate of buttons) {
      const selected = candidate.dataset.skillName === name;
      candidate.setAttribute("aria-pressed", String(selected));
      candidate.toggleAttribute("data-selected", selected);
    }

    for (const target of categoryTargets) target.textContent = category;
    if (readName) readName.textContent = name;
    if (readCount) readCount.textContent = button.dataset.skillCount ?? "0";
    if (readIndex) readIndex.textContent = itemIndex;
    if (readContext) {
      readContext.textContent = `Filed in the ${category} module. This dossier records the skill name and its category only — no proficiency, years, or certification is implied.`;
    }

    if (readSigil) {
      readSigil.replaceChildren();
      const sigil = button.querySelector<SVGElement>(".pixel-sigil");
      if (sigil) readSigil.append(sigil.cloneNode(true));
    }

    if (readSiblings) {
      readSiblings.replaceChildren();
      const seen = new Set<string>();
      for (const candidate of buttons) {
        const sibling = candidate.dataset.skillName;
        if (
          !sibling ||
          sibling === name ||
          candidate.dataset.skillGroup !== group ||
          seen.has(sibling)
        )
          continue;
        seen.add(sibling);
        const item = document.createElement("li");
        item.textContent = sibling;
        readSiblings.append(item);
      }
    }

    for (const indexItem of indexItems) {
      indexItem.toggleAttribute("data-active", indexItem.dataset.indexSkill === name);
    }

    for (const chip of circuitButtons) {
      chip.setAttribute("aria-pressed", String(chip.dataset.skillCircuit === group));
    }

    const orderIndex = skillOrder.indexOf(name);
    if (skillPosition) {
      skillPosition.textContent =
        orderIndex >= 0 ? String(orderIndex + 1).padStart(2, "0") : "—";
    }
    for (const step of skillSteps) {
      const direction = Number(step.dataset.skillStep);
      if (!Number.isFinite(direction)) continue;
      step.disabled =
        direction < 0 ? orderIndex <= 0 : orderIndex < 0 || orderIndex >= skillOrder.length - 1;
    }

    if (readout) {
      readout.classList.remove("is-refreshing");
      void readout.offsetWidth;
      readout.classList.add("is-refreshing");
    }

    if (announce && skillStatus) {
      skillStatus.textContent = `Ability readout updated: ${name}, ${category} module.`;
    }
  };

  const initialButton =
    buttons.find((button) => button.getAttribute("aria-pressed") === "true") ?? buttons[0];
  if (initialButton) applySkill(initialButton, false);

  let currentSkillName: string | null = initialButton?.dataset.skillName ?? null;

  const buttonByName = new Map<string, HTMLButtonElement>();
  for (const button of buttons) {
    const name = button.dataset.skillName;
    if (name && !buttonByName.has(name)) buttonByName.set(name, button);
  }

  const selectSkillByName = (name: string, announce = true): HTMLButtonElement | null => {
    const button = buttonByName.get(name);
    if (!button) return null;
    currentSkillName = name;
    applySkill(button, announce);
    return button;
  };

  const stepSkill = (direction: number, focus: boolean): void => {
    if (skillOrder.length === 0) return;
    const index = currentSkillName ? skillOrder.indexOf(currentSkillName) : -1;
    const nextName =
      index < 0
        ? direction > 0
          ? skillOrder[0]
          : skillOrder[skillOrder.length - 1]
        : skillOrder[index + direction];
    if (!nextName) return;
    const button = selectSkillByName(nextName, true);
    if (focus) button?.focus({ preventScroll: true });
  };

  const clearCablePreview = (): void => {
    for (const link of abilityLinks) link.removeAttribute("data-preview");
    for (const item of indexItems) item.removeAttribute("data-preview");
  };

  const previewSkill = (name: string | null): void => {
    clearCablePreview();
    if (!name) return;
    const group = buttonByName.get(name)?.dataset.skillGroup ?? null;
    for (const link of abilityLinks) {
      const hit =
        link.dataset.linkNode === name ||
        (group !== null && link.dataset.linkKind === "bus" && link.dataset.linkGroup === group);
      link.toggleAttribute("data-preview", hit);
    }
    for (const item of indexItems) {
      item.toggleAttribute("data-preview", item.dataset.indexSkill === name);
    }
  };

  const findSkillName = (target: Element | null): string | null => {
    const node = target?.closest<HTMLElement>("[data-skill-node], [data-index-skill]");
    if (!node || !skillMatrix.contains(node)) return null;
    return node.dataset.skillName ?? node.dataset.indexSkill ?? null;
  };

  if (finePointer) {
    skillMatrix.addEventListener("pointerover", (event) => {
      const target = event.target;
      previewSkill(target instanceof Element ? findSkillName(target) : null);
    });
    skillMatrix.addEventListener("pointerleave", clearCablePreview);
  }

  skillMatrix.addEventListener("focusin", (event) => {
    const target = event.target;
    previewSkill(target instanceof Element ? findSkillName(target) : null);
  });

  skillMatrix.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && skillMatrix.contains(next)) return;
    clearCablePreview();
  });

  const deselectSkill = (): void => {
    currentSkillName = null;
    skillMatrix.dataset.selectedGroup = "";
    skillMatrix.dataset.selectedTone = "";
    skillMatrix.dataset.tone = "";
    if (readout) readout.dataset.tone = "";
    for (const candidate of buttons) {
      candidate.setAttribute("aria-pressed", "false");
      candidate.removeAttribute("data-selected");
    }
    for (const link of abilityLinks) link.removeAttribute("data-active");
    for (const chip of circuitButtons) chip.setAttribute("aria-pressed", "false");
    for (const step of skillSteps) step.disabled = true;
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const name = button.dataset.skillName;
      /* Toggle: pressing the already-selected component clears the selection. */
      if (name && name === currentSkillName) {
        deselectSkill();
        return;
      }
      currentSkillName = name ?? null;
      applySkill(button, true);
    });
  }

  for (const step of skillSteps) {
    step.addEventListener("click", () => {
      const direction = Math.sign(Number(step.dataset.skillStep));
      if (direction !== 0) stepSkill(direction, false);
    });
  }

  for (const chip of circuitButtons) {
    chip.addEventListener("click", () => {
      const group = chip.dataset.skillCircuit;
      if (!group) return;
      const first = buttons.find((button) => button.dataset.skillGroup === group);
      const name = first?.dataset.skillName;
      if (!name) return;
      selectSkillByName(name, true);
    });
  }

  /* Left/right mirrors the visible stepper, but only while an up/down action
     cannot be confused with page scrolling. The focused node follows along. */
  skillMatrix.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      !target.closest(
        "[data-skill-node], [data-skill-step], [data-skill-circuit], [data-skill-readout]",
      )
    )
      return;
    event.preventDefault();
    const fromNode = Boolean(target.closest("[data-skill-node]"));
    stepSkill(event.key === "ArrowRight" ? 1 : -1, fromNode);
  });
}

/* ---------- Motion toggle -------------------------------------------------- */
motionButton?.addEventListener("click", () => {
  const next: MotionMode = currentMotion() === "calm" ? "full" : "calm";
  setMotionUI(next);
  try {
    localStorage.setItem("motion", next);
  } catch {
    // Storage can be blocked; the choice then lasts for this page view only.
  }

  if (next === "calm") {
    revealAll();
    revealObserver?.disconnect();
    revealObserver = null;
    resetParallax();
  } else if (!revealObserver && revealables.length > 0) {
    startReveals();
  }
});

motionQuery.addEventListener("change", (event) => {
  const stored = (() => {
    try {
      return localStorage.getItem("motion");
    } catch {
      return null;
    }
  })();
  if (stored === "full" || stored === "calm") return;
  const next: MotionMode = event.matches ? "calm" : "full";
  setMotionUI(next);
  if (next === "calm") {
    revealAll();
    revealObserver?.disconnect();
    revealObserver = null;
    resetParallax();
  } else {
    startReveals();
  }
});

/* ---------- Landing switch fallback --------------------------------------- */
/* This module runs after the animation bundle. The GSAP controller writes the
   `data-landing-engine="gsap"` marker as its final construction step, so this
   branch only registers a handler when that controller genuinely never built —
   never as a second listener while GSAP is still warming up. */
const fallbackLanding = document.querySelector<HTMLElement>("[data-landing]");
const fallbackToggle = document.querySelector<HTMLButtonElement>("[data-landing-toggle]");

if (fallbackLanding && fallbackToggle && fallbackLanding.dataset.landingEngine !== "gsap") {
  const label = fallbackToggle.querySelector<HTMLElement>(".landing-toggle-label");
  const hint = fallbackLanding.querySelector<HTMLElement>("#landing-toggle-hint");

  fallbackToggle.addEventListener("click", () => {
    const active = fallbackToggle.getAttribute("aria-checked") !== "true";
    fallbackLanding.dataset.landingState = active ? "active" : "idle";
    fallbackToggle.setAttribute("aria-checked", String(active));
    fallbackLanding.toggleAttribute("data-landing-active", active);
    if (label) label.textContent = active ? "ENTER" : "ENGAGE";
    if (hint) {
      hint.textContent = active
        ? "Console online. Operator link established."
        : "Activate the switch to go live.";
    }
  });
}

/* ---------- Copy the email address ----------------------------------------- */
const copyButton = document.querySelector<HTMLButtonElement>("[data-copy]");
const copyStatus = document.querySelector<HTMLElement>("[data-copy-status]");

if (copyButton) {
  const address = copyButton.dataset.copy ?? "";
  const copyLabel = copyButton.querySelector<HTMLElement>("[data-copy-text]");
  let resetTimer = 0;

  const settle = (message: string, ok: boolean): void => {
    copyButton.toggleAttribute("data-copied", ok);
    if (copyLabel) copyLabel.textContent = ok ? "Copied" : "Copy failed";
    if (copyStatus) copyStatus.textContent = message;
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      copyButton.removeAttribute("data-copied");
      if (copyLabel) copyLabel.textContent = "Copy address";
    }, 2600);
  };

  copyButton.addEventListener("click", () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(address)
        .then(() => settle("Email address copied to clipboard.", true))
        .catch(() => settle("Could not copy automatically. Select the address to copy it.", false));
    } else {
      settle("Could not copy automatically. Select the address to copy it.", false);
    }
  });
}

/* ---------- Horizontal galleries (certificates & field captures) ----------- */
const horizontalZones = Array.from(
  document.querySelectorAll<HTMLElement>("[data-horizontal-zone]"),
);

const runGalleryUpdate = (): void => {
  for (const zone of horizontalZones) {
    const scroller = zone.querySelector<HTMLElement>("[data-horizontal-scroll]");
    const indicator = zone.querySelector<HTMLElement>("[data-gallery-pos]");
    const prev = zone.querySelector<HTMLButtonElement>("[data-gallery-prev]");
    const next = zone.querySelector<HTMLButtonElement>("[data-gallery-next]");
    if (!scroller) continue;

    const max = scroller.scrollWidth - scroller.clientWidth;
    const ratio = max > 0 ? Math.min(1, Math.max(0, scroller.scrollLeft / max)) : 0;
    zone.style.setProperty("--gallery-progress", ratio.toFixed(4));
    if (indicator) indicator.textContent = `${String(Math.round(ratio * 100)).padStart(2, "0")}%`;
    if (prev) prev.disabled = scroller.scrollLeft <= 8;
    if (next) next.disabled = max - scroller.scrollLeft <= 8;
  }
};

let galleryTicking = false;
const requestGalleryUpdate = (): void => {
  if (galleryTicking) return;
  galleryTicking = true;
  requestAnimationFrame(() => {
    galleryTicking = false;
    runGalleryUpdate();
  });
};

if (horizontalZones.length > 0) {
  for (const zone of horizontalZones) {
    const scroller = zone.querySelector<HTMLElement>("[data-horizontal-scroll]");
    const prev = zone.querySelector<HTMLButtonElement>("[data-gallery-prev]");
    const next = zone.querySelector<HTMLButtonElement>("[data-gallery-next]");
    if (!scroller) continue;

    const captureFigures = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-capture-id]"),
    );
    if (captureFigures.length > 0) {
      const selectCapture = (rail: HTMLElement, figure: HTMLElement): void => {
        /* The server renders the first capture as selected. Clearing every
           sibling (rather than only the previously clicked one) keeps that
           initial selection from surviving the first interaction. */
        for (const other of rail.querySelectorAll<HTMLElement>("[data-capture-id]")) {
          if (other !== figure) other.setAttribute("data-active", "false");
        }
        figure.setAttribute("data-active", "true");
      };

      for (const figure of captureFigures) {
        figure.addEventListener("click", () => {
          const rail = figure.closest<HTMLElement>("[data-horizontal-scroll]");
          selectCapture(rail ?? scroller, figure);
        });
        figure.addEventListener("keydown", (event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          const rail = figure.closest<HTMLElement>("[data-horizontal-scroll]");
          selectCapture(rail ?? scroller, figure);
        });
      }
    }

    if (prev && next) {
      const scrollGallery = (direction: number): void => {
        scroller.scrollBy({
          left: direction * Math.max(scroller.clientWidth * 0.8, 240),
          behavior: currentMotion() === "calm" ? "auto" : "smooth",
        });
      };

      prev.addEventListener("click", () => scrollGallery(-1));
      next.addEventListener("click", () => scrollGallery(1));
    }

    scroller.addEventListener("scroll", requestGalleryUpdate, { passive: true });
  }
  window.addEventListener("resize", requestGalleryUpdate, { passive: true });
  requestGalleryUpdate();
}

export {};
