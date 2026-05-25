# x402 Yield Intelligence

> Solana DeFi smart-money yield intelligence, paid per request via x402.
> Solana DeFi のスマートマネー利回りインテリジェンス。x402 でリクエスト課金。

[English](#english) ・ [日本語](#日本語)

---

## English

### Overview

**x402 Yield Intelligence** is a Next.js 15 application that tracks where
*smart money* is allocating capital across Solana DeFi pools (Kamino, Drift,
Jupiter Lend, Marinade, Jito) using Nansen positioning data, and uses Claude
to analyze optimal yield strategies. Every analysis endpoint is monetized
per request through the [x402](https://x402.org) payment protocol, with
multi-chain payment support across Solana, Base, Polygon and BNB Chain.

### Features

- **Four x402-protected API routes** — pay-per-call, with multi-chain
  sub-routes for Solana, Base, Polygon and BNB Chain.
- **Smart-money tracking** — Nansen smart-money positions overlaid onto a
  curated pool baseline.
- **Claude analysis** — optimal allocation, pool deep-dives, portfolio
  rebalancing, and a weekly intelligence report.
- **Resilient by design** — best-effort live data with a curated baseline
  fallback, so the product works even without API keys.
- **Landing page** — live stats, pool cards, a multi-chain payment
  selector, and wallet connection (EVM via RainbowKit, Solana via Phantom /
  Solflare).

### API Routes

| Route | Method | Price | Description |
|---|---|---|---|
| `/api/yield/scan` | GET | $0.20 | Top 10 pools by smart-money inflow + APY score, with Claude allocation analysis |
| `/api/yield/pool` | POST | $0.30 | Deep analysis of one pool: APY history, IL risk, smart-money history |
| `/api/yield/portfolio` | POST | $0.50 | Wallet position analysis + rebalancing recommendations |
| `/api/yield/weekly` | GET | $2.00 | Weekly Solana DeFi yield intelligence report (~2000 chars) |

**Request bodies**

- `POST /api/yield/pool` — `{ "protocol": string, "pool": string }`
- `POST /api/yield/portfolio` — `{ "walletAddress": string, "riskTolerance": "LOW" | "MEDIUM" | "HIGH" }`

Unprotected requests return HTTP `402` with x402 payment requirements.

### Multi-chain Payment Support

Each of the four endpoints is also exposed as chain-specific sub-routes so
callers can pay on their preferred chain. The original `route.ts` keeps
serving Base USDC unchanged; the sub-routes add Solana, Polygon and BNB.

| Chain | Sub-route (scan example) | Token(s) | x402 implementation |
|---|---|---|---|
| Base (default) | `/api/yield/scan` | USDC | `withX402` |
| Solana | `/api/yield/scan/solana` | USDC | manual `402` |
| Polygon | `/api/yield/scan/polygon` | USDC · JPYC | `withX402` |
| BNB Chain | `/api/yield/scan/bnb` | USDT | manual `402` |

The same `/solana`, `/polygon`, `/bnb` sub-routes exist for `pool`,
`portfolio` and `weekly`.

**Tokens & contracts**

| Chain | Token | Contract |
|---|---|---|
| Solana | USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Base | USDC | native USDC on Base |
| Polygon | USDC | native USDC on Polygon |
| Polygon | JPYC | `0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB` |
| BNB Chain | USDT | `0x55d398326f99059fF775485246999027B3197955` |

- **Polygon JPYC** — Polygon routes advertise both USDC and JPYC as
  `accepts` options in their v2 402 response; the client picks which to
  settle in (no query-param needed).
- **Solana & BNB Chain** use a manual `402` response: `@x402/svm` is not
  installed, and neither the CDP nor the community facilitator settles
  BNB Chain (chain ID 56). Clients receive a v1-shaped 402 with payment
  instructions but the server does not verify settlement.

**Chain selector UI** — the landing page includes a chain/token selector
(default Solana) that builds the matching endpoint URL live. JPYC is shown
disabled on Solana, and a banner explains the single-token chains. Wallet
connection is wired in: RainbowKit for EVM chains and Phantom / Solflare for
Solana. The Solana providers load as a client-only island (`ssr: false`) so
page SSR is preserved.

### Data Sources

| Source | Endpoint | Auth |
|---|---|---|
| Nansen Smart Money | `api.nansen.ai/defi/smart-money/positions?chain=solana` | `x-api-key` |
| Kamino | `api.kamino.finance/strategies` | none |
| Drift | `mainnet-beta.api.drift.trade/stats` | none |
| Jupiter Price | `price.jup.ag/v6/price` | none |

All sources are fetched best-effort with timeouts; a curated baseline keeps
the app functional if any source is unreachable.

### Getting Started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run build
npm start                    # production
# or
npm run dev                  # development
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NANSEN_API_KEY` | optional | Nansen API key for live smart-money data |
| `ANTHROPIC_API_KEY` | optional | Claude API key for AI analysis |
| `WALLET_ADDRESS` | optional | EVM address that receives x402 payments (Base / Polygon / BNB). Defaults to the bundled production wallet `0xC67d…00A` |
| `SOLANA_WALLET_ADDRESS` | **yes** (Solana) | Solana (base58) address that receives Solana USDC payments |
| `CDP_API_KEY_ID` | **yes** (production) | Coinbase Developer Platform API key ID — required to authenticate against the CDP facilitator |
| `CDP_API_KEY_SECRET` | **yes** (production) | Coinbase Developer Platform API key secret |
| `FACILITATOR_URL` | optional | x402 facilitator URL. When `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` are set, defaults to `https://api.cdp.coinbase.com/platform/v2/x402` (Coinbase CDP). Otherwise defaults to the community facilitator `https://x402.org/facilitator` |
| `HELIUS_RPC_URL` | optional | Solana RPC URL (server-side) |
| `NEXT_PUBLIC_HELIUS_RPC_URL` | optional | Solana RPC URL for the browser wallet connection (falls back to public mainnet RPC) |
| `BNB_RPC_URL` | optional | BNB Chain RPC URL |
| `NEXT_PUBLIC_JPYC_CONTRACT` | optional | JPYC token contract on Polygon (defaults to the canonical address) |
| `NEXT_PUBLIC_USDT_BNB_CONTRACT` | optional | USDT token contract on BNB Chain |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | optional | WalletConnect project ID |

Without `NANSEN_API_KEY` / `ANTHROPIC_API_KEY` the app falls back to a
curated baseline and deterministic analysis. Without `WALLET_ADDRESS` the
x402 `payTo` defaults to the bundled production wallet. Without
`CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` the app talks to the community
facilitator at `x402.org/facilitator`; set both to use the production-SLA
Coinbase CDP facilitator with gas sponsorship.

### Tech Stack

Next.js 15.5.9 · React 19 · `@x402/next` 2.13 · `@x402/core` · `@x402/evm`
· `@coinbase/x402` · `@anthropic-ai/sdk` · viem ·
wagmi · RainbowKit · TanStack Query · Solana wallet-adapter (Phantom /
Solflare) · `@solana/web3.js`.

### Deployment

Deploy to Vercel and set all environment variables from `.env.example` in
the project settings.

### Disclaimer

This tool is for informational purposes only. DeFi investing carries risk.
Make your own investment decisions.

---

## 日本語

### 概要

**x402 Yield Intelligence** は、Solana DeFi の各プール（Kamino・Drift・
Jupiter Lend・Marinade・Jito）に *スマートマネー* がどこへ資金を入れている
かを Nansen のポジションデータで取得し、Claude が最適な利回り戦略を分析する
Next.js 15 アプリケーションです。すべての分析エンドポイントは
[x402](https://x402.org) 決済プロトコルでリクエスト単位の課金が行われ、
Solana・Base・Polygon・BNB Chain のマルチチェーン決済に対応しています。

### 特徴

- **x402 保護された 4 つの API ルート** — リクエスト課金。Solana・Base・
  Polygon・BNB Chain のマルチチェーン用サブルートを提供。
- **スマートマネー追跡** — Nansen のスマートマネーポジションを、厳選した
  プールのベースラインに重ね合わせ。
- **Claude による分析** — 最適配分、プール詳細分析、ポートフォリオの
  リバランス提案、週次インテリジェンスレポート。
- **堅牢な設計** — ライブデータはベストエフォートで取得し、取得できない
  場合は厳選したベースラインにフォールバック。API キーなしでも動作します。
- **ランディングページ** — ライブ統計・プールカード・マルチチェーン決済
  セレクター・ウォレット接続（EVM は RainbowKit、Solana は Phantom /
  Solflare）。

### API ルート

| ルート | メソッド | 料金 | 説明 |
|---|---|---|---|
| `/api/yield/scan` | GET | $0.20 | スマートマネー流入と APY スコアによる上位 10 プール + Claude の配分分析 |
| `/api/yield/pool` | POST | $0.30 | 特定プールの詳細分析（APY 推移・変動損失リスク・スマートマネー履歴） |
| `/api/yield/portfolio` | POST | $0.50 | ウォレットのポジション分析 + リバランス提案 |
| `/api/yield/weekly` | GET | $2.00 | Solana DeFi 週次イールドレポート（約 2000 字） |

**リクエストボディ**

- `POST /api/yield/pool` — `{ "protocol": string, "pool": string }`
- `POST /api/yield/portfolio` — `{ "walletAddress": string, "riskTolerance": "LOW" | "MEDIUM" | "HIGH" }`

未決済のリクエストには x402 の支払い要件とともに HTTP `402` を返します。

### マルチチェーン決済対応

4 つのエンドポイントは、利用者が任意のチェーンで支払えるよう、チェーン別の
サブルートとしても公開されています。既存の `route.ts` は Base USDC のまま
変更せず、サブルートで Solana・Polygon・BNB を追加しています。

| チェーン | サブルート（scan の例） | トークン | x402 実装 |
|---|---|---|---|
| Base（デフォルト） | `/api/yield/scan` | USDC | `withX402` |
| Solana | `/api/yield/scan/solana` | USDC | 手動 `402` |
| Polygon | `/api/yield/scan/polygon` | USDC・JPYC | `withX402` |
| BNB Chain | `/api/yield/scan/bnb` | USDT | 手動 `402` |

`pool`・`portfolio`・`weekly` にも同じ `/solana`・`/polygon`・`/bnb`
サブルートがあります。

**トークンとコントラクト**

| チェーン | トークン | コントラクト |
|---|---|---|
| Solana | USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Base | USDC | Base ネイティブ USDC |
| Polygon | USDC | Polygon ネイティブ USDC |
| Polygon | JPYC | `0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB` |
| BNB Chain | USDT | `0x55d398326f99059fF775485246999027B3197955` |

- **Polygon JPYC** — Polygon のルートは v2 の `accepts` に USDC と JPYC
  の両方を含めて 402 を返すため、クライアント側で決済通貨を選択します
  （クエリパラメータでの切替は不要）。
- **Solana・BNB Chain** は手動 `402` レスポンスを使用します。`@x402/svm`
  は未導入で、CDP / コミュニティのいずれの facilitator も BNB Chain
  (chain ID 56) を決済対象としないためです。クライアントは v1 形式の
  402 を受け取りますが、サーバー側では支払い検証を行いません。

**チェーンセレクター UI** — ランディングページにはチェーン／トークンの
セレクター（デフォルト Solana）があり、選択に応じたエンドポイント URL を
リアルタイムで生成します。Solana では JPYC タブが無効表示になり、単一
トークンのチェーンにはバナーが表示されます。ウォレット接続も実装済みで、
EVM は RainbowKit、Solana は Phantom／Solflare に対応します。Solana の
プロバイダーはクライアント専用アイランド（`ssr: false`）として読み込まれ、
ページの SSR を維持します。

### データソース

| ソース | エンドポイント | 認証 |
|---|---|---|
| Nansen Smart Money | `api.nansen.ai/defi/smart-money/positions?chain=solana` | `x-api-key` |
| Kamino | `api.kamino.finance/strategies` | なし |
| Drift | `mainnet-beta.api.drift.trade/stats` | なし |
| Jupiter Price | `price.jup.ag/v6/price` | なし |

各ソースはタイムアウト付きのベストエフォートで取得します。いずれかが到達
不能でも、厳選したベースラインによりアプリは動作し続けます。

### セットアップ

```bash
npm install
cp .env.example .env.local   # 値を入力してください
npm run build
npm start                    # 本番
# または
npm run dev                  # 開発
```

### 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `NANSEN_API_KEY` | 任意 | スマートマネーのライブデータ用 Nansen API キー |
| `ANTHROPIC_API_KEY` | 任意 | AI 分析用の Claude API キー |
| `WALLET_ADDRESS` | 任意 | x402 決済の受取 EVM アドレス（Base / Polygon / BNB）。未設定時はバンドル済みの本番ウォレット `0xC67d…00A` を使用 |
| `SOLANA_WALLET_ADDRESS` | **必須**（Solana 利用時） | Solana USDC 決済の受取アドレス（base58） |
| `CDP_API_KEY_ID` | **必須**（本番） | Coinbase Developer Platform の API キー ID（CDP facilitator 認証用） |
| `CDP_API_KEY_SECRET` | **必須**（本番） | Coinbase Developer Platform の API キーシークレット |
| `FACILITATOR_URL` | 任意 | x402 facilitator の URL。`CDP_API_KEY_ID` と `CDP_API_KEY_SECRET` が設定されている場合は `https://api.cdp.coinbase.com/platform/v2/x402`（Coinbase CDP）、未設定時はコミュニティ facilitator `https://x402.org/facilitator` |
| `HELIUS_RPC_URL` | 任意 | Solana RPC URL（サーバー側） |
| `NEXT_PUBLIC_HELIUS_RPC_URL` | 任意 | ブラウザのウォレット接続用 Solana RPC URL（未設定時は公開メインネット RPC） |
| `BNB_RPC_URL` | 任意 | BNB Chain の RPC URL |
| `NEXT_PUBLIC_JPYC_CONTRACT` | 任意 | Polygon の JPYC トークンコントラクト（既定値は正規アドレス） |
| `NEXT_PUBLIC_USDT_BNB_CONTRACT` | 任意 | BNB Chain の USDT トークンコントラクト |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | 任意 | WalletConnect のプロジェクト ID |

`NANSEN_API_KEY` / `ANTHROPIC_API_KEY` がない場合、アプリは厳選した
ベースラインと決定論的な分析にフォールバックします。`WALLET_ADDRESS` を
未設定にすると `payTo` はバンドル済みの本番ウォレットになります。
`CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` を設定すると Coinbase CDP の
本番 SLA + ガススポンサー対応 facilitator を、未設定時はコミュニティの
`x402.org/facilitator` を使用します。

### 技術スタック

Next.js 15.5.9 ・ React 19 ・ `@x402/next` 2.13 ・ `@x402/core` ・
`@x402/evm` ・ `@coinbase/x402` ・ `@anthropic-ai/sdk` ・
viem ・ wagmi ・ RainbowKit ・ TanStack Query ・ Solana wallet-adapter
（Phantom／Solflare）・ `@solana/web3.js`。

### デプロイ

Vercel にデプロイし、プロジェクト設定で `.env.example` のすべての環境変数を
設定してください。

### 免責事項

本ツールは情報提供のみを目的としています。DeFi への投資にはリスクが伴います。
投資判断はご自身でお願いします。
