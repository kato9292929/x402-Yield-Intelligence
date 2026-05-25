# Facilitator URL 設定調査

ブランチ: `claude/replace-payto-wallet-cAOvU`
日付: 2026-05-25
対象: `lib/x402.ts` / `.env.example` / `app/api/yield/**/route.ts`

---

## 1. 現状

### `.env.example` (該当行)

```
FACILITATOR_URL=https://api.developer.coinbase.com/rpc/v1/base/facilitator
```

### `lib/x402.ts`

```ts
import type { FacilitatorConfig } from "x402/types";

const DEFAULT_PAY_TO = "0xC67d94504696960bA0f2e7C3FeE703950734c00A";
export const PAY_TO = (process.env.WALLET_ADDRESS ?? DEFAULT_PAY_TO) as `0x${string}`;

const facilitatorUrl = process.env.FACILITATOR_URL;

export const FACILITATOR: FacilitatorConfig | undefined =
  facilitatorUrl && /^https?:\/\//.test(facilitatorUrl)
    ? { url: facilitatorUrl as `${string}://${string}` }
    : undefined;
```

- `FACILITATOR_URL` 未設定または不正な URL の場合 → `FACILITATOR` は `undefined`
- `undefined` の場合 x402-next は `DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator"` を使う
  (`node_modules/x402/dist/cjs/verify/index.js:349`)

### `middleware.ts`

```ts
// Route protection is handled per-route via the withX402 wrapper in
// app/api/yield/*. This no-op middleware intentionally matches nothing.
export function middleware() {}
export const config = { matcher: [] };
```

→ ミドルウェアでは何もしていない。各 API ルートで `withX402` ラッパーが個別に保護。

### API ルートの facilitator 引き渡し状況

| ルート | facilitator 引数 | 実効 URL |
|---|---|---|
| `app/api/yield/scan/route.ts` (Base) | `FACILITATOR` (env 駆動) | env のまま → 既定 `x402.org/facilitator` |
| `app/api/yield/pool/route.ts` (Base) | `FACILITATOR` | 同上 |
| `app/api/yield/portfolio/route.ts` (Base) | `FACILITATOR` | 同上 |
| `app/api/yield/weekly/route.ts` (Base) | `FACILITATOR` | 同上 |
| `app/api/yield/*/polygon/route.ts` | **引数を省略** | 強制的に `x402.org/facilitator` |
| `app/api/yield/*/solana/route.ts` | `withX402` を使わず手動 402 レスポンス | facilitator 通らない (検証なし) |
| `app/api/yield/*/bnb/route.ts` | 手動 402 (x402-next 1.2.0 が BNB 未対応) | facilitator 通らない (検証なし) |

**不整合点**:
- Base は env 経由で切替可能、Polygon は固定 (`x402.org/facilitator`)。
- Solana / BNB は server-side で X-PAYMENT 検証が行われていない (別タスク)。

---

## 2. パッケージ仕様

### `x402-next` 1.2.0 (現在インストール中)

- npm README より引用:
  > **Deprecated (v1)** — This npm package implements x402 v1. It is **deprecated** and will only receive **security patches**. Please migrate to **v2** (`@x402/next`, `@x402/core`, `@x402/evm`, etc.).

- 対応ネットワーク (`NetworkSchema` zod enum, `node_modules/x402/dist/cjs/types/index.js:71-89`):
  ```
  abstract, abstract-testnet, base-sepolia, base, avalanche-fuji,
  avalanche, iotex, solana-devnet, solana, sei, sei-testnet,
  polygon, polygon-amoy, peaq, story, educhain, skale-base-sepolia
  ```
  → **BNB / BSC は未対応** (だから手動 402 が必要)。

- デフォルト facilitator URL は `https://x402.org/facilitator` (`useFacilitator.ts`)。
- URL は base として使われ、`/verify`, `/settle`, `/supported`, `/discovery/resources` が append される。

### `@coinbase/cdp-sdk` 1.49.2 (インストール済み)

- baseURL: `https://api.cdp.coinbase.com/platform`
- x402 facilitator エンドポイント:
  - `POST /v2/x402/verify`
  - `POST /v2/x402/settle`
  - `GET /v2/x402/supported`
  - `GET /v2/x402/discovery/resources`
- → CDP 公式 facilitator の base URL は **`https://api.cdp.coinbase.com/platform/v2/x402`** (CDP API キー JWT 認証必須)

---

## 3. `.env.example` の URL が古い問題

```
FACILITATOR_URL=https://api.developer.coinbase.com/rpc/v1/base/facilitator
```

調査結果:
- `api.developer.coinbase.com/rpc/v1/base/` ドメインは **paymaster (gas sponsorship) 用** のレガシー URL パターンで、CDP SDK の `sendUserOperation.js` のコメント例にしか出てこない。
- CDP の facilitator REST API は現在 `api.cdp.coinbase.com/platform/v2/x402` (上記参照)。
- そのまま使うと:
  1. パス構造が違うので `${url}/verify` → 404
  2. 認証ヘッダー (`createAuthHeaders`) を渡していないので 401
