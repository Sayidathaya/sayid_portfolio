import type { ImageMetadata } from "astro";

const modules = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/images/**/*.{jpg,jpeg,png,webp,avif}",
  { eager: true },
);

const byName = new Map<string, ImageMetadata>(
  Object.entries(modules).map(([path, mod]): [string, ImageMetadata] => [
    path
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "") ?? path,
    mod.default,
  ]),
);

/** Looks up a local image by file name without extension, e.g. "portrait" or a project slug. */
export function findImage(name: string): ImageMetadata | undefined {
  return byName.get(name);
}
