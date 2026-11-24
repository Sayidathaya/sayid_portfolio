/**
 * Page-exit curtain.
 *
 * Only same-origin, full-page navigations are intercepted. Hash links, new-tab
 * links, downloads, external origins and modified clicks keep their native
 * behaviour. The curtain is purely decorative and is skipped when motion is
 * calm or reduced, so navigation never waits on an animation.
 */
const curtain = document.querySelector<HTMLElement>("[data-page-curtain]");

if (curtain) {
  let navigating = false;

  const calmMotion = (): boolean => {
    if (document.documentElement.dataset.motion === "calm") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  const isEligible = (anchor: HTMLAnchorElement): boolean => {
    if (anchor.target && anchor.target !== "_self") return false;
    if (anchor.hasAttribute("download")) return false;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return false;

    let url: URL;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return false;
    }

    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      return false;
    }
    if (/\.(?:pdf|png|jpe?g|webp|avif|svg|gif|zip|docx?|xlsx?)$/i.test(url.pathname)) return false;
    return true;
  };

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || !isEligible(anchor)) return;

    event.preventDefault();
    if (navigating) return;
    navigating = true;

    const destination = anchor.href;
    if (calmMotion()) {
      window.location.assign(destination);
      return;
    }

    curtain.dataset.state = "closing";
    window.setTimeout(() => {
      window.location.assign(destination);
    }, 400);
  });

  window.addEventListener("pageshow", () => {
    navigating = false;
    curtain.dataset.state = "idle";
  });
}
