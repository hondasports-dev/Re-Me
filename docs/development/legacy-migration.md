# Legacy data migration

この文書は [Issue #30](https://github.com/hondasports-dev/Re-Me/issues/30) の legacy Supabase mapping 記録や。現在のapplication runtimeの正本はCloudflare Worker + D1 + R2 + Queueで、`convex/` と `supabase/migrations/` はrollback window中のlegacy source / 比較資料として保持する。Convex exportからD1へ実際に移す手順は [convex-d1-migration.md](convex-d1-migration.md) を正とする。

Production data の export / import / 削除、credential の破棄は **Human Gate** なしに実行しない。実装の手順を読んでも、承認前に production へ書き込まない。

## 棚卸し（2026-08-29）

| 対象 | 状態 | 判断 |
|---|---|---|
| Production Auth0 / legacy Convex | [Issue #38](https://github.com/hondasports-dev/Re-Me/issues/38) が未着手 | Auth0 PROD / Convex export は未準備 |
| Production Worker / D1 / R2 / Queue | resource は作成済み、schemaのみ適用 | **import 対象テーブルの production 行は合計 0** |
| git の `supabase/migrations/` | schema / RLS / RPC のみ | dump はリポジトリに無い |
| git の production dump / CSV | 無し | 秘密の dump を commit しない |
| 共有 Preview Convex | CI E2E 用 | **移行元にしない**。E2E データは破棄してよい |
| local Convex / local Supabase | 開発者マシン依存 | 移行元にしない。必要なら各自が破棄 |

**Migration necessity:** `no_production_import`。Worker runtimeへのfeature移行は完了しているが、Convex production exportがまだ無く、実データimportは未実施や。残作業は (1) Convex→D1 mapping とrollbackを固定する (2) export取得後にこのrunbookで再棚卸しする (3) cutover後のrollback windowを終えてからlegacy artifactを片付ける。

後から production dump や live production 行が見つかったら `import_required` に切り替え、下の mapping で dry-run する。判定は **dump の有無、または全 import 対象テーブル（`LEGACY_PUBLIC_TABLES` + `LEGACY_PRIVATE_TABLES`）の合計行数** で行う。user / letter が 0 でも orphan の `letter_contents` 等があれば省略しない。`#38` の production stack が未作成でも、live 行が 1 件以上あれば import を省略しない。判定ヘルパーは `countImportTargetRows` と `decideMigrationNecessity`。

## Mapping

### Identity

```text
legacy auth.users.id (uuid)
  → Auth0 user (PROD issuer + sub)
  → Convex users.tokenIdentifier
  → Convex users._id （ドメイン所有権）
```

- Auth0 `sub` / email を `threads.ownerId` などへ直接保存しない
- `tokenIdentifier` は Convex Auth0 identity と同じ `${issuer}|${sub}`（issuer の末尾 `/` は落とす）
- Google と Auth0 database user が同一人物でも、移行ジョブは **手動の identity map ファイル** を正とする。推測でマージしない
- map に無い legacy user の行は import せず `orphan_unmapped_user` として記録する

### Domain

| legacy | Convex | 注意 |
|---|---|---|
| `public.threads` | `threads` | `user_id` → `ownerId`。`deleted_at` を維持 |
| `public.letters` | `letters` | UUID → 新規 Convex id。map を保持して FK を張り直す |
| `parent_letter_id` | `parentLetterId` | 一本道。同一 parent に 2 子があれば停止（`branching_thread_unsupported`） |
| （legacy に無し） | `nextLetterId` | `parent_letter_id` の逆引きで復元 |
| `public.letter_contents` | `letterContents` | body は private import 経路だけ。public query の契約は変えない |
| `public.user_settings` | `userSettings` | timezone / push / email flag |

未対応 / orphan:

- `letters` に contents が無い
- contents の letter が無い
- 削除済み letter の contents が残っている
- `nextLetterId` が指す letter が deleted でも、現行どおり「無い」扱い（runtime の reply 契約に合わせる）

### Attachments / R2

| legacy | Convex |
|---|---|
| `kind = location` + `location_label` | `letterAttachments.kind = location` |
| `kind = photo` + `r2_key` | object を **DEV/Preview ではない** 移行先 bucket へ copy したあと `r2ObjectId` を設定 |
| `kind = photo` かつ `r2_key is null` | orphan。import しない |

- 移行先 R2 は `#38` の production bucket。DEV / Preview bucket に production 写真を入れない
- copy は staging object → 検証 → cutover prefix（例: `migration/{cutoverId}/`）配下の immutable final key。既存 finalize 契約を流用する
- コピーした key の inventory ファイル（git に入れない）を残し、rollback / 孤立 object の削除対象にする
- EXIF なし JPEG の現行検証を再実行する。失敗行は orphan

### Schedule / notifications

| legacy | Convex | 注意 |
|---|---|---|
| `private.letter_delivery.scheduled_at` | `letterDeliveries.scheduledAt`（epoch ms） | export は offset 付き timestamptz。offset 無しは拒否する |
| delivery window columns | そのまま metadata | **exact `scheduledAt` は public return に出さない** |
| `private.notification_jobs` | `notificationJobs` | generation token は新規発行。legacy claim token を再利用しない |

- 移行中に due な traveling は、import 後の cron に任せる。二重配送しないよう `letterDeliveries.status` と `letters.status` を同じ snapshot から書く
- push endpoint / p256dh / auth は本人 map が取れた行だけ。log に出さない

### Idempotent import

1. identity map を先に確定し、checksum する
2. threads → letters → contents → deliveries → attachments → jobs の順
3. 各 legacy UUID に対する Convex id を `migrationImportKeys` 相当の **作業用 map ファイル**（git に入れない）へ保存する
4. 再実行は map 済み id を skip する。partial 失敗は残件だけ retry
5. public Convex function を import に使わない。internal mutation または one-off を別 PR で足す

## Dry-run（non-production）

Production へ向けない。local または専用の空 Convex で再現する。

```text
1. pnpm db:start && pnpm db:reset
2. 合成 fixture（本番データではない）を local Postgres へ入れる
3. identity map を fixture の Auth0 DEV issuer で作る
4. local Convex へ internal import を dry-run（書き込み先は local のみ）
5. checksumDrift(source, imported) が空であることを確認する
6. pnpm test:convex の authorization / sealed / scheduledAt テストを再実行する
7. ブラウザ向け query の JSON に scheduledAt / letter body（未開封 sealed）が無いことを確認する
```

現時点では production 行が 0 なので、cutover 前の必須は手順の固定と mapping テストである。live Docker dry-run は operator が local で行う。CI は mapping helper の unit test で回帰を止める。

Preview Convex への dry-run import は **しない**（E2E を壊す）。

## 検証

import 後に少なくとも次を数える。

- users / threads / letters / letterContents / letterDeliveries
- photo attachments that still have an object
- sealed traveling で readable content が 0
- sealed delivered + unopened で readable content が 0
- public payload に `scheduledAt` が 0 件

認可は既存の `tests/convex/authorization.test.ts` と同等のケースを、移行後データに対して再実行する。

## Rollback

dry-run / rehearsal:

- local Convex の対象 deployment を破棄して作り直す
- copy した rehearsal R2 prefix を削除する
- identity map ファイルを破棄する

production（Human Gate 後のみ）:

1. cutover 前に Convex export と、既存 production R2 の inventory を取る
2. 失敗したら **新しい Convex production を捨てて、export から戻す**。部分 import の上に再実行しない
3. 同じ Human Gate で、今回 copy した cutover prefix（または copy inventory の key）だけを production bucket から削除する。import 途中失敗で Convex 参照が無くなった写真を残さない。既存 production object は消さない
4. Auth0 PROD のユーザー作成は rollback できないことがある。data 側を戻しても login だけ残る場合は記録する
5. rollback window が終わるまで `supabase/` と legacy secret を消さない

## Cleanup vs 保持

**cutover 成功 + rollback window 終了 + Human Gate まで保持:**

- `supabase/migrations/`
- `supabase/config.toml`
- `supabase/README.md`
- この文書

**window 後に削除してよい（別 PR + Human Gate）:**

- unused Supabase project / secret
- 移行用 map ファイル（秘密）
- obsolete operational 文（この文書を archive してから）

**消さない:**

- `convex/schema.ts` と認可テスト
- Preview / production の分離手順（`preview-environment.md`）

## Human Gate

明示承認が必要:

- Production export / import
- Production data mutation
- legacy Production data deletion
- irreversible credential / project deletion

不要:

- local schema compare（`pnpm db:start`）
- mapping unit test
- この文書の更新

`requiresHumanGate()` が true の操作を Agent が単独で実行しない。
