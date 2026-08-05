---
id: spiffe://pipette-log/failed-verification-bypasses-gate/finding/case
asserted: "New Verification page opens the Sign Off modal and lets a submit through even when a point reads out of ±3% tolerance"
source: user
method: reproduced
confidence: verified
verify: "cd client && npm test -- src/screens/SignOffForm.test.tsx"
---

# Case - Failed Verification Bypasses Hard-Fail Gate

**Status:** Closed

## Symptom
On the New Verification page, entering a mass wildly out of tolerance for Low/Mid/High and clicking Sign & Submit still opened the Sign Off modal, allowed submission, and (via the follow-on `resetForm()`) wiped the volume fields back to blank instead of leaving them at the pipette's default values.

## Root cause
`SignOffForm.tsx` `openSignOff()` computed `failedLabels` by mutating a closure variable *inside* a `setChannelRows` functional updater, then read `failedLabels.length` synchronously on the very next line. React defers a functional updater's execution to the render/commit phase (batching), so the read always saw the stale, empty array on the failing path -- the hard-fail check silently no-op'd and fell through to `setSignOffVisible(true)`. One bug explained all three symptoms: modal shown, submission allowed, and the bogus-successful submit's `resetForm()` clearing the volumes.

## Fix
`SignOffForm.tsx` `openSignOff()` -- compute `failedLabels` with a plain synchronous loop over the current `channelRows` state (no `setState` in the loop), gate the popup/submit on that result, and only use `setChannelRows` afterward, purely to record `attempts`/`expanded` for the failed points.

## Regression test
`client/src/screens/SignOffForm.test.tsx` -- new frontend test infra added (`vitest` + `jsdom` + `@testing-library/react` + `@testing-library/jest-dom`, `npm test` script), since `client/` had zero frontend tests before this fix. Test fills Low/Mid/High with an out-of-tolerance Low mass, clicks Sign & Submit, and asserts: no "Sign Off" modal renders, `submitEntry` is never called, and the Low volume field still holds its prefilled default. Red on the buggy code, green after the fix.

[[Investigation Board Index]]
