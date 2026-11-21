import type { ImageMetadata } from "astro";

/**
 * Semantic map for the 8-bit sprite library. The source files keep their
 * original names; components depend on these stable roles instead.
 */
const FILE_BY_NAME = {
  astronaut: "anciee-pixelart-9643229_1920",
  castle: "anciee-pixelart-9644213_1920",
  computer: "divexfre-old-pixel-computer-9800787_1920",
  shield: "divexfre-pixel-art-9752554_1920",
  iceCream: "divexfre-pixel-art-9754415_1920",
  sword: "divexfre-pixel-art-9757065_1920",
  book: "divexfre-pixel-art-9762954_1920",
  coin: "divexfre-pixel-art-9788141_1920",
  alarm: "lesiakower-alarm-clock-7248174_1920",
  camera: "lesiakower-camera-7279306_1920",
  stoneCastle: "lesiakower-castle-7440761_1920",
  clouds: "lesiakower-clouds-8177208_1920",
  dumbbell: "lesiakower-dumbbell-7540929_1920",
  notebook: "lesiakower-notebook-7780952_1920",
  potion: "lesiakower-potion-7265174_1920",
  floppy: "lesiakower-save-8207948_1920",
  speedometer: "lesiakower-speed-7309042_1920",
} as const;

export type PixelAssetName = keyof typeof FILE_BY_NAME;

const modules = import.meta.glob<{ default: ImageMetadata }>("/src/assets/8bit_images/*.png", {
  eager: true,
});

const byStem = new Map<string, ImageMetadata>(
  Object.entries(modules).map(([path, mod]): [string, ImageMetadata] => [
    path
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "") ?? path,
    mod.default,
  ]),
);

/** Returns the imported sprite metadata; fails the build if a mapped file is missing. */
export function findPixelAsset(name: PixelAssetName): ImageMetadata {
  const stem = FILE_BY_NAME[name];
  const asset = byStem.get(stem);
  if (!asset) {
    throw new Error(`Missing 8-bit sprite: ${stem}.png`);
  }
  return asset;
}

export const pixelAssetNames = Object.keys(FILE_BY_NAME) as PixelAssetName[];
