# Budget Buckets — Dogfood Report

| Field | Value |
|-------|-------|
| **Date** | April 19, 2026 |
| **App URL** | http://localhost:5175/ (Vite dev; ports 5173–5174 were in use) |
| **API** | http://localhost:3001 |
| **Test PDF** | `~/Downloads/CITY OF SAN RAMON FISCAL YEAR 2025-26 ADOPTED BUDGET.pdf` |
| **Scope** | Exploratory QA: upload flow, archive, dossier, donut, city comparison, Q&A chat |

## Summary

| Type | Count |
|------|-------|
| Issues documented | 6 |
| Feature ideas | 9 |
| Screenshots | `screenshots/01-initial.png`, `screenshots/02-upload-form-filled.png` |

---

## Issues

### ISSUE-001: Donut chart uses the wrong denominator for percentages

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Functional / data interpretation |
| **Description** | The donut computes each slice as `amount / sum(non-zero bucket amounts)`. The dossier sidenote and comparison table use each bucket’s `share` (fraction of **adopted total budget**). When extracted buckets do not sum to `totalBudget`, ring percentages disagree with the narrative (e.g. “roughly 32% of the total”) and with the city-vs-city table for the same city. |
| **Expected** | All “% of budget” figures should use the same basis—ideally `totalBudget`, or explicitly labeled “% of mapped buckets.” |
| **Evidence** | Code: `apps/web/src/components/BucketDonut.tsx` (`total` = sum of bucket amounts); `apps/web/src/components/Dossier.tsx` (sidenote uses `topBucket.share`). UI: slice labels showed ~45% where narrative showed ~32% for the same bucket. |

### ISSUE-002: City comparison can hang a long time with no progress or cancel

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | UX |
| **Description** | Comparing against an uncached city (default placeholder suggests “San Diego”) triggers a long-running agent scrape. The button shows “Comparing…” but there is no ETA, progress, or way to cancel. Users may think the app froze. |
| **Expected** | Progress indicator, approximate stage text, timeout with friendly error, and/or cancel. Prefer defaulting compare to **archive** cities or an empty field with hint. |

### ISSUE-003: Duplicate City / State / Fiscal Year fields confuse PDF upload

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | UX |
| **Description** | The hero form has City, State, and FY for “Open the ledger.” The PDF upload flow adds **separate** per-file City/State/FY rows. Users can fill the top row and assume it applies to the upload; analysis then fails validation or misattributes metadata until the per-PDF row is filled. |
| **Expected** | Clear visual grouping (“Search” vs “Upload”), copy explaining the top fields do not apply to PDFs, or optional “apply search fields to all PDF rows” control. |

### ISSUE-004: Inconsistent fiscal year formatting in the UI

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Content / consistency |
| **Description** | The same fiscal period appears as **2025-26** in some places (e.g. archive) and **2025-2026** in others (e.g. comparison / Irvine label). |
| **Expected** | Normalize display (e.g. always “FY 2025–26” or always four-digit years) while keeping internal keys stable. |

### ISSUE-005: Drop cap / chat rendering and accessibility

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Accessibility / content |
| **Description** | Accessibility snapshots exposed the hero lede as split text (“M unicipal”), which may confuse screen readers. Chat responses may include raw Markdown markers (e.g. `**bold**`) if not rendered. |
| **Expected** | `aria`-friendly full word for the lede; render or strip Markdown in chat output. |

### ISSUE-006: Browser automation flakiness (agent-browser)

| Field | Value |
|-------|-------|
| **Severity** | Low (tooling) |
| **Category** | Console / environment |
| **Description** | After long waits, `agent-browser snapshot` sometimes failed with “Resource temporarily unavailable (os error 35).” May be local daemon/load; not necessarily a product bug. |
| **Expected** | If reproducible in CI, file upstream or add retries; document for QA. |

---

## What worked well

- **PDF upload (API)**: San Ramon adopted budget PDF parsed in ~35s with plausible totals, bucket breakdown, and narrative (including Measure N / structural deficit themes).
- **Archive → dossier**: Fast load for cached San Ramon 2025-26; bucket detail sections readable.
- **City vs city** (cached peer): San Ramon vs Irvine (FY 2025-2026) returned a full comparison table quickly.
- **Q&A**: Answered in plain language and surfaced budget themes (e.g. Measure N) consistent with the dossier text.

---

## Feature ideas (backlog)

1. **Unallocated / coverage slice** — When \(\sum \text{buckets} \neq \text{totalBudget}\), show a labeled “unmapped” or “other” slice (or banner) so totals reconcile visually.
2. **Denominator toggle** — Let users switch “% of adopted budget” vs “% of extracted buckets” with a short explanation.
3. **Prefill from PDF** — Infer city, state, and fiscal year from filename or first pages (e.g. “CITY OF SAN RAMON… 2025-26”).
4. **Compare from archive** — Picker limited to cities/years already on file, with optional “scrape new city” advanced path.
5. **Long operation UX** — Progress, cancel, and timeouts for compare, scrape, PDF analyze, and chat.
6. **Export** — CSV/PNG/PDF of bucket table, comparison, and citations for meetings or reporting.
7. **Shareable links** — Deep links (`?city=…&state=…&fy=…` or report id) to reopen the same dossier.
8. **Coverage / confidence** — “Mapped $X of $Y total”; flag departments or funds the model could not map.
9. **Per-resident normalization** — Toggle to compare cities on a **per capita** basis (useful when totals differ by city size).

---

## Notes for developers

- **Backend PDF route**: `POST /api/reports/upload-pdf` with `city`, `state`, optional `fiscalYear`, and `file` (multipart) validated as PDF, max 25 MB.
- **Frontend API base**: `VITE_API_URL` or default `http://localhost:3001`.

---

## Severity reference

| Severity | Meaning |
|----------|---------|
| Critical | Blocks core workflow, data loss, or crash |
| High | Wrong or misleading numbers in primary visualizations |
| Medium | Confusing UX or long waits without feedback |
| Low | Polish, consistency, a11y, or environment-only |
