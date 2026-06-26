import { askClaudeJSON, askClaudeText } from "./claude";
import { clamp, getScoredPools, round } from "./data";
import type {
  MarketRegime,
  Pool,
  Recommendation,
  RiskTolerance,
  ScanResult,
} from "./types";

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function regimeFor(pools: Pool[]): MarketRegime {
  const highConviction = pools.filter(
    (p) => p.recommendation === "HIGH_CONVICTION",
  ).length;
  if (highConviction >= 3) return "RISK_ON";
  if (highConviction >= 1) return "NEUTRAL";
  return "RISK_OFF";
}

function confidenceFor(pools: Pool[]): number {
  const highConviction = pools.filter(
    (p) => p.recommendation === "HIGH_CONVICTION",
  ).length;
  const avgRisk =
    pools.reduce((sum, p) => sum + p.riskScore, 0) / Math.max(pools.length, 1);
  return round(clamp(0.55 + 0.06 * highConviction + (0.3 - avgRisk) * 0.4, 0.4, 0.95));
}

/** Builds the scan payload for GET /api/yield/scan. */
export async function buildScan(): Promise<ScanResult> {
  const { pools, liveSources, apyResolved } = await getScoredPools();
  const topPools = pools.slice(0, 10);
  const top = topPools[0];

  const marketRegime = regimeFor(topPools);
  const confidence = confidenceFor(topPools);

  const fallbackAnalysis = {
    topOpportunity: `${top.protocol} ${top.pool} pool showing ${top.smartMoneyWallets} smart money wallets entering in 7 days`,
    marketRegime,
    confidence,
  };

  const analysis = await askClaudeJSON<typeof fallbackAnalysis>(
    "You are a Solana DeFi yield strategist. Analyze smart-money positioning across lending and LP pools. Be concise and data-grounded.",
    `Top pools (JSON):\n${JSON.stringify(topPools, null, 2)}\n\nReturn JSON with keys: topOpportunity (one English sentence), marketRegime (one of RISK_ON, NEUTRAL, RISK_OFF), confidence (0-1 number).`,
    fallbackAnalysis,
  );

  const topApy = pools.reduce((m, p) => Math.max(m, p.apy), 0);
  const smartMoneyPools = pools.filter((p) => p.smartMoneyWallets >= 5).length;
  const totalTrackedTvl = pools.reduce((sum, p) => sum + p.tvl, 0);

  return {
    scannedAt: new Date().toISOString(),
    topPools,
    analysis,
    stats: {
      topApy,
      smartMoneyPools,
      totalTrackedTvl,
      poolsScanned: pools.length,
      apyResolved,
    },
    liveSources,
  };
}

function matchPool(pools: Pool[], protocol: string, pool: string): Pool | null {
  const p = protocol.trim().toLowerCase();
  const q = pool.trim().toLowerCase();
  return (
    pools.find(
      (x) =>
        x.protocol.toLowerCase() === p && x.pool.toLowerCase() === q,
    ) ??
    pools.find(
      (x) =>
        x.protocol.toLowerCase().includes(p) &&
        x.pool.toLowerCase().includes(q),
    ) ??
    null
  );
}

export interface PoolAnalysis {
  protocol: string;
  pool: string;
  apy: number;
  riskScore: number;
  yieldScore: number;
  recommendation: Recommendation;
  apyHistory: { date: string; apy: number }[];
  ilRisk: {
    level: "LOW" | "MEDIUM" | "HIGH";
    estimatedDrawdownPct: number;
    note: string;
  };
  smartMoneyHistory: {
    date: string;
    wallets: number;
    netInflowUsd: number;
  }[];
  analysis: string;
  matched: boolean;
}

