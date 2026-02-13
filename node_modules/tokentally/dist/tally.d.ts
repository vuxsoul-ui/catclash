import type { CostBreakdown, Pricing, PricingResolver, TokenUsageNormalized } from "./types.js";
/**
 * Estimates USD cost for a single call from normalized usage + pricing.
 *
 * Returns `null` if either `usage` or `pricing` is missing.
 */
export declare function estimateUsdCost({ usage, pricing, }: {
    usage: TokenUsageNormalized | null;
    pricing: Pricing | null;
}): CostBreakdown | null;
/** One model call to be tallied. */
export type TallyCall = {
    model: string;
    usage: TokenUsageNormalized | null;
};
/**
 * Aggregated tally output.
 *
 * - `total`: sum of all calls where pricing was resolvable
 * - `byModel`: counts + accumulated usage + (optional) cost per model
 */
export type TallyResult = {
    total: CostBreakdown | null;
    byModel: Record<string, {
        calls: number;
        usage: TokenUsageNormalized;
        cost: CostBreakdown | null;
    }>;
};
/**
 * Tallies costs across a list of calls, grouped by `model`.
 *
 * `resolvePricing(modelId)` can be async (e.g. catalog fetch).
 */
export declare function tallyCosts({ calls, resolvePricing, }: {
    calls: TallyCall[];
    resolvePricing: PricingResolver;
}): Promise<TallyResult>;
//# sourceMappingURL=tally.d.ts.map