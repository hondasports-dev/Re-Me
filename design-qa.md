# Re:Me design QA

## Comparison target

- Implementation state: authenticated local dev at `http://127.0.0.1:4173` using the configured shared Preview Convex connection; the deployed check also used `https://re-me-preview.hondasports.workers.dev`
- Source visual truth: `docs/design/concept.png` and the documents under `docs/design/`
- Login comparison input (kept unchanged in this iteration): prior QA capture, not part of this diff
- Authenticated focused comparison inputs: `docs/design/qa/compose-v2-comparison.png`, `docs/design/qa/inbox-v2-comparison.png`, and `docs/design/qa/traveling-v2-comparison.png`
- Authenticated all-screen comparison input: `docs/design/qa/all-screens-v3-comparison.png`
- Authenticated implementation captures: the 12 mobile captures embedded in the committed all-screen comparison, covering inbox, compose, delivery confirmation, send ritual, traveling list/detail, sealed arrival, read, reply, thread, and settings.
- Implementation state: authenticated local dev at `http://127.0.0.1:4173` using the configured shared Preview Convex connection; the deployed check also used `https://re-me-preview.hondasports.workers.dev`
- Viewport: CSS `390 x 844`, browser screenshot `390 x 844`, device scale factor `1`
- Source pixels: full board `1672 x 941`; landing phone crop `202 x 456`
- Density normalization: browser chrome and source board chrome were excluded; the landing crop was scaled into the comparison canvas at the implementation viewport size. The implementation screenshot is the app viewport only.

## Evidence

- Full-view comparison: `all-screens-v3-comparison.png` places the full source board and all 12 authenticated implementation captures in one comparison input. The login source comparison remains the accepted baseline and was not changed.
- Focused region comparison: toolbar hierarchy, paper/row/card density, tabs, envelope/planet/plane artwork, sealed treatment, floating write action, and bottom navigation were checked. Read, reply, thread, and settings were checked for the same shell/token treatment; the source board has no dedicated settings or thread phone crop.
- Browser console: no `warn` or `error` entries were captured after the final authenticated reload.
- Primary interactions: anonymous redirect/login shell, 320 px overflow guard, compose/send, autosave, private photo, sealed open boundary, unsealed read, reply-to-future, one-path thread, PWA/settings, delete, and the all-screen capture flow were exercised by Playwright: `14 passed`, `1 skipped` (Google OAuth smoke).

## Required fidelity surfaces

- Fonts / typography: display and headings use the Re:Me sans stack with lighter brand weight, readable Japanese fallback, tightened hierarchy, and antialiasing. Existing Mantine heading token contract remains serif-compatible; feature headings opt into the visual sans treatment.
- Spacing / layout: the guest shell remains edge-to-edge on mobile; authenticated routes use a compact iOS-style toolbar, centered screen title, source-like tab/card rhythm, safe-area-aware padding, and a floating write action. Detail/compose routes hide the footer visually while retaining the keyboard-reachable nav contract in the DOM.
- Colors / tokens: navy, mist, sky, glass, gradient CTA, borders, radii, and shadows are centralized in `src/styles/tokens.css` and applied through the Mantine theme/shell.
- Image quality / asset fidelity: the source's blue-white, time-spanning atmosphere is represented with generated, text-free hero, envelope, paper-plane, and planet assets; the decorative assets are blended with `screen` so their dark generation backgrounds do not become visible rectangles. Functional icons remain semantic inline SVGs.
- Copy / content: product-source requirements keep the login action as `Googleで続ける` (social login / Google-first MVP), while the source board's `手紙を書く` label is treated as an intentional pre-auth concept deviation.
- Icons / controls: existing semantic icon components and Mantine controls are retained; CTA/focus states use the shared blue gradient and visible keyboard outline.
- Responsiveness / accessibility: 320 px anonymous E2E has no horizontal overflow; focus-visible outlines, reduced-motion hooks, semantic headings/buttons, and empty image alt text are preserved.

## Findings

- `[P1]` Authenticated screens used a generic Re:Me header/card rhythm instead of the source toolbar and dense mobile composition. Resolved by route-aware compact chrome, tabs, cards, and art on compose/inbox/traveling/detail flows.
- `[P2]` Delivery confirmation CTA fell below the 390 px viewport. Resolved by tightening fieldset, seal, and confirmation spacing.
- `[P2]` Sealed opening card could introduce a page scrollbar and settings had excessive empty card height. Resolved by mobile min-height and compact settings treatment.
- `[P2]` Compose, reply, inbox, traveling, thread, and settings repeated the toolbar title inside the content area, pushing the source-like paper, tabs, and cards too far below the fold. Resolved by making the compact toolbar the page heading and removing repeated content headings while retaining accessible region names and live save status.
- No actionable P0/P1/P2 findings remain after the final all-screen comparison.

## Comparison history

1. Initial comparison at `390 x 844`: `[P2]` the login hierarchy was bottom-anchored, putting the brand and copy materially lower than the source landing panel. Fixed with the `.auth-panel--login` top-start layout and an auto-pushed CTA; recaptured at the same viewport in `re-me-design-login-comparison.png`.
2. Second comparison: `[P2]` the lower hero region was too dark to preserve the source's blue-white horizon. Fixed by reducing the guest shell/panel overlay opacity; recaptured at the same viewport in `re-me-design-login-comparison.png`.
3. Authenticated comparison: `[P2]` the fixed AppShell header/footer layering was being reset by the shell z-index helper, and compose content could sit under the header. Fixed by preserving Mantine's fixed header/footer positioning and adding header-aware main padding (including the compose override); recaptured compose/inbox/traveling/sealed-open/reply/thread/settings at the same viewport.
4. Final comparison: no P0/P1/P2 differences requiring another iteration.
5. User-requested authenticated design pass at `390 x 844`: `[P1]` generic authenticated chrome and sparse cards did not match the source board outside login. Resolved with compact route-aware toolbars, source-like tabs, envelope/plane/planet cards, paper controls, sealed opening treatment, and consistent detail shell. Rechecked all affected screens and recorded the v2 comparison inputs above.
6. All-screen pass at `390 x 844`: `[P2]` repeated in-content page titles reduced usable space and diverged from the source's compact toolbar-first hierarchy. Removed the repetitions, expanded the compose/reply paper, renamed the send toolbar to `配送の確認`, and recaptured all 12 screens in `all-screens-v3-comparison.png`.

## Open questions

- Authenticated visual captures and full E2E evidence use the shared Preview Convex connection because a task-local Convex deployment is not provisioned in this worktree.
- If a final approved hero/envelope asset becomes available, it can replace the generated assets without changing the layout contract.

## Implementation checklist

- [x] Match the mobile landing/splash atmosphere and hierarchy.
- [x] Centralize the blue-white/glass visual tokens and Mantine control treatment.
- [x] Apply card, sealed-opening, send-ritual, timeline, and navigation styling to the affected features.
- [x] Capture and compare the rendered login and authenticated mobile screens at `390 x 844`.
- [x] Run static/unit/worker/loop checks and anonymous mobile Playwright coverage.
- [x] Run authenticated visual/E2E coverage with the configured Preview Auth0 + Convex runtime.
- [x] Capture every user-facing screen in the core flow and compare them together with the source board.

## Follow-up polish

- P3: replace generated imagery with the product-approved source artwork if/when the asset pipeline provides it.

final result: passed
