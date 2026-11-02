import type {
  ChromaticTone,
  PortfolioProject,
  ProjectWorldDirection,
  ProjectWorldVariant,
} from "../types/portfolio";

const variants: ProjectWorldVariant[] = ["feature", "artifact", "expedition"];
const tones: ChromaticTone[] = ["red", "purple", "blue"];
const accents: ChromaticTone[] = ["yellow", "blue", "yellow"];

export const worldLabels: Record<ProjectWorldVariant, string> = {
  feature: "Cinematic world",
  artifact: "Classified artifact",
  expedition: "Expedition world",
};

/** `world` is optional in content, so future projects receive a deterministic direction. */
export function resolveWorld(project: PortfolioProject, index: number): ProjectWorldDirection {
  return (
    project.world ?? {
      variant: variants[index % variants.length] ?? "feature",
      tone: tones[index % tones.length] ?? "red",
      accent: accents[index % accents.length] ?? "yellow",
    }
  );
}

/** Semantic project numbers shared by the atlas, world file and detail route. */
export function projectNumbers(index: number): { worldNo: string; caseNo: string } {
  return {
    worldNo: String(index + 1).padStart(2, "0"),
    caseNo: String(index + 1).padStart(3, "0"),
  };
}

export function projectDetailHref(slug: string): string {
  return `/projects/${slug}/`;
}

/** Presentation-only CSS variables. Accent colours always come from the semantic token set. */
export function worldStyle(direction: ProjectWorldDirection): string {
  return [
    `--world-tone:var(--color-accent-${direction.tone})`,
    `--world-accent:var(--color-accent-${direction.accent})`,
    `--world-tone-ink:var(--color-accent-${direction.tone}-ink)`,
    `--world-accent-ink:var(--color-accent-${direction.accent}-ink)`,
  ].join(";");
}
