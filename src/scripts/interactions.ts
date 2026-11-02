const root = document.documentElement;
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

type MotionMode = "full" | "calm";

const currentMotion = (): MotionMode => (root.dataset.motion === "calm" ? "calm" : "full");
const motionButton = document.querySelector<HTMLButtonElement>("[data-motion-toggle]");
const motionState = document.querySelector<HTMLElement>("[data-motion-state]");

/* ---------- Motion preference -------------------------------------------- */
const setMotionUI = (mode: MotionMode): void => {
  root.dataset.motion = mode;
  const calm = mode === "calm";
  if (motionButton) {
    const label = calm ? "Enable full motion" : "Reduce motion";
    motionButton.setAttribute("aria-pressed", String(calm));
    motionButton.setAttribute("aria-label", label);
    motionButton.setAttribute("data-tip", label);
  }
  if (motionState) motionState.textContent = calm ? "Calm" : "Full";
};

setMotionUI(currentMotion());

/* ---------- Scroll reveals ----------------------------------------------- */
const revealables = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
let revealObserver: IntersectionObserver | null = null;

const revealAll = (): void => {
  for (const element of revealables) element.setAttribute("data-inview", "");
};

const startReveals = (): void => {
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

  const desktopQuery = window.matchMedia("(min-width: 62rem)");
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

const markCurrentCertificate = (id: string | null): void => {
  for (const link of certLinks) {
    if (link.dataset.certLink === id) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  }
};

const updateCertificateIndex = (): void => {
  if (certLinks.length === 0 || certCards.length === 0) return;
  const line = window.innerHeight * 0.35;
  if (!certSection || certSection.getBoundingClientRect().bottom < line) {
    markCurrentCertificate(null);
    return;
  }
  let currentId: string | null = null;
  for (const card of certCards) {
    if (card.getBoundingClientRect().top > line) break;
    currentId = card.dataset.certificate ?? null;
  }
  markCurrentCertificate(currentId);
};

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

/* ---------- Current zone marker in the command bar ----------------------- */
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"));
const navTargets = navLinks
  .map((link) => {
    const id = link.hash.slice(1);
    const target = id ? document.getElementById(id) : null;
    return target ? { link, target } : null;
  })
  .filter((item): item is { link: HTMLAnchorElement; target: HTMLElement } => item !== null);

const markCurrent = (id: string | null): void => {
  for (const { link, target } of navTargets) {
    if (target.id === id) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  }
};

if (navTargets.length > 0) {
  const fromHash = (): void => {
    const id = window.location.hash.slice(1);
    if (navTargets.some((item) => item.target.id === id)) markCurrent(id);
  };

  fromHash();
  window.addEventListener("hashchange", fromHash);
}

// The sections are deliberately uneven in height, so intersection ratios mislead.
// Instead, treat the last section whose top has crossed the command-line as current.
function updateActiveSection(): void {
  if (navTargets.length === 0) return;
  const line = window.innerHeight * 0.35;
  let current: (typeof navTargets)[number] | null = null;
  for (const item of navTargets) {
    if (item.target.getBoundingClientRect().top <= line) current = item;
  }
  markCurrent(current ? current.target.id : null);
}

/* ---------- Scroll progress + header state -------------------------------- */
const progressBar = document.querySelector<HTMLElement>("[data-progress]");
const hud = document.querySelector<HTMLElement>("[data-hud]");
let scrollTicking = false;

const updateScrollState = (): void => {
  const doc = document.scrollingElement ?? document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  root.style.setProperty("--progress", ratio.toFixed(4));
  if (hud) hud.toggleAttribute("data-scrolled", window.scrollY > 8);
  updateActiveSection();
  updateCertificateIndex();
  scrollTicking = false;
};

const requestScrollState = (): void => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(updateScrollState);
};

if (progressBar || hud) {
  window.addEventListener("scroll", requestScrollState, { passive: true });
  window.addEventListener("resize", requestScrollState, { passive: true });
  updateScrollState();
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
      const lit = segment.dataset.from === id || segment.dataset.to === id;
      segment.toggleAttribute("data-lit", lit);
    }

    if (readout) readout.dataset.activeQuest = id;

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
  const categoryTargets = Array.from(
    readout?.querySelectorAll<HTMLElement>("[data-skill-category]") ?? [],
  );

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

  for (const button of buttons) {
    button.addEventListener("click", () => applySkill(button, true));
  }
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
    const fallback = (): void => {
      const field = document.createElement("textarea");
      field.value = address;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      field.remove();
      settle(
        ok
          ? "Email address copied to clipboard."
          : "Could not copy automatically. Select the address to copy it.",
        ok,
      );
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(address)
        .then(() => settle("Email address copied to clipboard.", true))
        .catch(fallback);
    } else {
      fallback();
    }
  });
}

export {};
