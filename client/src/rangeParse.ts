// Derives low/mid/high targets (canonical uL) from a free-text pipette range
// like "10-100 uL" or "100 uL". Mirrors backend/scripts/backfill-range-targets.js
// -- keep the two in sync if this rule changes.
//
// Rule (stakeholder-specified):
//   - 2 numbers ("10-100 uL"): low = min, high = max, mid = high / 2 (not
//     the average of low/high).
//   - 1 number ("100 uL"): if >10 uL canonical, it's the max -- low = 1,
//     mid = value / 2, high = value. If <=10 uL, it's the low bound instead --
//     low = value, mid/high stay null (not derivable from one number alone).
//   - Units: each number keeps its own unit if given ("1 uL- 10 mL" is
//     genuinely mixed); a number with no unit inherits the nearest unit
//     later in the string; with no unit anywhere, defaults to uL.
export interface RangeTargets {
    low: number | null;
    mid: number | null;
    high: number | null;
}

function unitFactor(token: string | null): number | null {
    if (!token) return null;
    const t = token.toLowerCase().replace(/[^a-zµ]/g, '');
    if (t === 'ml') return 1000;
    if (t === 'ul' || t === 'mcl' || t === 'µl' || t === 'u') return 1;
    return null;
}

function extractNumbers(rangeText: string) {
    const matches = [...rangeText.matchAll(/(\d+(?:\.\d+)?)\s*(µl|ul|mcl|ml)?/gi)];
    const nums = matches.map((m) => ({ value: Number(m[1]), unitToken: m[2] ?? null }));
    for (let i = nums.length - 1; i >= 0; i--) {
        if (!nums[i].unitToken && i + 1 < nums.length) nums[i].unitToken = nums[i + 1].unitToken;
    }
    return nums.map((n) => n.value * (unitFactor(n.unitToken) ?? 1));
}

export function deriveRangeTargets(rangeText: string): RangeTargets {
    if (!rangeText) return { low: null, mid: null, high: null };
    const nums = extractNumbers(rangeText);
    if (nums.length === 0) return { low: null, mid: null, high: null };

    if (nums.length === 1) {
        const value = nums[0];
        if (value <= 10) return { low: value, mid: null, high: null };
        return { low: 1, mid: value / 2, high: value };
    }

    let [a, b] = [nums[0], nums[1]];
    if (a > b) [a, b] = [b, a];
    return { low: a, mid: b / 2, high: b };
}
