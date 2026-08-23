## 概要

<!-- 何を変更したか / なぜ変更したか -->

## 関連 Issue

Closes #

## Spec / Risk

- Spec Confidence: `C1 / C2`
- Risk Level: `R0 / R1 / R2 / R3 / R4`
- Profile: `trivial / fast / standard / high / critical`

### Issue / 仕様との差分

なし

<!-- 差分がある場合: 何を変えたか / 理由 / source reconciliation の結果 -->

## 変更内容

- 

## 影響範囲

- [ ] UI / mobile
- [ ] Worker / health
- [ ] Auth0 / Convex auth
- [ ] Convex schema / functions
- [ ] Legacy PostgreSQL / RLS（比較用）
- [ ] Cloudflare R2
- [ ] PWA / Push
- [ ] CI / Deploy
- [ ] Agent process / docs
- [ ] 影響なし

## Verification Evidence

### Local / targeted

- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:convex`（schema / authorization 変更時）
- [ ] `pnpm build`
- [ ] 変更した画面 / 遷移を踏む Playwright
  踏んだ path:
  結果: `PASS / BLOCKED`
- [ ] Legacy DB / RLS test（SQL / migration 差分がある場合。通常 test ではない）
- [ ] Worker / R2 test（該当する場合）

結果 / 実行範囲:

### 未実行 check

なし

<!-- required check を未実施のまま NOT_REQUIRED / PASS 扱いにしない。credential 不足は BLOCKED。 -->

## Review Evidence

- Code Review: `PASS / NOT_REQUIRED`
- Security quick scan: `PASS / ESCALATE / NOT_REQUIRED`
- Security Review: `PASS / NOT_REQUIRED`

Must-fix / residual risk:

## UI 変更

なし

<!-- ある場合は mobile screenshot / visual reference との差を示す -->

## 運用への影響

- DB schema / migration: なし
- RLS / auth: なし
- 環境変数 / Secret: なし
- Cloudflare / Auth0 / Convex 設定変更: なし
- Deploy 手順変更: なし

## 最終確認

- [ ] Acceptance Criteria を満たしている
- [ ] scope 外変更がない
- [ ] 必要な Verification を実行した
- [ ] 必要な docs / ADR / migration を更新した
- [ ] secret / local artifact を含んでいない
- [ ] PR 作成後は Aftercare を継続する