- → **このまま設定すると本番の Base 決済検証が壊れる**。今は env 未設定で `x402.org/facilitator` にフォールバックしているので動いているだけ。

---

## 4. facilitator の選択肢

### Option A: `x402.org/facilitator` (community 既定)

- URL: `https://x402.org/facilitator`
- 認証: 不要
- ネットワーク: Base / Solana / Polygon / Avalanche / Sei / XDC (mainnet)
- コスト: 無料 (運用は x402.rs)
- 設定方法: `FACILITATOR_URL` を未設定にする (lib/x402.ts で undefined → 内蔵 default が効く)

長所: 設定不要、無料、現在の Base/Polygon を全部カバー。
短所: コミュニティ運用なので SLA や監視は限定的。gas sponsorship なし。

### Option B: Coinbase CDP facilitator

- URL: `https://api.cdp.coinbase.com/platform/v2/x402`
- 認証: CDP API キー JWT 必須 (`createAuthHeaders` 関数)
- ネットワーク: Base / Polygon / Solana / Arbitrum / World
- コスト: 1000 tx/月 無料、以降 $0.001/tx
- gas sponsorship あり、コンプライアンスチェックあり、production SLA あり
- 設定方法:
  1. `pnpm install @coinbase/x402` (現在未インストール)
  2. `lib/x402.ts` を書き換えて `import { facilitator } from "@coinbase/x402"` を使う
     ```ts
     import { facilitator } from "@coinbase/x402";
     export const FACILITATOR = facilitator;
     ```
  3. 環境変数: `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`

長所: production-grade、gas sponsor、コンプライアンス。
短所: アカウント登録必要、追加パッケージ、$0.001/tx (1k tx 超過分)。

### Option C: 第三者 facilitator (PayAI, x402.rs 等)

- 用途特殊なので推奨しない。

---

## 5. 推奨アクション

### 短期 (今すぐ・破壊変更なし)

1. **`.env.example` の壊れた URL を削除またはコメントアウト**:
   ```diff
   - FACILITATOR_URL=https://api.developer.coinbase.com/rpc/v1/base/facilitator
   + # FACILITATOR_URL=  # 未設定で community default (x402.org/facilitator) を使用。
   + #                   # CDP facilitator を使う場合は @coinbase/x402 を導入し
   + #                   # lib/x402.ts を改修する (analyses/facilitator-investigation.md 参照)
   ```
   理由: 現状の URL は古いパス構造で、env に入れると Base ルートの検証が 404 する。

2. **Polygon ルートに `FACILITATOR` を渡して Base と挙動を揃える** (任意・小規模リファクタ):
   ```diff
   - export const GET = withX402(handler, PAY_TO, (req) =>
   + export const GET = withX402(handler, PAY_TO, (req) =>
       polygonRouteConfig(...),
   + FACILITATOR,
     );
   ```

3. README の `FACILITATOR_URL | optional` の説明を「未設定で OK、設定する場合は `@coinbase/x402` 経由のみ」に修正。

### 中期 (production リリース前)

- 想定トラフィックに応じて A / B を選ぶ:
  - 月 1000 tx 未満 + コンプライアンス必須 → **B (CDP)**
  - 月 1000 tx 未満 + 検証だけ動けば良い → **A (x402.org)** で十分
  - 高トラフィック / B2B → **B (CDP)** で SLA 確保

### 長期 (3-6 ヶ月)

- `x402-next` 1.2.0 は v1 deprecated 宣言済。
- v2 (`@x402/next`, `@x402/core`, `@x402/evm`) へ移行。
- 移行に合わせて BNB ルートも v2 が BNB サポートを追加していれば手動 402 → 標準 withX402 に置換可能か再評価。

---

## 6. 検証コマンド

```bash
# 既定 facilitator が応答するか
curl -s https://x402.org/facilitator/supported | jq

# CDP facilitator が応答するか (要 JWT)
curl -s https://api.cdp.coinbase.com/platform/v2/x402/supported \
  -H "Authorization: Bearer $CDP_JWT" | jq

# 既存の壊れた URL が 404 することを確認
curl -s -o /dev/null -w "%{http_code}\n" \
  https://api.developer.coinbase.com/rpc/v1/base/facilitator/supported
```

---

## 出典

- x402-next 1.2.0 README (deprecated 表記)
- `node_modules/x402/dist/cjs/verify/index.js:349` (`DEFAULT_FACILITATOR_URL`)
- `node_modules/x402/dist/cjs/types/index.js:71-89` (`NetworkSchema`)
- `node_modules/@coinbase/cdp-sdk/_esm/openapi-client/cdpApiClient.js:16` (`baseURL`)
- `node_modules/@coinbase/cdp-sdk/_esm/openapi-client/generated/x402-facilitator/x402-facilitator.js` (endpoints)
- https://docs.cdp.coinbase.com/x402/network-support (web search 経由)
- https://www.coinbase.com/developer-platform/discover/launches/x402facilitator-polygon
- https://www.npmjs.com/package/@coinbase/x402
- https://www.npmjs.com/package/x402-next
