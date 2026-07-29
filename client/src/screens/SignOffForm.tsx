import { useEffect, useState } from 'react';
import { fetchBalances, fetchPipettes, fetchTips, fetchUsers, submitEntry } from '../api';
import { getCachedBalances, getCachedPipettes, getCachedTips, getCachedUsers, setCachedBalances, setCachedPipettes, setCachedTips, setCachedUsers } from '../storage/referenceCache';
import { enqueueEntry } from '../storage/queue';
import { isOnline } from '../network';
import { NOTE_REQUIRED_TYPES } from '../types';
import type { Balance, ChannelPoints, EntryPayload, Pipette, PointKey, Tip, User, VerificationType } from '../types';
import { toDisplay, toCanonical } from '../units';
import './SignOffForm.css';

const VERIFICATION_TYPES: { value: VerificationType; label: string }[] = [
    { value: 'tolerance_3pct', label: '±3% Tolerance' },
    { value: 'manufacturer_spec', label: 'Manufacturer Specifications' },
    { value: 'after_external_cal', label: 'After External Calibration' },
];

const POINTS: { key: PointKey; label: string }[] = [
    { key: 'low', label: 'Low' },
    { key: 'mid', label: 'Mid' },
    { key: 'high', label: 'High' },
];

// ADR-011: channel 1 is used for single-channel/repeater pipettes too (there's just
// only ever one active channel for them) -- unifies the state shape either way.
const ALL_CHANNELS = [1, 2, 3, 4, 5, 6, 7, 8];

function detectCategory(category: string | null) {
    const c = (category ?? '').toLowerCase();
    return { isMultichannel: c.includes('multi'), isRepeater: c.includes('repeater') };
}

interface PointRow {
    volumeUl: string;
    massMg: string;
    passFail: 'Y' | 'N';
}

const EMPTY_ROW: PointRow = { volumeUl: '', massMg: '', passFail: 'Y' };

// Per-point retry state (ADR-010, tolerance_3pct only): `attempts` holds every
// failed reading so far, `current` is the in-progress one the tech is editing.
// Once `current` computes to a pass, it becomes the entry's final value for that point.
interface PointState {
    attempts: PointRow[];
    current: PointRow;
    expanded: boolean;
}

function emptyPointState(): PointState {
    return { attempts: [], current: { ...EMPTY_ROW }, expanded: false };
}

function emptyRows(): Record<PointKey, PointState> {
    return { low: emptyPointState(), mid: emptyPointState(), high: emptyPointState() };
}

// Per-channel point state (ADR-011). All 8 are always allocated; single-channel/repeater
// pipettes just only ever read/write channel 1.
function emptyChannelRows(): Record<number, Record<PointKey, PointState>> {
    return Object.fromEntries(ALL_CHANNELS.map((ch) => [ch, emptyRows()]));
}

// Mirrors backend src/lib/tolerance.js -- used client-side only to decide when to
// auto-spawn a retry row; server always recomputes and is the source of truth.
function tolerance3pct(volumeUl: number, massMg: number): 'Y' | 'N' {
    const lower = 0.97 * volumeUl;
    const upper = 1.03 * volumeUl;
    return massMg >= lower && massMg <= upper ? 'Y' : 'N';
}