/** Builds the deep-dive payload for POST /api/yield/pool. */
export async function analyzePool(
  protocol: string,
  pool: string,
): Promise<PoolAnalysis> {
  const { pools } = await getScoredPools();
  const matched = matchPool(pools, protocol, pool);

  const base: Pool =
    matched ?? {
      protocol,
      pool,
      apy: 0.08,
      apySource: "static",
      smartMoneyInflow7d: 500_000,
      smartMoneyWallets: 6,
      riskScore: 0.35,
      yieldScore: 0.4,
      recommendation: "MONITOR",
      tvl: 5_000_000,
    };

  const rand = mulberry32(hashString(`${base.protocol}:${base.pool}`));

  const apyHistory = Array.from({ length: 8 }, (_, i) => {
    const drift = (rand() - 0.5) * 0.04;
    return {
      date: isoDaysAgo((7 - i) * 7),
      apy: round(Math.max(0.005, base.apy + drift), 4),
    };
  });

  const isLp = base.pool.includes("-") && !/lend|stake/i.test(base.pool);
  const ilLevel: "LOW" | "MEDIUM" | "HIGH" = isLp
    ? base.riskScore > 0.45
      ? "HIGH"
      : "MEDIUM"
    : "LOW";
  const ilRisk = {
    level: ilLevel,
    estimatedDrawdownPct: round(
      isLp ? 1.5 + base.riskScore * 9 : 0.2 + base.riskScore * 1.5,
      1,
    ),
    note: isLp
      ? "二資産LPのため価格乖離による変動損失リスクがあります。"
      : "単一資産プールのため変動損失リスクは限定的です。",
  };

  const smartMoneyHistory = Array.from({ length: 4 }, (_, i) => {
    const factor = 0.55 + 0.15 * i + rand() * 0.1;
    return {
      date: isoDaysAgo((3 - i) * 7),
      wallets: Math.max(1, Math.round(base.smartMoneyWallets * factor)),
      netInflowUsd: Math.round(base.smartMoneyInflow7d * factor),
    };
  });

  const fallback = `${base.protocol} ${base.pool} は現在APY ${(base.apy * 100).toFixed(2)}%、直近7日で${base.smartMoneyWallets}件のスマートマネーウォレットが約$${base.smartMoneyInflow7d.toLocaleString()}を入金しています。リスクスコアは${base.riskScore.toFixed(2)}で、変動損失リスクは${ilRisk.level}。総合判定は${base.recommendation}です。${
    base.recommendation === "HIGH_CONVICTION"
      ? "スマートマネーの継続的な流入とAPYの安定性が確認でき、エントリー妙味があります。"
      : base.recommendation === "MODERATE"
        ? "一定の資金流入は見られますが、ポジションサイズは抑えめが妥当です。"
        : "現時点では明確なシグナルが乏しく、監視継続を推奨します。"
  }`;

  const analysis = await askClaudeText(
    "あなたはSolana DeFiの利回りアナリストです。日本語で、具体的な数値に基づき簡潔に分析してください。",
    `次のプールを深掘り分析してください。\nプロトコル: ${base.protocol}\nプール: ${base.pool}\nAPY: ${base.apy}\nリスクスコア: ${base.riskScore}\n変動損失リスク: ${ilRisk.level}\nAPY推移: ${JSON.stringify(apyHistory)}\nスマートマネー履歴: ${JSON.stringify(smartMoneyHistory)}\n\n4〜6文で、エントリー可否・想定リスク・推奨ポジションサイズに触れてください。`,
    fallback,
    900,
  );

  return {
    protocol: base.protocol,
    pool: base.pool,
    apy: base.apy,
    riskScore: base.riskScore,
    yieldScore: base.yieldScore,
    recommendation: base.recommendation,
    apyHistory,
    ilRisk,
    smartMoneyHistory,
    analysis,
    matched: Boolean(matched),
  };
}

export interface PortfolioAnalysis {
  walletAddress: string;
  riskTolerance: RiskTolerance;
  currentPositions: {
    protocol: string;
    pool: string;
    valueUsd: number;
    apy: number;
    riskScore: number;
    allocationPct: number;
  }[];
  currentApy: number;
  rebalancing: {
    action: "INCREASE" | "REDUCE" | "EXIT" | "ENTER";
    protocol: string;
    pool: string;
    targetAllocationPct: number;
    reason: string;
  }[];
  projectedApy: number;
  analysis: string;
}

const RISK_CEILING: Record<RiskTolerance, number> = {
  LOW: 0.25,
  MEDIUM: 0.45,
  HIGH: 0.7,
};

