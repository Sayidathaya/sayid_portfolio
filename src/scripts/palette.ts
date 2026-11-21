const root = document.documentElement;
const dialog = document.querySelector<HTMLDialogElement>("[data-command-palette]");

if (dialog) {
  const input = dialog.querySelector<HTMLInputElement>("[data-cmd-input]");
  const list = dialog.querySelector<HTMLElement>("[data-cmd-list]");
  const empty = dialog.querySelector<HTMLElement>("[data-cmd-empty]");
  const items = Array.from(dialog.querySelectorAll<HTMLElement>("[data-cmd-item]"));
  const closeButtons = Array.from(dialog.querySelectorAll<HTMLElement>("[data-cmd-close]"));
  const themeItem = dialog.querySelector<HTMLElement>("[data-cmd-theme]");
  const motionItem = dialog.querySelector<HTMLElement>("[data-cmd-motion]");
  const themeLabel = dialog.querySelector<HTMLElement>("[data-cmd-theme-label]");
  const motionLabel = dialog.querySelector<HTMLElement>("[data-cmd-motion-label]");
  const themeButton = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  const motionButton = document.querySelector<HTMLButtonElement>("[data-motion-toggle]");

  let lastFocused: HTMLElement | null = null;
  let activeItem: HTMLElement | null = null;

  const isOpen = (): boolean => dialog.open;
  const visibleItems = (): HTMLElement[] => items.filter((item) => !item.hidden);

  const setActive = (item: HTMLElement | null, scroll = true): void => {
    activeItem = item;
    for (const entry of items) {
      const selected = entry === item;
      entry.setAttribute("aria-selected", String(selected));
      entry.toggleAttribute("data-active", selected);
    }
    if (!input) return;
    if (!item) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    input.setAttribute("aria-activedescendant", item.id);
    if (scroll) item.scrollIntoView({ block: "nearest" });
  };

  const applyFilter = (): void => {
    if (!input) return;
    const terms = input.value
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    let firstVisible: HTMLElement | null = null;
    let bestMatch: HTMLElement | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const item of items) {
      const haystack = (item.dataset.search ?? item.textContent ?? "").toLowerCase();
      const matches = terms.every((term) => haystack.includes(term));
      item.hidden = !matches;
      if (!matches) continue;
      if (!firstVisible) firstVisible = item;

      /* Prefer a direct label match over an alias-only match, so typing
         "pro" lands on Projects even though About lists "profile" as a
         search alias. Alias matches remain in the list. */
      const label = item.querySelector<HTMLElement>(".cmd-item-name")?.textContent?.toLowerCase() ?? "";
      let score = 2;
      if (terms.length > 0 && terms.every((term) => label.includes(term))) {
        score = label.startsWith(terms[0] ?? "") ? 0 : 1;
      }
      if (score < bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    if (empty) empty.hidden = items.some((item) => !item.hidden);
    setActive(terms.length > 0 ? bestMatch : firstVisible, false);
  };

  const syncCommandState = (): void => {
    const light = root.dataset.theme === "light";
    const calm = root.dataset.motion === "calm";

    if (themeLabel) {
      themeLabel.textContent = light ? "Switch to dark theme" : "Switch to light theme";
    }
    if (motionLabel) {
      motionLabel.textContent = calm ? "Enable full motion" : "Reduce motion";
    }
    if (themeItem) {
      themeItem.dataset.search = `theme appearance toggle ${light ? "dark" : "light"} mode switch`;
    }
    if (motionItem) {
      motionItem.dataset.search = `motion animation ${calm ? "full" : "reduce calm"} toggle`;
    }

    if (isOpen()) applyFilter();
  };

  const resetPalette = (): void => {
    if (input) input.value = "";
    for (const item of items) item.hidden = false;
    if (empty) empty.hidden = true;
    setActive(items[0] ?? null, false);
  };

  const openPalette = (): void => {
    if (isOpen()) return;
    /* The intro owns the screen until it releases the page. A certificate
       lightbox is also a modal; never stack the command deck over it. */
    if (root.classList.contains("intro-lock")) return;
    if (document.querySelector("dialog[open]:not([data-command-palette])")) return;

    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    syncCommandState();
    dialog.showModal();
    resetPalette();

    if (!input) return;
    window.requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      input.select();
    });
  };

  const closePalette = (): void => {
    if (!isOpen()) return;
    dialog.close();
  };

  const activate = (item: HTMLElement | null): void => {
    if (!item) return;

    if (item.hasAttribute("data-cmd-theme")) {
      themeButton?.click();
      closePalette();
      return;
    }
    if (item.hasAttribute("data-cmd-motion")) {
      motionButton?.click();
      closePalette();
      return;
    }

    /* Chapter rows stay ordinary hash links. The site's global click handler
       sends them through the existing ScrollSmoother navigation. */
    closePalette();
    item.click();
  };

  for (const button of closeButtons) {
    button.addEventListener("click", closePalette);
  }

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closePalette();
  });

  /* Escape is handled in the capture phase: a focused type="search" input
     otherwise swallows it to clear the field, leaving the dialog open. */
  dialog.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closePalette();
    },
    { capture: true },
  );

  dialog.addEventListener("close", () => {
    const target = lastFocused;
    lastFocused = null;
    activeItem = null;
    if (input) input.value = "";

    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  });

  input?.addEventListener("input", applyFilter);

  input?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const visible = visibleItems();
      if (visible.length === 0) return;
      const current = activeItem ? visible.indexOf(activeItem) : -1;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next =
        current < 0 ? (delta > 0 ? 0 : visible.length - 1) : (current + delta + visible.length) % visible.length;
      const item = visible[next];
      if (item) setActive(item);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      const visible = visibleItems();
      if (visible.length === 0) return;
      event.preventDefault();
      const item = event.key === "Home" ? visible[0] : visible[visible.length - 1];
      if (item) setActive(item);
      return;
    }

    if (event.key === "Enter") {
      if (!activeItem) return;
      event.preventDefault();
      activate(activeItem);
    }
  });

  list?.addEventListener("pointermove", (event) => {
    if (!(event.target instanceof Element)) return;
    const item = event.target.closest<HTMLElement>("[data-cmd-item]");
    if (item && !item.hidden && item !== activeItem) setActive(item, false);
  });

  list?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const item = event.target.closest<HTMLElement>("[data-cmd-item]");
    if (!item) return;

    if (item.hasAttribute("data-cmd-theme")) {
      event.preventDefault();
      themeButton?.click();
      closePalette();
      return;
    }
    if (item.hasAttribute("data-cmd-motion")) {
      event.preventDefault();
      motionButton?.click();
      closePalette();
      return;
    }

    /* Leave the anchor's default action alone; the smoother intercepts it at
       the document level, exactly as it does for the HUD chapter links. */
    closePalette();
  });

  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.altKey || event.shiftKey) return;
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() !== "k") return;

    event.preventDefault();
    if (isOpen()) closePalette();
    else openPalette();
  });

  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(syncCommandState).observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-motion"],
    });
  }
  syncCommandState();
}
