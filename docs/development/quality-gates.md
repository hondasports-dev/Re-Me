# Quality gates

Re:Meの通常品質ゲートはlocalで完結させる。Application runtimeはCloudflare Worker + D1 + R2 + Queue、Convexはcutover前のlegacy rollback sourceとしてだけ保持する。

## CI

CIのQuality gatesは次を実行する。

- `pnpm lint`
- `pnpm format:check`
- `pnpm test:loop`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:convex`（legacy compatibility window中の退行検知）
- `pnpm test:worker`
- `pnpm build`

Quality gatesはlive Preview / Productionの書き込みを行わへん。

CIのEnd-to-end jobはGitHub environment `preview` のCloudflare Workerへ、そのcheckoutのrevisionをdeployする。D1 migrationを適用したあと、Playwrightのfrontendは固定Preview APIを使う。`E2E_ALLOW_FORCE_DELIVERY=1` はPreview Worker configだけに置き、Productionには置かへん。`Quality gates` と `End-to-end` がmainのrequired checksや。

## Local / Preview

- Localのschema確認: `pnpm exec wrangler d1 migrations apply re-me-local --local`
- Worker test: `pnpm test:worker`
- Preview deploy: `pnpm deploy:preview`
- Preview smoke: `/api/health`、SPA fallback、Auth0 authenticated API
- Production deploy: `pnpm deploy:production`。Human Gate後だけ

same contentのfull suiteをlocalとCIで理由なく重複させない。Critical user flowを変更したら、その画面のPlaywrightを省略せえへん。

## Verification order

```text
cheap static / owning tsconfig
→ targeted unit / Worker contract
→ D1 / R2 / Queue integration
→ required functional Playwright
→ repo-wide regression = CI Aftercare
```

Production data import、traffic cutover、Convex production deletionは品質ゲートではなく、別のHuman Gate付き運用操作や。
