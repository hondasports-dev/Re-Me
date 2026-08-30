# Re:Me design QA

## Comparison target

- Source visual truth: `C:\Users\tatsuya\Documents\sourcecode\Re-Me-design-alignment\docs\design\concept.png`
- Source landing crop: `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-reference-landing.png`
- Side-by-side comparison input: `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-login-comparison.png`
- Implementation screenshot: `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-login-mobile.png`
- Authenticated implementation captures: `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-compose-mobile.png`, `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-inbox-mobile.png`, `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-traveling-mobile.png`, `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-sealed-open-mobile.png`, `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-reply-mobile.png`, `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-thread-mobile.png`, and `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-settings-mobile.png`
- Authenticated focused comparison inputs: `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-compose-comparison.png`, `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-inbox-comparison.png`, and `C:\Users\tatsuya\.codex\visualizations\2026\08\30\re-me-design-traveling-comparison.png`
- Implementation URL / state: `http://127.0.0.1:4174/login`, unauthenticated, light theme, idle state
- Viewport: CSS `390 x 844`, browser screenshot `390 x 844`, device scale factor `1`
- Source pixels: full board `1672 x 941`; landing phone crop `202 x 456`
- Density normalization: browser chrome and source board chrome were excluded; the landing crop was scaled into the comparison canvas at the implementation viewport size. The implementation screenshot is the app viewport only.

## Evidence

- Full-view comparison: the side-by-side input compares the first landing/splash panel from the source board with the rendered `/login` screen. Both preserve the quiet blue night-to-horizon atmosphere, centered Re:Me identity, subtitle/copy hierarchy, and bottom CTA placement.
- Focused region comparison: the brand block (`Re:Me`, `未来のあなたへ`, supporting copy) and the CTA were checked at the same 390 px content width. The compose, inbox, and traveling phone crops were also compared against the authenticated captures in the three focused comparison inputs above. Settings has no corresponding source-board phone; it was checked for the same shell/card/token treatment.
- Browser console: no `warn` or `error` entries were captured after reload.
- Primary interactions: anonymous `/` redirect to `/login`, login CTA visibility, 320 px overflow guard, and callback error redaction were exercised by Playwright. The local Auth0 setup was attempted first and timed out because this worktree has no local `VITE_AUTH0_*` / `VITE_CONVEX_URL` runtime configuration. The same authenticated suite was then run against the configured shared Preview connection (without printing or saving those values): `13 passed`, `1 skipped` (Google OAuth smoke), including compose, inbox, traveling, sealed-open, reply, PWA, session, and thread flows.

## Required fidelity surfaces

- Fonts / typography: display and headings use the Re:Me sans stack with lighter brand weight, readable Japanese fallback, tightened hierarchy, and antialiasing. Existing Mantine heading token contract remains serif-compatible; feature headings opt into the visual sans treatment.
- Spacing / layout: the guest shell is edge-to-edge on mobile; the brand block is anchored near the upper third and the CTA remains in the lower action zone without overflow. App screens receive the larger card rhythm, safe-area-aware padding, and a floating write action.
- Colors / tokens: navy, mist, sky, glass, gradient CTA, borders, radii, and shadows are centralized in `src/styles/tokens.css` and applied through the Mantine theme/shell.
- Image quality / asset fidelity: the source's blue-white, time-spanning atmosphere is represented with generated, text-free hero and envelope assets; the envelope is blended with `screen` so its dark generation background does not become a visible rectangle. No inline SVG/CSS drawing replaces the reference imagery.
- Copy / content: product-source requirements keep the login action as `Googleで続ける` (social login / Google-first MVP), while the source board's `手紙を書く` label is treated as an intentional pre-auth concept deviation.
- Icons / controls: existing semantic icon components and Mantine controls are retained; CTA/focus states use the shared blue gradient and visible keyboard outline.
- Responsiveness / accessibility: 320 px anonymous E2E has no horizontal overflow; focus-visible outlines, reduced-motion hooks, semantic headings/buttons, and empty image alt text are preserved.

## Findings

- No actionable P0/P1/P2 findings remain after the final comparison.

## Comparison history

1. Initial comparison at `390 x 844`: `[P2]` the login hierarchy was bottom-anchored, putting the brand and copy materially lower than the source landing panel. Fixed with the `.auth-panel--login` top-start layout and an auto-pushed CTA; recaptured at the same viewport in `re-me-design-login-comparison.png`.
2. Second comparison: `[P2]` the lower hero region was too dark to preserve the source's blue-white horizon. Fixed by reducing the guest shell/panel overlay opacity; recaptured at the same viewport in `re-me-design-login-comparison.png`.
3. Authenticated comparison: `[P2]` the fixed AppShell header/footer layering was being reset by the shell z-index helper, and compose content could sit under the header. Fixed by preserving Mantine's fixed header/footer positioning and adding header-aware main padding (including the compose override); recaptured compose/inbox/traveling/sealed-open/reply/thread/settings at the same viewport.
4. Final comparison: no P0/P1/P2 differences requiring another iteration.

## Open questions

- The local-only Auth0/Convex setup remains unavailable in this task worktree; authenticated visual captures and full E2E evidence therefore use the configured shared Preview connection. Re-run against local Convex when a task-local development deployment is provisioned.
- If a final approved hero/envelope asset becomes available, it can replace the generated assets without changing the layout contract.

## Implementation checklist

- [x] Match the mobile landing/splash atmosphere and hierarchy.
- [x] Centralize the blue-white/glass visual tokens and Mantine control treatment.
- [x] Apply card, sealed-opening, send-ritual, timeline, and navigation styling to the affected features.
- [x] Capture and compare the rendered mobile screen at `390 x 844`.
- [x] Run static/unit/worker/loop checks and anonymous mobile Playwright coverage.
- [x] Run authenticated visual/E2E coverage with the configured Preview Auth0 + Convex runtime.

## Follow-up polish

- P3: replace generated imagery with the product-approved source artwork if/when the asset pipeline provides it.

final result: passed
