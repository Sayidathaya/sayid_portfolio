export interface NavItem {
  label: string;
  href: string;
}

export interface ExternalLink {
  label: string;
  href: string;
  image?: string;
  platform?: string;
  caption?: string;
}

/** The six-colour system. Every component should opt into one of these roles. */
export type ChromaticTone = "red" | "yellow" | "blue" | "purple";

export interface Profile {
  name: string;
  role: string;
  location: string;
  availability: string;
  tagline: string;
  intro: string;
  about: string[];
  highlights: string[];
  email: string;
  links: ExternalLink[];
  portraitAlt: string;
  placeholder?: boolean;
}

export type EntryStatus = "Active" | "Closed" | "Archived";

/** Hand-placed coordinates for the career quest map (percentage of the world). */
export interface ExperienceMapPosition {
  x: number;
  y: number;
  scale?: number;
  structure?: "tower" | "vault" | "relay" | "gate";
  tone?: ChromaticTone;
}

export interface ExperienceEntry {
  id: string;
  period: string;
  role: string;
  organization: string;
  summary: string;
  technologies: string[];
  status: EntryStatus;
  map?: ExperienceMapPosition;
  placeholder?: boolean;
}

export type SkillGlyph = "cartridge" | "shield" | "rocket" | "spark" | "star";

/** Hand-placed coordinates for the ability matrix (percentage of the board). */
export interface SkillMatrixPosition {
  x: number;
  y: number;
}

export interface SkillGroup {
  id: string;
  label: string;
  items: string[];
  tone?: ChromaticTone;
  glyph?: SkillGlyph;
  matrix?: SkillMatrixPosition[];
  placeholder?: boolean;
}

/** The three deliberately different world compositions used by the project multiverse. */
export type ProjectWorldVariant = "feature" | "artifact" | "expedition";

/**
 * Art direction for a project destination. This is presentation metadata, not a project claim.
 * `variant` chooses the composition; `tone` and `accent` choose its two chromatic roles.
 */
export interface ProjectWorldDirection {
  variant: ProjectWorldVariant;
  tone: ChromaticTone;
  accent: ChromaticTone;
}

/** Images are resolved by file name: src/assets/images/<slug>.(jpg|png|webp|avif). */
export interface PortfolioProject {
  slug: string;
  title: string;
  description: string;
  technologies: string[];
  year: string;
  role: string;
  featured: boolean;
  notes?: string;
  repositoryUrl?: string;
  demoUrl?: string;
  placeholder?: boolean;
  world?: ProjectWorldDirection;
}

export type CertificateCategory = "web" | "data" | "leadership" | "award";
export type CertificateFileType = "pdf" | "image";

/** A document in the credential vault. `file` always points at the original asset. */
export interface Certificate {
  id: string;
  title: string;
  issuer: string;
  date: string;
  category: CertificateCategory;
  file: string;
  fileType: CertificateFileType;
  detail: string;
  credentialId?: string;
  verifyUrl?: string;
}

export interface CertificateGroup {
  id: CertificateCategory;
  label: string;
  note: string;
}

/** A real capture without a charted world on the main atlas. */
export interface ArchiveProject {
  id: string;
  title: string;
  year: string;
  detail: string;
  image: string;
  links: ExternalLink[];
}

/** A personal photograph from the supplied archive, with an honest caption. */
export interface FieldCapture {
  id: string;
  image: string;
  alt: string;
  caption: string;
  meta: string;
  platform?: string;
  platformUrl?: string;
  sourceFile?: string;
}
