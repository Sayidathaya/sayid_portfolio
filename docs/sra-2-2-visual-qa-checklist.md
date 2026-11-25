# SRA PORTFOLIO 2.2 — VISUAL QA CHECKLIST

Mandatory for Phase 10 of the SRA 2.2 mission. No PASS claim without executed tests.

## Experience / Career Quest Map (`#experience`)

| Viewport | Capture | Checks |
|---|---|---|
| 1920 × 1080 | Section top (HUD + world start) | HUD visible, no overlap with heading |
| 1920 × 1080 | Mid-map | Route + structures + cards balanced |
| 1920 × 1080 | Selected card | Active state clear, readable |
| 1440 × 900 | Section top | Same |
| 1366 × 768 | Section top | Same |
| 1024 × 768 | Section top | Same |
| 768 × 1024 | Section top | Mobile-grid layout intact, no overlap |
| 390 × 844 | Section top | Cards readable, route understandable |
| 360 × 800 | Section top | No horizontal overflow |

Capture points per section: top · interactive stage · info/readout area · selected state · entry animation.

Checks:
- Cards do not overlap each other.
- Cards do not overlap unrelated structures.
- Route lines do not cross important text/content.
- Text is readable at all sizes (mobile especially).
- No clipped text.
- Current chapter obvious; route progression coherent.

## Skills / Ability Circuit (`#skills`)

| Viewport | Capture | Checks |
|---|---|---|
| 1920 × 1080 | Full board top | Core + hubs + nodes readable |
| 1440 × 900 | Board | Same |
| 1366 × 768 | Board | Same |
| 1024 × 768 | Board | Balanced, readable |
| 768 × 1024 | Board | Tablet balance |
| 390 × 844 | Module view (mobile) | Modules readable, diagram transition intact |
| 360 × 800 | Module view | No overflow |

Checks:
- SRA Core visually dominant and connected.
- Build / Data / Voice clearly grouped.
- Every node has a proper connection.
- Labels readable; no overlap; no too-small text.
- SVG vector-effect correct (`non-scaling-stroke`).
- Active state unmistakable.

## Global checks

- Dark / Light mode.
- Full Motion / Calm Motion / Reduce Motion.
- Scroll down / scroll up / direct chapter navigation / manual scroll.
- Repeated selection.
- Resize / orientation change.

## Reporting rule

- PASS only after executed tests.
- FAIL findings → fix → retest → update final report.
