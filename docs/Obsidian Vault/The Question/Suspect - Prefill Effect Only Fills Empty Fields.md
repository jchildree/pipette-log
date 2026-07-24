---
id: spiffe://pipette-log/channel-1-stale-volumes/hypothesis/prefill-or-guard
asserted: "SignOffForm's prefill useEffect uses `current.volumeUl || source.low_ul`, which only fills empty fields and never overwrites a prior selection's value on pipette/tip switch"
source: "code:client/src/screens/SignOffForm.tsx:139-141"
method: observed
confidence: verified
verify: "select single-channel pipette A, note Channel 1 volumes, select multichannel pipette B, Channel 1 volumes must equal B's low_ul/mid_ul/high_ul not A's"
---

# Suspect - Prefill Effect Only Fills Empty Fields

**Verdict:** Confirmed (direct code trace, no ambiguity)

## Prediction
If this `||` fallback is the cause, changing the guard to overwrite on `selectedPipette`/`selectedTip` identity change (not on emptiness) makes the bug disappear.

## Evidence
```js
// client/src/screens/SignOffForm.tsx:139-141
low: { ...row.low, current: { ...row.low.current, volumeUl: row.low.current.volumeUl || (source.low_ul != null ? String(source.low_ul) : '') } },
```
`row.low.current.volumeUl` is truthy after any prior fill → `||` short-circuits → `source.low_ul` never read again. Same pattern on `mid`/`high`. Applies to every `activeChannels` entry, so also affects channel switch 2-8 on multichannel, and single→single pipette switches (masked there since usually starting blank).

## Scope note
Not multichannel-specific despite how the user encountered it -- reproduces on any pipette-to-pipette (or tip-to-tip) switch after a value's already been typed or prefilled once.

[[Case - Channel 1 Keeps Stale Pipette Volumes On Switch]]
