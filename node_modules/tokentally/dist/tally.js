/**
 * Estimates USD cost for a single call from normalized usage + pricing.
 *
 * Returns `null` if either `usage` or `pricing` is missing.
 */
export function estimateUsdCost({ usage, pricing, }) {
    if (!usage || !pricing)
        return null;
    const inputUsd = usage.inputTokens * pricing.inputUsdPerToken;
    const outputUsd = usage.outputTokens * pricing.outputUsdPerToken;
    return { inputUsd, outputUsd, totalUsd: inputUsd + outputUsd };
}
function addUsage(a, b) {
    return {
        inputTokens: a.inputTokens + b.inputTokens,
        outputTokens: a.outputTokens + b.outputTokens,
        reasoningTokens: (a.reasoningTokens ?? 0) + (b.reasoningTokens ?? 0),
        totalTokens: (a.totalTokens ?? 0) + (b.totalTokens ?? 0),
    };
}
function emptyUsage() {
    return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 };
}
/**
 * Tallies costs across a list of calls, grouped by `model`.
 *
 * `resolvePricing(modelId)` can be async (e.g. catalog fetch).
 */
export async function tallyCosts({ calls, resolvePricing, }) {
    const byModel = {};
    for (const call of calls) {
        const model = call.model;
        const usage = call.usage;
        if (!byModel[model]) {
            byModel[model] = { calls: 0, usage: emptyUsage(), cost: null };
        }
        byModel[model].calls += 1;
        if (usage)
            byModel[model].usage = addUsage(byModel[model].usage, usage);
    }
    let total = null;
    for (const [model, row] of Object.entries(byModel)) {
        const pricing = await resolvePricing(model);
        row.cost = estimateUsdCost({ usage: row.usage, pricing });
        if (row.cost) {
            if (!total)
                total = { inputUsd: 0, outputUsd: 0, totalUsd: 0 };
            total.inputUsd += row.cost.inputUsd;
            total.outputUsd += row.cost.outputUsd;
            total.totalUsd += row.cost.totalUsd;
        }
    }
    return { total, byModel };
}
