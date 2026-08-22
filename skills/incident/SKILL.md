---
name: incident
description: Verification、Review、CI、E2E、外部サービスで FAIL/BLOCKED や同一失敗の反復が起きたとき、Root Cause を切り分ける。
---

# Incident / Root Cause Loop

自動 trigger:

- required Verification FAIL / BLOCKED
- 同じ test / command が2回同じ理由で失敗
- review finding が再発
- CI / E2E failure 原因不明
- local と CI / production-like env の結果が異なる
- env / auth / Cloudflare / Auth0 / Convex / legacy Supabase が原因で Gate を進めない

`BLOCKED` は `DONE` ではない。「理由を PR に書いて次へ進む」を回避策にしない。

## 手順

1. 事実を固定する。症状と推測を混ぜない。
2. failure domain を分類する。
3. 可能なら base / control と比較する。
4. 独立仮説を3つ作る。1つは前提自体が誤りの可能性を含める。
5. 最小の falsifying check を1つ実行する。
6. Root Cause または explicit blocker を確定する。
7. 修正後、無効になった Gate へ戻る。

Secret / PII を調査ログへ転記しない。

Incident 解消は Process Learning Event とする。
