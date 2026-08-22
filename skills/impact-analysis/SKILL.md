---
name: impact-analysis
description: PREPARE の inline impact summary では足りない cross-cutting / shared-state / auth-data-schema / deployment 変更だけを深掘りする補助 Skill。
---

# Impact Analysis helper

通常 task の impact は PREPARE に統合する。この Skill は次の場合だけ使う。

- cross-cutting change
- shared state / multiple callers
- auth / authorization / schema / migration の影響範囲が不明
- external write / deployment boundary が変わる
- rollback / recovery が非自明

確認観点:

- direct change surfaces
- callers / callees
- shared repository / component / Worker utility
- auth / authorization / legacy RLS / user boundary
- schema / migration / RPC / trigger
- R2 object lifecycle
- affected browser / mobile flow
- regression surface
- Cloudflare / Auth0 / Convex / legacy Supabase deployment impact
- rollback / recovery

出力は別の長大な packet にせず、PREPARE の `impact_summary`、Risk、Required Controls、Verification plan を更新する。

新しい material impact を発見したら Risk / Controls を即時再分類する。
