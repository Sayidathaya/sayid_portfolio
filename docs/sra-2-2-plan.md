# SRA PORTFOLIO 2.2 — IMPLEMENTATION PLAN

Mission: SRA PORTFOLIO 2.2 — *Visual Recovery, Experience Map Rebuild & Cinematic UX Completion*.

## Phase 0 — Baseline & scope lock
- Audit existing source before edits (in progress via parallel explore agents).
- Lock preservation list (see main brief Part 01).

## Phase 1 — Experience / Career Quest Map repair

1. **Data ordering**
   - Add explicit `sort` to the `experience` collection schema (`src/content.config.ts`).
   - Assign editorial order to content entries:
     - `seminar-moderator` → 1
     - `ai-upskilling` → 2
     - `insorsa-staff` → 3
     - `telkom-qa` → 4
   - Sort the trail ascending by `sort` in `CareerQuestMap.astro`; stop relying on a blind reverse.
   - Deriving the active/latest milestone from the sorted tail (Telkom QA / 2026) after sorting.

2. **Waypoint / structure / card placement separation**
   - Keep waypoint anchor percentages (`x`, `y`, `scale`, `structure`) from content.
   - Add content-driven card placement (above / below / left / right / corners) OR editorial card positions keyed by waypoint.
   - Enforce non-overlap, no route-through-text, no overflow of map.

3. **Route geometry**
   - Rebuild `stepPath` so segments start/end at meaningful anchors and use clean horizontal/vertical bends.
   - Fix SVG `vector-effect="non_scaling-stroke"` → `non-scaling-stroke` if present in quest paths too.

4. **Cards**
   - Typography hierarchy: role > org > year > period.
   - Widths, padding, pixel corners, max heights, wrapping.

5. **Animation**
   - Keep single GSAP timeline; add background → landscape → route draw → nodes → cards → active → detail phases; reverse on scroll up.

## Phase 2 — Skills / Ability Circuit repair

1. **Hierarchy**
   - SRA CORE dominant centre, connected to all three category hubs.
   - Build (blue) / Data (red) / Voice (purple) hubs.
   - Nodes under proper hubs.

2. **Coordinates**
   - Rebalance hub + node percentages; no overlap; labels no collision; within stage bounds.

3. **Connections**
   - Correct SVG `vector-effect`.
   - Group/layer paths; continuity; junction points.

4. **Typography**
   - Fluid + minimum readable sizes for skill names, category, code.

5. **Interaction/animation**
   - Core reveal → primary paths → branch → nodes → selected.
   - Category select updates emphasis + readout.

## Phase 3 — Section composition & global polish
- Heading / HUD / scroll offset checks for both zones.
- Motion sync, reduced motion, calm mode.
- Responsive regression (Experience + Skills) at required breakpoints.

## Phase 4 — SRA 2.1 completion audit
- Confirm Pixel Scanner, Hero, Manifesto, About, Projects, Certificates, Captures, Contact, Finale, Nav, Curtain, Telemetry (optional).

## Phase 5 — Visual QA & final report A–G for 2.2.
