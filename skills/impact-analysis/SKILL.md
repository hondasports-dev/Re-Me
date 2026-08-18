---
name: impact-analysis
description: R2-R4 または risk 再評価が必要な変更で、caller/callee、shared state、auth/data/schema、UI flow、deploy 影響を確認する。
---

# Impact Analysis

R0 は NOT_REQUIRED、R1 は Requirements の impact summary で代替。R2-R4 は separate Gate。

確認観点:

- direct change surfaces
- callers / callees
- shared composable / repository / component / Worker utility
- Supabase Auth / RLS / user boundary
- schema / migration / RPC / trigger
- R2 / object lifecycle
- affected mobile UI / browser flows
- regression tests
- Cloudflare / Supabase deployment impact
- rollback / recovery

新しい auth / data / schema / external write impact を発見したら Risk を即時再分類する。
