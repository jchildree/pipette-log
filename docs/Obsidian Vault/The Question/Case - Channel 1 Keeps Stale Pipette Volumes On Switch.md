---
id: spiffe://pipette-log/channel-1-stale-volumes/finding/case
asserted: "Channel 1 volume fields retain prior pipette's low/mid/high after switching to a new (multichannel) pipette"
source: user
method: observed
confidence: verified
---

# Case - Channel 1 Keeps Stale Pipette Volumes On Switch

**Status:** Closed

## Symptom
Select single-channel pipette → volumes prefill from it → switch selection to a multichannel pipette → Channel 1 still shows the old pipette's volumes instead of the new one's.

## Root cause
[[Suspect - Prefill Effect Only Fills Empty Fields]] -- confirmed.

## Fix
`SignOffForm.tsx:139-141` -- removed `current.volumeUl ||` fallback, effect now always overwrites with the new source's values. Effect deps (`selectedPipette`, `selectedTip`, `isRepeater`) unchanged, so it still only fires on switch, not on every keystroke -- manual mid-session edits still stick between switches.

## Regression test
No seam: `client/` has no frontend test runner (no vitest/RTL) as of this fix. Flagged for cleanup -- adding a full test stack for one assertion was judged disproportionate; verified instead by direct code trace + served-module grep confirming the `||` guard is gone.

[[Investigation Board Index]]
