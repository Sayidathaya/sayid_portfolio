# Sayid Rafi A'thaya

A static, 8-bit detective portfolio built with Astro 6, strict TypeScript, Tailwind CSS v4
(CSS-first, `@tailwindcss/vite`) and Biome. Fonts are self-hosted through Fontsource:
Silkscreen for pixel display type, Space Grotesk for body copy and IBM Plex Mono for metadata.

The design is a playable archive: a title-screen hero, subject briefing, quest log, loadout bay,
evidence vault, comms terminal and end-screen footer. Every scene is made from CSS, inline SVG and
small local Astro components — there are no animation libraries, tracking scripts or remote assets.

## Commands (Node 22.12+)

```bash
npm install
npm run format   # once: normalise formatting with Biome
npm run dev      # http://localhost:4321
npm run verify   # biome lint + astro check + production build
npm run build && npm run preview
```

## Edit your content

All copy lives in `src/data/portfolio.ts`. Entries marked `placeholder: true` show a "Sample" stamp;
replace the text, then delete the flag. Counts in the hero, quest log and inventory are derived from
this file — nothing is hard-coded.

Add `repositoryUrl` / `demoUrl` to a project and the links appear; nothing is linked until you set it.
Navigation lives in the same file and powers both the HUD and the footer index.

## Images

Drop `src/assets/images/portrait.jpg` for the briefing and `src/assets/images/<project-slug>.jpg` for
each case. They are picked up automatically and optimised with Astro `<Picture>` (AVIF/WebP,
responsive widths, lazy-loaded below the fold). Without a file, the built-in generated pixel artwork
is shown. Set `profile.portraitAlt` to a real description.

## Credential archive

The appendix page at `/archive/` reads `certificates`, `archiveProjects` and `fieldCaptures` from
`src/data/portfolio.ts`. Original certificate files are served from `public/certificates/`; preview
JPEGs live in `public/certificates/thumbs/` and use each certificate `id` as the file name.

## Interaction and accessibility

The site is static-first. Small progressive-enhancement scripts handle the theme toggle, a persisted
motion toggle (`full` / `calm`), the mobile menu, the scroll-spy cursor, copy-to-clipboard and the
scroll progress bar. With JavaScript disabled, content is visible and navigation still works.
- `prefers-reduced-motion` selects calm mode on first visit; the toggle overrides it.
- Ambience pauses when the tab is hidden.
- All controls are keyboard reachable with a visible focus ring and 44px-class touch targets.
- The palette is checked for AA-level contrast in both dark and light themes; paper panels keep dark
  ink on warm stock.

## Contact

The contact block is a `mailto:` link on purpose: a form needs a delivery endpoint.
To add one, use Formspree (`<form action="https://formspree.io/f/<id>" method="post">`) or Netlify
Forms (`data-netlify="true"`), and only show a success message from the provider's real response.

## Deploy

`npm run build` writes a static site to `dist/`. Publish that folder on any static host
(Netlify, Cloudflare Pages, Vercel, GitHub Pages). Build with `SITE_URL=https://your-domain.com` to
enable canonical and Open Graph URLs; add `@astrojs/sitemap` once the domain is known.
`src/pages/404.astro` becomes `404.html`.

LINK LINKEDIN
- https://www.linkedin.com/in/sayid-rafi-96a9ba356?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app

LINK DEVIANT ART
- https://www.deviantart.com/zexusnext

LINK INSTAGRAM
- https://www.instagram.com/sayidathaya?igsh=MTk2ZTA1M3p6NzBiYg==

LINK GOOGLE DRIVE
- https://drive.google.com/file/d/1ebMlcteS9RFYq6dAW5GndvnmQoN7w7n8/view?usp=sharing

LINK CODEPEN
- https://codepen.io/Sayid-Rafi

LINK GITHUB
- https://github.com/Sayidathaya/
