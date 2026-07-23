# ADR-004: 6-Digit PIN Sign-Off Layered on Nexus Session Identity

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-22
Authors: Joseph Childree
Affected Layers: Client · Backend

---

## Context

Slide 2, item 1 of the paper form: "Set up users for signing with PIN (6 digit?). Can probably use full name since digital isn't as space constrained." This is the digitized replacement for the handwritten "Date/Initials" column, which is the record's signature of who performed the verification. Separately, Nexus apps authenticate users via LDAP/JWT session (`@il/auth`, per ADR-003).

## Decision

Use a 6-digit PIN as the per-entry sign-off credential, layered on top of the device/session already authenticated against Nexus via LDAP -- the PIN is not a replacement for account login, it's a fast confirm-it's-you step at the moment of signing an entry.

| Aspect | Details |
|--------|---------|
| **Approach** | iPad app session authenticates via Nexus LDAP/JWT as normal. When a tech signs off a verification entry, they additionally enter their 6-digit PIN, which the backend validates against that user's stored PIN before the entry is marked signed. |
| **Rationale** | User confirmed "6-digit PIN per user" over full-name selection. A bench iPad is likely shared across techs during a shift; a fast PIN re-entry per entry gives per-entry attribution without requiring a full login for every single verification, while still relying on Nexus's existing LDAP identity as the source of truth for who the PIN belongs to. |
| **Trade-offs** | Gain: fast entry at the bench, matches the paper form's speed. Lose: a 6-digit PIN is weaker than a full password/LDAP credential -- acceptable here only because regulated-lite intent (ADR-005) treats it as an attribution/audit marker, not primary access control. |

Not chosen: full name selection as the sign-off act itself (rejected -- PIN was the explicit choice). Not chosen: PIN as the *only* authentication (no LDAP session) -- not what was asked; Nexus apps authenticate via LDAP per ADR-003, and nothing indicated Pipette Log should bypass that.

## Consequences

| Positive | Negative |
|----------|----------|
| Fast, low-friction sign-off matching bench workflow | PIN storage/validation is new surface area -- must be hashed server-side, never stored/transmitted in plaintext, and rate-limited against guessing |
| Per-entry attribution even on a shared/kiosk iPad | If a shared iPad is left logged into Nexus, PIN is the only thing stopping mis-attribution -- must be enforced correctly on every signed action, not just at app launch |

## Implementation Notes

Open questions (not decided this session):
- Where PINs are set/reset (self-service in-app vs admin-managed) and whether that flow lives in Pipette Log or a shared Nexus user-admin surface.
- PIN entry required on every entry sign-off, or once per app-foreground session with a timeout -- not specified; needs a follow-up decision before implementation.

## Related ADRs
- ADR-003: Nexus LDAP/JWT session this PIN layers on top of
- ADR-005: how PIN sign-off ties into record immutability