export default function SignOffForm() {
    const [users, setUsers] = useState<User[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [pipettes, setPipettes] = useState<Pipette[]>([]);
    const [tips, setTips] = useState<Tip[]>([]);

    const [pipetteId, setPipetteId] = useState<number | null>(null);
    const [pipetteFilter, setPipetteFilter] = useState('');
    const [balanceId, setBalanceId] = useState<number | null>(null);
    const [tipId, setTipId] = useState<number | null>(null);
    const [verificationType, setVerificationType] = useState<VerificationType>('tolerance_3pct');
    const [channelRows, setChannelRows] = useState<Record<number, Record<PointKey, PointState>>>(emptyChannelRows());
    const [note, setNote] = useState('');

    const [signOffVisible, setSignOffVisible] = useState(false);
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [signOffError, setSignOffError] = useState<string | null>(null);

    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        loadReferenceData();
    }, []);

    async function loadReferenceData() {
        if (isOnline()) {
            try {
                const [freshUsers, freshBalances, freshPipettes, freshTips] = await Promise.all([fetchUsers(), fetchBalances(), fetchPipettes(), fetchTips()]);
                setUsers(freshUsers);
                setBalances(freshBalances);
                setPipettes(freshPipettes);
                setTips(freshTips);
                setCachedUsers(freshUsers);
                setCachedBalances(freshBalances);
                setCachedPipettes(freshPipettes);
                setCachedTips(freshTips);
                return;
            } catch {
                // fall through to cache below
            }
        }
        setUsers(getCachedUsers());
        setBalances(getCachedBalances());
        setPipettes(getCachedPipettes());
        setTips(getCachedTips());
    }

    const noteRequired = NOTE_REQUIRED_TYPES.includes(verificationType);
    const passFailEditable = verificationType !== 'tolerance_3pct';
    const selectedPipette = pipettes.find((p) => p.id === pipetteId) ?? null;
    const selectedBalance = balances.find((b) => b.id === balanceId) ?? null;
    const selectedTip = tips.find((t) => t.id === tipId) ?? null;
    const filteredPipettes = pipettes.filter((p) => p.equipment_id.toLowerCase().includes(pipetteFilter.toLowerCase()));

    const { isMultichannel, isRepeater } = detectCategory(selectedPipette?.category ?? null);
    const activeChannels = isMultichannel ? ALL_CHANNELS : [1];
    const activeUnit = (isRepeater ? selectedTip?.unit : selectedPipette?.unit) ?? 'uL';
    const massUnitLabel = activeUnit === 'mL' ? 'g' : 'mg';

    // Pre-fill each point's Volume (editable, per ADR-009): from the selected tip for
    // repeaters (ADR-011, since a repeater's targets follow the tip, not the pipette),
    // otherwise from the pipette's own reference low/mid/high, applied to every active channel.
    // Runs only on pipette/tip switch (see deps) -- always overwrites rather than fill-if-empty,
    // so a stale prior selection's values never survive a switch (investigate: Case - Channel 1
    // Keeps Stale Pipette Volumes On Switch).
    useEffect(() => {
        const source = isRepeater ? selectedTip : selectedPipette;
        if (!source) return;
        setChannelRows((prev) => {
            const next = { ...prev };
            for (const ch of activeChannels) {
                const row = prev[ch];
                next[ch] = {
                    low: { ...row.low, current: { ...row.low.current, volumeUl: source.low_ul != null ? String(source.low_ul) : '' } },
                    mid: { ...row.mid, current: { ...row.mid.current, volumeUl: source.mid_ul != null ? String(source.mid_ul) : '' } },
                    high: { ...row.high, current: { ...row.high.current, volumeUl: source.high_ul != null ? String(source.high_ul) : '' } },
                };
            }
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPipette, selectedTip, isRepeater]);

    function updateRow(channel: number, key: PointKey, field: 'volumeUl' | 'massMg', value: string) {
        setChannelRows((prev) => ({
            ...prev,
            [channel]: { ...prev[channel], [key]: { ...prev[channel][key], current: { ...prev[channel][key].current, [field]: value } } },
        }));
    }

    function updatePassFail(channel: number, key: PointKey, value: 'Y' | 'N') {
        setChannelRows((prev) => ({
            ...prev,
            [channel]: { ...prev[channel], [key]: { ...prev[channel][key], current: { ...prev[channel][key].current, passFail: value } } },
        }));
    }

    function toggleAttempts(channel: number, key: PointKey) {
        setChannelRows((prev) => ({
            ...prev,
            [channel]: { ...prev[channel], [key]: { ...prev[channel][key], expanded: !prev[channel][key].expanded } },
        }));
    }

    function resetForm() {
        setChannelRows(emptyChannelRows());
        setTipId(null);
        setNote('');
        setUsername('');
        setPin('');
    }

    // ADR-010/ADR-011: retry detection runs once, here, on Sign & Submit -- not while the
    // tech is still typing. A tolerance_3pct point that fails gets archived into `attempts`
    // and cleared for re-entry, checked across every active channel; submission is blocked
    // until every point on every active channel currently reads a pass.
    function openSignOff() {
        setStatus(null);

        const allFilled = activeChannels.every((ch) => POINTS.every(({ key }) => channelRows[ch][key].current.volumeUl && channelRows[ch][key].current.massMg));
        if (!pipetteId || !balanceId || !allFilled || (isRepeater && !tipId)) {
            setStatus(isRepeater && !tipId ? 'Select a tip.' : 'Fill in all required fields (Low/Mid/High Volume and Mass) for every channel.');
            return;
        }
        if (noteRequired && !note) {
            setStatus('Note is required for this verification type.');
            return;
        }

        if (verificationType === 'tolerance_3pct') {
            const failedLabels: string[] = [];
            setChannelRows((prev) => {
                const next = { ...prev };
                for (const ch of activeChannels) {
                    const row = { ...prev[ch] };
                    for (const { key, label } of POINTS) {
                        const point = row[key];
                        const passFail = tolerance3pct(Number(point.current.volumeUl), Number(point.current.massMg));
                        if (passFail === 'N') {
                            failedLabels.push(isMultichannel ? `Ch${ch} ${label}` : label);
                            row[key] = { attempts: [...point.attempts, point.current], current: { ...EMPTY_ROW }, expanded: point.expanded };
                        }
                    }
                    next[ch] = row;
                }
                return next;
            });
            if (failedLabels.length > 0) {
                setStatus(`${failedLabels.join(', ')} out of tolerance -- re-enter and try again.`);
                return;
            }
        }

        setSignOffError(null);
        setSignOffVisible(true);
    }

    async function confirmSignOff() {
        if (!username || !pin) {
            setSignOffError('Technician and PIN are required.');
            return;
        }

        function toMeasurementPoint(channel: number, key: PointKey) {
            const point = channelRows[channel][key];
            return {
                volume_ul: Number(point.current.volumeUl),
                mass_mg: Number(point.current.massMg),
                pass_fail: passFailEditable ? point.current.passFail : undefined,
                attempts: point.attempts.length
                    ? point.attempts.map((a) => ({ volume_ul: Number(a.volumeUl), mass_mg: Number(a.massMg) }))
                    : undefined,
            };
        }

        const channelPoints: ChannelPoints[] | undefined = isMultichannel
            ? activeChannels.map((ch) => ({
                  channel: ch,
                  points: { low: toMeasurementPoint(ch, 'low'), mid: toMeasurementPoint(ch, 'mid'), high: toMeasurementPoint(ch, 'high') },
              }))
            : undefined;

        const payload: EntryPayload = {
            username,
            pin,
            pipette_id: pipetteId!,
            balance_id: balanceId!,
            verification_type: verificationType,
            points: {
                low: toMeasurementPoint(1, 'low'),
                mid: toMeasurementPoint(1, 'mid'),
                high: toMeasurementPoint(1, 'high'),
            },
            channels: channelPoints,
            note: note || undefined,
        };

        if (isOnline()) {
            try {
                await submitEntry(payload);
                setSignOffVisible(false);
                setStatus('Entry signed and submitted.');
                resetForm();
            } catch (err) {
                setSignOffError(err instanceof Error ? err.message : 'Submission failed.');
            }
        } else {
            enqueueEntry(payload);
            setSignOffVisible(false);
            setStatus('Offline -- entry signed and queued, will sync automatically.');
            resetForm();
        }
    }

    return (
        <div className="container">
            <div className="cardRow">
                <div className="card">
                    <span className="cardTitle">Pipette ID</span>
                    <input
                        className="input"
                        value={pipetteFilter}
                        onChange={(e) => setPipetteFilter(e.target.value)}
                        placeholder="Filter by ID..."
                    />
                    <select
                        className="cardPicker"
                        value={pipetteId ?? ''}
                        onChange={(e) => setPipetteId(e.target.value ? Number(e.target.value) : null)}
                    >
                        <option value="">Select...</option>
                        {filteredPipettes.map((p) => (
                            <option key={p.id} value={p.id}>{p.equipment_id}</option>
                        ))}
                    </select>
                    {selectedPipette && (
                        <div className="cardMeta">
                            <div className="cardMetaLine">Pipette Range: {selectedPipette.pipette_range ?? 'n/a'}</div>
                            <div className="cardMetaLine">Calibration Due Date: {selectedPipette.calibration_due_date ?? 'n/a'}</div>
                            {selectedPipette.low_usage_ul != null && (
                                <div className="cardMetaLine">Low Usage: {toDisplay(String(selectedPipette.low_usage_ul), selectedPipette.unit ?? 'uL')} {selectedPipette.unit ?? 'uL'}</div>
                            )}
                        </div>
                    )}
                </div>

                {isRepeater && (
                    <div className="card">
                        <span className="cardTitle">Tip</span>
                        <select className="cardPicker" value={tipId ?? ''} onChange={(e) => setTipId(e.target.value ? Number(e.target.value) : null)}>
                            <option value="">Select...</option>
                            {tips.map((t) => (
                                <option key={t.id} value={t.id}>{t.tip_id}</option>
                            ))}
                        </select>
                        {selectedTip?.low_usage_ul != null && (
                            <div className="cardMeta">
                                <div className="cardMetaLine">Low Usage: {toDisplay(String(selectedTip.low_usage_ul), selectedTip.unit ?? 'uL')} {selectedTip.unit ?? 'uL'}</div>
                            </div>
                        )}
                    </div>
                )}

                <div className="card">
                    <span className="cardTitle">Balance ID</span>
                    <select className="cardPicker" value={balanceId ?? ''} onChange={(e) => setBalanceId(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">Select...</option>
                        {balances.map((b) => (
                            <option key={b.id} value={b.id}>{b.equipment_id}</option>
                        ))}
                    </select>
                    {selectedBalance && (
                        <div className="cardMeta">
                            <div className="cardMetaLine">Calibration Due Date: {selectedBalance.calibration_due_date ?? 'n/a'}</div>
                        </div>
                    )}
                </div>

                <div className="card">
                    <span className="cardTitle">Verification Type</span>
                    {VERIFICATION_TYPES.slice(0, 2).map((t) => (
                        <div key={t.value} className="radioRow" onClick={() => setVerificationType(t.value)}>
                            <div className="radioOuter">
                                {verificationType === t.value && <div className="radioInner" />}
                            </div>
                            <span>{t.label}</span>
                        </div>
                    ))}
                    <div className="checkboxDivider" />
                    {VERIFICATION_TYPES.slice(2).map((t) => (
                        <div key={t.value} className="radioRow" onClick={() => setVerificationType(t.value)}>
                            <div className="radioOuter checkboxOuter">
                                {verificationType === t.value && <div className="radioInner checkboxInner" />}
                            </div>
                            <span>{t.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ADR-011: one 3-point table for single-channel/repeater; 8 tables in flow
                (one per channel) for multichannel -- "essentially 8 verifications in 1". */}
            {activeChannels.map((ch) => (
                <div key={ch} className="channelBlock">
                    {isMultichannel && <span className="channelHeader">Channel {ch}</span>}
                    <div className="table">
                        <div className="tableHeaderRow">
                            <span className="tableHeaderCell">Volume ({activeUnit})</span>
                            <span className="tableHeaderCell">Mass ({massUnitLabel})</span>
                            <span className="tableHeaderCell">Pass (Y/N)</span>
                        </div>
                        {POINTS.map(({ key }) => {
                            const point = channelRows[ch][key];
                            return (
                                <div key={key}>
                                    <div className="tableRow">
                                        <input
                                            className="tableCellInput"
                                            value={toDisplay(point.current.volumeUl, activeUnit)}
                                            onChange={(e) => updateRow(ch, key, 'volumeUl', toCanonical(e.target.value, activeUnit))}
                                            inputMode="decimal"
                                        />
                                        <input
                                            className="tableCellInput"
                                            value={toDisplay(point.current.massMg, activeUnit)}
                                            onChange={(e) => updateRow(ch, key, 'massMg', toCanonical(e.target.value, activeUnit))}
                                            inputMode="decimal"
                                        />
                                        {passFailEditable ? (
                                            <div className="tableCellPicker">
                                                <select value={point.current.passFail} onChange={(e) => updatePassFail(ch, key, e.target.value as 'Y' | 'N')}>
                                                    <option value="Y">Y</option>
                                                    <option value="N">N</option>
                                                </select>
                                            </div>
                                        ) : (
                                            <span className="computedNote">auto</span>
                                        )}
                                    </div>
                                    {point.attempts.length > 0 && (
                                        <div className="attemptsBlock">
                                            <button type="button" className="attemptsToggle" onClick={() => toggleAttempts(ch, key)}>
                                                {point.expanded ? '▾' : '▸'} {point.attempts.length} attempt{point.attempts.length > 1 ? 's' : ''}
                                            </button>
                                            {point.expanded && point.attempts.map((a, i) => (
                                                <div className="attemptRow" key={i}>
                                                    <span className="attemptCell">{toDisplay(a.volumeUl, activeUnit)} {activeUnit}</span>
                                                    <span className="attemptCell">{toDisplay(a.massMg, activeUnit)} {massUnitLabel}</span>
                                                    <span className="attemptCell attemptFail">N</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <label className="label">Notes{noteRequired ? ' (required)' : ' (optional)'}</label>
            <textarea className="notesBox" value={note} onChange={(e) => setNote(e.target.value)} />

            <button type="button" className="submit" onClick={openSignOff}>
                Sign &amp; Submit
            </button>

            {status && <div className="status">{status}</div>}

            {signOffVisible && (
                <div className="modalBackdrop" onClick={() => setSignOffVisible(false)}>
                    <div className="modalCard" onClick={(e) => e.stopPropagation()}>
                        <div className="modalTitle">Sign Off</div>

                        <label className="label">Technician</label>
                        <select className="input" value={username} onChange={(e) => setUsername(e.target.value)}>
                            <option value="">Select...</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.username}>{u.username}</option>
                            ))}
                        </select>

                        <label className="label">PIN</label>
                        <input className="input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={6} />

                        {signOffError && <div className="error">{signOffError}</div>}

                        <button type="button" className="submit" onClick={confirmSignOff}>
                            Confirm &amp; Sign
                        </button>
                        <button type="button" className="cancel" onClick={() => setSignOffVisible(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
