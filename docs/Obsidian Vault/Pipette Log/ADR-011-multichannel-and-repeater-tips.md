# ADR-011: Multichannel (8-Channel) Entries and Repeater Tip Reference Data

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-24
Authors: Joseph Childree
Affected Layers: Backend · Database · Client

---

## Context

Stakeholder update: a multichannel pipette verification is "essentially 8 verifications in 1" -- one low/mid/high triplet per channel, 8 channels per entry, displayed as 8 separate tables each labeled "Channel N". Separately, repeater pipettes need a tip selector, since a repeater's target low/mid/high volumes are driven by which tip is loaded, not the pipette itself. ADR-010 (retry tracking) already anticipated the multichannel case by giving `entry_point_attempts` a nullable `channel` column, but no multichannel storage existed yet -- this ADR builds it.

`equipment.category` (free text, ADR from equipment unification) already carries real values from the seeded inventory: `single channel`, `multi channel`, `repeater` (plus a `single channel_volume` data-quality variant and `NULL`). No fixed enum exists in the DB; the client matches on substring (`multi`, `repeater`) rather than exact equality to tolerate that variance.

## Decision

| Aspect | Details |
|--------|---------|
| **Category detection** | Client branches its point-table layout off `selectedPipette.category` (case-insensitive substring match): contains "multi" -> 8-channel layout; contains "repeater" -> single table + tip dropdown; anything else (single channel, positive displacement, NULL) -> today's single 3-point table, unchanged. |
| **Multichannel storage** | New `entry_channel_points` table: one row per (entry, channel 1-8, point). `entries.volume_low_ul`/`mass_low_mg`/`pass_low` (etc, ADR-009) are still written for multichannel entries too, mirrored from channel 1, so existing single-triplet audit/list queries keep working without a join. `entry_channel_points` is the full per-channel record; single-channel/repeater entries never get rows there. |
| **Multichannel retries** | Reuses `entry_point_attempts` (ADR-010) with its `channel` column now populated (1-8) instead of NULL. Retry stays scoped per point per channel -- channel 3's low point retrying doesn't touch any other channel. |
| **Repeater tips** | New `tips` reference table (`tip_id`, `low_ul`, `mid_ul`, `high_ul`), same shape/pattern as `equipment`. Selecting a tip pre-fills the entry's low/mid/high targets, same UX as a pipette's own reference values today. Table ships empty -- real tip data pending from stakeholder, seeded later the same way `equipment` was (manual script). |
| **API** | `POST /entries` and `/entries/:id/correct` gain an optional `channels: [{ channel, points }]` array (1-8 entries, each shaped like the existing single `points` object, each point optionally carrying its own `attempts`). `GET /entries/:id/channels` returns the full per-channel record. `GET/POST /tips` mirror the existing `/pipettes`/`/balances` reference-data routes. |
| **Transaction** | Entry row + mirrored columns + all channel points + all channel attempts insert in one transaction (extends ADR-010's transaction wrapping) -- a multichannel entry is one atomic write, never partially saved. |

Not chosen: one `entries` row per channel (8 rows per sign-off). Rejected for the same reason ADR-009 rejected one-row-per-point -- a single sign-off/PIN/note/timestamp covers the whole 8-channel event, and ADR-005's correction chain stays simpler against one row per event.

Not chosen: dropping the mirrored channel-1 columns on `entries` for multichannel rows (leaving them NULL). Rejected per stakeholder direction to keep them populated, so nothing that already reads `entries.*` directly (audit list, reports) needs to change to understand multichannel exists.

## Consequences

| Positive | Negative |
|----------|----------|
| Single-channel/repeater path (the common case) is completely untouched -- ADR-009 shape, existing tests, existing audit queries all still apply as-is | Multichannel entries now have data in three places (entries mirror, entry_channel_points, entry_point_attempts) instead of one |
| Retry tracking (ADR-010) extends to multichannel for free -- same table, just a populated `channel` | `tips` ships empty; repeater UI can be built but won't be useful until real tip data is seeded |
| One atomic transaction per entry regardless of channel count | Client state model for the sign-off form gets meaningfully more complex (per-channel point state instead of one set of 3) |

## Implementation Notes

No production data yet, so `entry_channel_points` and `tips` were added directly to phase-1 schema (`005_tips.sql`, `006_entry_channel_points.sql`) rather than layered migrations, same precedent as ADR-009/ADR-010.

## Related ADRs
- ADR-009: three-point verification shape -- unchanged for single-channel/repeater, still what `entries` columns hold (mirrored from channel 1 for multichannel)
- ADR-010: retry attempt tracking -- `entry_point_attempts.channel` now actually used, not just reserved
- ADR-005: immutability/correction rules -- channel points and their attempts lock with the entry, no separate correction path
