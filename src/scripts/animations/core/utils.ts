export function q<T extends Element>(selector: string, scope: ParentNode = document): T | null {
  return scope.querySelector<T>(selector);
}

export function qa<T extends Element>(selector: string, scope: ParentNode = document): T[] {
  return Array.from(scope.querySelectorAll<T>(selector));
}

export function isElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

/** Converts the inline `--d` stagger hint from markup into milliseconds. */
export function readDelay(element: HTMLElement, fallback = 0): number {
  const raw = element.style.getPropertyValue("--d").trim();
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) return fallback;
  return raw.endsWith("ms") ? parsed : parsed * 1000;
}

export function markRevealed(elements: Iterable<HTMLElement>): void {
  for (const element of elements) element.setAttribute("data-inview", "");
}

export function clearRevealStyles(elements: Iterable<HTMLElement>): void {
  for (const element of elements) element.style.removeProperty("--d");
}