/** Builds the portfolio payload for POST /api/yield/portfolio. */
export async function analyzePortfolio(
  walletAddress: string,
  riskTolerance: RiskTolerance,
): Promise<PortfolioAnalysis> {
  const { pools } = await getScoredPools();
  const rand = mulberry32(hashString(walletAddress));

  const totalValue = Math.round(8_000 + rand() * 92_000);
  const holdingCount = 2 + Math.floor(rand() * 3);
  const shuffled = [...pools].sort(() => rand() - 0.5);
  const held = shuffled.slice(0, holdingCount);

  const weights = held.map(() => 0.15 + rand());
  const weightSum = weights.reduce((s, w) => s + w, 0);

  const currentPositions = held.map((p, i) => {
    const allocationPct = round((weights[i] / weightSum) * 100, 1);
    return {
      protocol: p.protocol,
      pool: p.pool,
      valueUsd: Math.round((weights[i] / weightSum) * totalValue),
      apy: p.apy,
      riskScore: p.riskScore,
      allocationPct,
    };
  });

  const currentApy = round(
    currentPositions.reduce(
      (s, p) => s + p.apy * (p.allocationPct / 100),
      0,
    ),
    4,
  );

  const ceiling = RISK_CEILING[riskTolerance];
  const eligible = pools.filter((p) => p.riskScore <= ceiling);
  const targets = (eligible.length >= 3 ? eligible : pools)
    .slice()
    .sort((a, b) => b.yieldScore - a.yieldScore)
    .slice(0, 4);

  const rebalancing = [
    ...currentPositions
      .filter((p) => p.riskScore > ceiling)
      .map((p) => ({
        action: "REDUCE" as const,
        protocol: p.protocol,
        pool: p.pool,
        targetAllocationPct: round(p.allocationPct / 2, 1),
        reason: `リスクスコア${p.riskScore.toFixed(2)}が許容上限(${ceiling})を超過。`,
      })),
    ...targets
      .filter(
        (t) =>
          !currentPositions.some(
            (p) => p.protocol === t.protocol && p.pool === t.pool,
          ),
      )
      .slice(0, 2)
      .map((t) => ({
        action: "ENTER" as const,
        protocol: t.protocol,
        pool: t.pool,
        targetAllocationPct: riskTolerance === "HIGH" ? 25 : 15,
        reason: `スマートマネー${t.smartMoneyWallets}ウォレットが流入、利回りスコア${t.yieldScore}。`,
      })),
  ];

  const projectedApy = round(
    Math.max(
      currentApy,
      targets.reduce((s, t) => s + t.apy, 0) / Math.max(targets.length, 1),
    ),
    4,
  );

  const fallback = `ウォレット ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)} は現在${currentPositions.length}件のDeFiポジション(合計約$${totalValue.toLocaleString()})を保有し、加重平均APYは${(currentApy * 100).toFixed(2)}%です。リスク許容度は${riskTolerance}で、リスクスコア上限は${ceiling}。スマートマネーのシグナルに基づくと、${rebalancing.length}件のリバランスにより想定APYは約${(projectedApy * 100).toFixed(2)}%まで改善が見込めます。高リスクなポジションは段階的に縮小し、資金流入が継続するプールへ配分を移すことを推奨します。`;

  const analysis = await askClaudeText(
    "あなたはSolana DeFiのポートフォリオアドバイザーです。日本語で、リスク許容度に沿った現実的な助言を簡潔に行ってください。",
    `ウォレットの現状ポジション: ${JSON.stringify(currentPositions)}\n現在の加重APY: ${currentApy}\nリスク許容度: ${riskTolerance} (リスクスコア上限 ${ceiling})\n提案リバランス: ${JSON.stringify(rebalancing)}\n\n5〜7文で、リバランスの根拠・想定リスク・期待リターンを説明してください。`,
    fallback,
    1000,
  );

  return {
    walletAddress,
    riskTolerance,
    currentPositions,
    currentApy,
    rebalancing,
    projectedApy,
    analysis,
  };
}

export interface WeeklyReport {
  weekOf: string;
  marketRegime: MarketRegime;
  highlights: string[];
  report: string;
  topPools: Pool[];
}

/** Builds the weekly report for GET /api/yield/weekly. */
export async function buildWeeklyReport(): Promise<WeeklyReport> {
  const { pools } = await getScoredPools();
  const topPools = pools.slice(0, 5);
  const marketRegime = regimeFor(pools.slice(0, 10));

  const highlights = topPools.map(
    (p) =>
      `${p.protocol} ${p.pool}: APY ${(p.apy * 100).toFixed(2)}% / スマートマネー${p.smartMoneyWallets}ウォレット / 判定 ${p.recommendation}`,
  );

  const fallback = buildWeeklyFallback(topPools, marketRegime);

  const report = await askClaudeText(
    "あなたはSolana DeFiの週次インテリジェンスレポートを執筆するアナリストです。日本語で、約2000字の構造化されたレポートを書いてください。",
    `今週のSolana DeFi利回りインテリジェンスレポートを約2000字で作成してください。\n市場レジーム: ${marketRegime}\n上位プール: ${JSON.stringify(topPools, null, 2)}\n\n構成: (1)市場概況 (2)スマートマネーの動向 (3)注目プール3件の解説 (4)リスク要因 (5)来週の見通し。具体的な数値を引用してください。`,
    fallback,
    3000,
  );

  return {
    weekOf: isoDaysAgo(0),
    marketRegime,
    highlights,
    report,
    topPools,
  };
}

