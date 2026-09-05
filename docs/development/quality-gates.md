# Quality gates

Re:Me の application runtime は Cloudflare Worker + D1 + R2 + Queue や。通常の品質
ゲートは local で完結し、live resource への書き込みは Preview deploy / E2E の範囲へ
限定する。

## CI

CI の Quality gates は次を実行する。

- `pnpm lint`
- `pnpm format:check`
- `pnpm test:loop`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:worker`
- `pnpm build`

Quality gates は live Preview / Production の data write を行わへん。

CI の End-to-end job は GitHub environment `preview` の Cloudflare Worker へ、その
checkout の revision を deploy する。D1 migration を適用したあと、Playwright の
frontend は固定 Preview API を使う。`E2E_ALLOW_FORCE_DELIVERY=1` は Preview Worker
config だけに置き、Production には置かへん。`Quality gates` と `End-to-end` が main の
required checks や。

## Local / Preview

- Local schema: `pnpm exec wrangler d1 migrations apply re-me-local --local`
- Unit: `pnpm test:unit`
- Worker / D1 / R2 / Queue: `pnpm test:worker`
- Preview deploy: `pnpm deploy:preview`
- Preview smoke: `/api/health`、SPA fallback、Auth0 authenticated API
- Production deploy: `pnpm deploy:production`。Human Gate 後だけ

same content の full suite を local と CI で理由なく重複させない。critical user flow
を変更したら、その画面の Playwright を省略せえへん。

## Verification order

```text
cheap static / owning tsconfig
→ targeted unit / Worker contract
→ D1 / R2 / Queue integration
→ required functional Playwright
→ repo-wide regression = CI Aftercare
```

Production data import、traffic cutover、外部 resource の停止・削除は品質ゲートでは
なく、対象を限定した別の Human Gate 付き運用操作や。
