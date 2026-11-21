import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const chromaticTone = z.enum(["red", "yellow", "blue", "purple"]);
const worldVariant = z.enum(["feature", "artifact", "expedition"]);
const questStructure = z.enum(["tower", "vault", "relay", "gate"]);
const entryStatus = z.enum(["Active", "Closed", "Archived"]);
const skillGlyph = z.enum(["cartridge", "shield", "rocket", "spark", "star"]);
const certificateCategory = z.enum(["web", "data", "leadership", "award"]);
const certificateFileType = z.enum(["pdf", "image"]);

const externalLink = z.object({
  label: z.string(),
  href: z.string(),
  image: z.string().optional(),
  platform: z.string().optional(),
  caption: z.string().optional(),
});

const experienceMap = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number().optional(),
  structure: questStructure.optional(),
  tone: chromaticTone.optional(),
});

const projectWorld = z.object({
  variant: worldVariant,
  tone: chromaticTone,
  accent: chromaticTone,
});

export const collections = {
  projects: defineCollection({
    schema: z.object({
      slug: z.string(),
      title: z.string(),
      description: z.string(),
      technologies: z.array(z.string()),
      year: z.string(),
      role: z.string(),
      featured: z.boolean(),
      notes: z.string().optional(),
      repositoryUrl: z.string().optional(),
      demoUrl: z.string().optional(),
      world: projectWorld.optional(),
    }),
    loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  }),
  certificates: defineCollection({
    schema: z.object({
      id: z.string(),
      title: z.string(),
      issuer: z.string(),
      date: z.string(),
      category: certificateCategory,
      file: z.string(),
      fileType: certificateFileType,
      detail: z.string(),
      credentialId: z.string().optional(),
      verifyUrl: z.string().optional(),
    }),
    loader: glob({ pattern: "**/*.md", base: "./src/content/certificates" }),
  }),
  certificateGroups: defineCollection({
    schema: z.object({
      id: certificateCategory,
      label: z.string(),
      note: z.string(),
    }),
    loader: glob({ pattern: "**/*.md", base: "./src/content/certificate-groups" }),
  }),
  experience: defineCollection({
    schema: z.object({
      id: z.string(),
      period: z.string(),
      role: z.string(),
      organization: z.string(),
      summary: z.string(),
      technologies: z.array(z.string()),
      status: entryStatus,
      map: experienceMap.optional(),
    }),
    loader: glob({ pattern: "**/*.md", base: "./src/content/experience" }),
  }),
  skills: defineCollection({
    schema: z.object({
      id: z.string(),
      label: z.string(),
      items: z.array(z.string()),
      tone: chromaticTone.optional(),
      glyph: skillGlyph.optional(),
      matrix: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    }),
    loader: glob({ pattern: "**/*.md", base: "./src/content/skills" }),
  }),
  archive: defineCollection({
    schema: z.object({
      id: z.string(),
      title: z.string(),
      year: z.string(),
      detail: z.string(),
      image: z.string(),
      links: z.array(externalLink),
    }),
    loader: glob({ pattern: "**/*.md", base: "./src/content/archive" }),
  }),
  captures: defineCollection({
    schema: z.object({
      id: z.string(),
      image: z.string(),
      alt: z.string(),
      caption: z.string(),
      meta: z.string(),
      platform: z.string().optional(),
      platformUrl: z.string().optional(),
      sourceFile: z.string().optional(),
    }),
    loader: glob({ pattern: "**/*.md", base: "./src/content/captures" }),
  }),
  profile: defineCollection({
    schema: z.object({
      name: z.string(),
      role: z.string(),
      location: z.string(),
      availability: z.string(),
      tagline: z.string(),
      intro: z.string(),
      about: z.array(z.string()),
      highlights: z.array(z.string()),
      email: z.string(),
      links: z.array(externalLink),
      portraitAlt: z.string(),
      placeholder: z.boolean().optional(),
    }),
    loader: glob({ pattern: "**/*.md", base: "./src/content/profile" }),
  }),
  navigation: defineCollection({
    schema: z.object({
      items: z.array(
        z.object({
          label: z.string(),
          href: z.string(),
        }),
      ),
    }),
    loader: glob({ pattern: "**/*.md", base: "./src/content/navigation" }),
  }),
};