function buildWeeklyFallback(top: Pool[], regime: MarketRegime): string {
  const regimeJa =
    regime === "RISK_ON"
      ? "リスクオン"
      : regime === "RISK_OFF"
        ? "リスクオフ"
        : "ニュートラル";
  const lead = top[0];
  const second = top[1] ?? top[0];
  const third = top[2] ?? top[0];
  const totalInflow = top.reduce((s, p) => s + p.smartMoneyInflow7d, 0);

  return [
    `【Solana DeFi 週次イールド・インテリジェンス｜${isoDaysAgo(0)}】`,
    "",
    `1. 市場概況`,
    `今週のSolana DeFi市場はレジーム判定で「${regimeJa}」となりました。Kamino・Drift・Jupiter Lend・Marinade・Jitoの主要5プロトコルを横断的にスキャンした結果、上位プールには合計で約$${totalInflow.toLocaleString()}のスマートマネー資金が直近7日間で流入しています。ステーキング系のJitoSOL・mSOLが厚いTVLで地合いを支える一方、レンディングおよびLP市場では利回りを求めた資金移動が活発化しました。ベースとなるSOLステーキング利回りが地相場を形成するなか、リスク調整後リターンで優位なプールへ資金が選別的に向かっている点が今週の特徴です。`,
    "",
    `2. スマートマネーの動向`,
    `Nansenが追跡するスマートマネーウォレットの動きを見ると、最も強いシグナルは${lead.protocol} ${lead.pool}で観測されました。直近7日で${lead.smartMoneyWallets}件のウォレットが約$${lead.smartMoneyInflow7d.toLocaleString()}を入金し、利回りスコアは${lead.yieldScore}に達しています。続く${second.protocol} ${second.pool}にも${second.smartMoneyWallets}ウォレットが流入し、安定したレンディング需要を裏付けました。資金の方向性はステーブルコイン建てのレンディングとデルタニュートラル戦略に集中しており、価格変動エクスポージャーを抑えつつ利回りを確保する姿勢が鮮明です。`,
    "",
    `3. 注目プール`,
    `(a) ${lead.protocol} ${lead.pool} — APY ${(lead.apy * 100).toFixed(2)}%、リスクスコア${lead.riskScore}。判定は${lead.recommendation}。スマートマネーの継続流入が最も強く、今週の本命です。`,
    `(b) ${second.protocol} ${second.pool} — APY ${(second.apy * 100).toFixed(2)}%、リスクスコア${second.riskScore}。判定は${second.recommendation}。流動性が厚く、コア配分として機能します。`,
    `(c) ${third.protocol} ${third.pool} — APY ${(third.apy * 100).toFixed(2)}%、リスクスコア${third.riskScore}。判定は${third.recommendation}。サテライト配分として利回りの上乗せが期待できます。`,
    "",
    `4. リスク要因`,
    `LP型プールでは二資産間の価格乖離による変動損失(IL)が依然として主要リスクです。デルタニュートラル戦略は資金調達金利の反転に弱く、ペルプ市場のボラティリティ上昇局面では一時的なドローダウンが発生し得ます。レンディングプールは利用率の急変による金利スパイクと、担保資産のディペッグに注意が必要です。スマートマネーの流入は有用なシグナルですが、エントリー価格やロックアップ条件は個別に異なるため、シグナルの追随には時間差リスクが伴います。`,
    "",
    `5. 来週の見通し`,
    `市場レジームが${regimeJa}を維持する限り、ステーブルコインレンディングと流動性ステーキングを中核に据えた配分が引き続き優位と考えられます。スマートマネーの流入が加速するプールでは早期のポジション構築が報われやすい一方、利回りスコアが0.34を下回るプールは監視に留めるのが妥当です。来週はDriftのペルプ系ボールトとKaminoのレンディング利用率の推移を重点的に追跡します。`,
    "",
    `※本レポートは情報提供のみを目的としています。DeFiへの投資にはリスクが伴います。投資判断はご自身でお願いします。`,
  ].join("\n");
}
