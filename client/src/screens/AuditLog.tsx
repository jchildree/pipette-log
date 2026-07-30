import { useEffect, useState } from 'react';
import { correctEntry, fetchBalances, fetchEntries, fetchEntryHistory, fetchPipettes, fetchUsers } from '../api';
import { useToast } from '../toast/ToastProvider';
import type { AuditEntry, Balance, EquipmentUnit, Pipette, PointKey, User, VerificationType } from '../types';
import { toCanonical, toDisplay } from '../units';
import './AuditLog.css';

const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
    tolerance_3pct: '±3% Tolerance',
    manufacturer_spec: 'Manufacturer Spec',
    after_external_cal: 'After External Cal',
};

const POINTS: { key: PointKey; label: string }[] = [
    { key: 'low', label: 'Low' },
    { key: 'mid', label: 'Mid' },
    { key: 'high', label: 'High' },
];

function pointValues(entry: AuditEntry, key: PointKey, unit: EquipmentUnit) {
    const massUnit = unit === 'mL' ? 'g' : 'mg';
    return {
        volume: toDisplay(String(entry[`volume_${key}_ul` as const]), unit),
        mass: toDisplay(String(entry[`mass_${key}_mg` as const]), unit),
        volumeUnit: unit,
        massUnit,
        pass: entry[`pass_${key}` as const],
    };
}

function PassBadge({ pass }: { pass: 'Y' | 'N' | null }) {
    if (pass === null) return <span className="badgeNeutral">--</span>;
    return <span className={pass === 'Y' ? 'badgePass' : 'badgeFail'}>{pass}</span>;
}

const EMPTY_POINT = { volumeUl: '', massMg: '' };

interface CorrectionPointRow {
    volumeUl: string;
    massMg: string;
}

export default function AuditLog() {
    const toast = useToast();
    const [pipettes, setPipettes] = useState<Pipette[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [pipetteFilter, setPipetteFilter] = useState<number | null>(null);
    const [balanceFilter, setBalanceFilter] = useState<number | null>(null);

    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const [historyFor, setHistoryFor] = useState<AuditEntry | null>(null);
    const [history, setHistory] = useState<AuditEntry[]>([]);

    const [correcting, setCorrecting] = useState(false);
    const [correctionPoints, setCorrectionPoints] = useState<Record<PointKey, CorrectionPointRow>>({
        low: { ...EMPTY_POINT }, mid: { ...EMPTY_POINT }, high: { ...EMPTY_POINT },
    });
    const [correctionNote, setCorrectionNote] = useState('');
    const [correctionUsername, setCorrectionUsername] = useState('');
    const [correctionPin, setCorrectionPin] = useState('');

    useEffect(() => {
        fetchPipettes().then(setPipettes).catch(() => {});
        fetchBalances().then(setBalances).catch(() => {});
        fetchUsers().then(setUsers).catch(() => {});
    }, []);

    useEffect(() => {
        loadEntries();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pipetteFilter, balanceFilter]);

    async function loadEntries() {
        setLoading(true);
        try {
            const result = await fetchEntries({
                pipette_id: pipetteFilter ?? undefined,
                balance_id: balanceFilter ?? undefined,
            });
            setEntries(result);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to load entries.');
        } finally {
            setLoading(false);
        }
    }

    function unitFor(pipetteId: number): EquipmentUnit {
        return pipettes.find((p) => p.id === pipetteId)?.unit ?? 'uL';
    }

    async function openHistory(entry: AuditEntry) {
        setHistoryFor(entry);
        try {
            setHistory(await fetchEntryHistory(entry.id));
        } catch {
            setHistory([entry]);
        }
    }

    // The chain's most recent row is the current state -- a correction always
    // amends that one (ADR-005), not necessarily the row that was clicked.
    const latest = history[history.length - 1] ?? historyFor;

    function openCorrection() {
        if (!latest) return;
        const unit = unitFor(latest.pipette_id);
        setCorrectionPoints({
            low: { volumeUl: toDisplay(String(latest.volume_low_ul), unit), massMg: toDisplay(String(latest.mass_low_mg), unit) },
            mid: { volumeUl: toDisplay(String(latest.volume_mid_ul), unit), massMg: toDisplay(String(latest.mass_mid_mg), unit) },
            high: { volumeUl: toDisplay(String(latest.volume_high_ul), unit), massMg: toDisplay(String(latest.mass_high_mg), unit) },
        });
        setCorrectionNote('');
        setCorrectionUsername('');
        setCorrectionPin('');
        setCorrecting(true);
    }

    function updateCorrectionPoint(key: PointKey, field: 'volumeUl' | 'massMg', value: string) {
        setCorrectionPoints((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    }

    async function submitCorrection() {
        if (!latest) return;
        if (!correctionUsername || !correctionPin) {
            toast.error('Technician and PIN are required.');
            return;
        }
        if (!correctionNote) {
            toast.error('A note explaining the correction is required.');
            return;
        }
        const unit = unitFor(latest.pipette_id);
        try {
            await correctEntry(latest.id, {
                username: correctionUsername,
                pin: correctionPin,
                pipette_id: latest.pipette_id,
                balance_id: latest.balance_id,
                verification_type: latest.verification_type,
                points: {
                    low: { volume_ul: Number(toCanonical(correctionPoints.low.volumeUl, unit)), mass_mg: Number(toCanonical(correctionPoints.low.massMg, unit)) },
                    mid: { volume_ul: Number(toCanonical(correctionPoints.mid.volumeUl, unit)), mass_mg: Number(toCanonical(correctionPoints.mid.massMg, unit)) },
                    high: { volume_ul: Number(toCanonical(correctionPoints.high.volumeUl, unit)), mass_mg: Number(toCanonical(correctionPoints.high.massMg, unit)) },
                },
                note: correctionNote,
            });
            toast.success('Correction submitted.');
            setCorrecting(false);
            setHistory(await fetchEntryHistory(latest.id));
            await loadEntries();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Correction failed.');
        }
    }

    return (
        <div className="container">
            <div className="title">Audit Log</div>

            <div className="filterRow">
                <div className="filterField">
                    <label className="filterLabel">Pipette</label>
                    <select value={pipetteFilter ?? ''} onChange={(e) => setPipetteFilter(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">All</option>
                        {pipettes.map((p) => (
                            <option key={p.id} value={p.id}>{p.equipment_id}</option>
                        ))}
                    </select>
                </div>
                <div className="filterField">
                    <label className="filterLabel">Balance</label>
                    <select value={balanceFilter ?? ''} onChange={(e) => setBalanceFilter(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">All</option>
                        {balances.map((b) => (
                            <option key={b.id} value={b.id}>{b.equipment_id}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && <div className="status">Loading...</div>}
            {!loading && entries.length === 0 && <div className="status">No entries found.</div>}

            {entries.map((entry) => (
                <button key={entry.id} className="entryCard" onClick={() => openHistory(entry)}>
                    <div className="entryHeader">
                        <span className="entryDate">{entry.signed_at ? new Date(entry.signed_at).toLocaleString() : 'unsigned'}</span>
                        {!!entry.corrected && <span className="correctedTag">corrected</span>}
                    </div>
                    <div className="entryMeta">
                        {VERIFICATION_TYPE_LABELS[entry.verification_type]} · Pipette {entry.pipette_equipment_id ?? entry.pipette_id} · Balance{' '}
                        {entry.balance_equipment_id ?? entry.balance_id} · Signed by {entry.signed_by_username ?? entry.signed_by_user_id}
                    </div>
                    <div className="pointRow">
                        {POINTS.map(({ key, label }) => {
                            const v = pointValues(entry, key, unitFor(entry.pipette_id));
                            return (
                                <div className="pointCell" key={key}>
                                    <span className="pointLabel">{label}</span>
                                    <span className="pointValue">{v.volume}{v.volumeUnit} / {v.mass}{v.massUnit}</span>
                                    <PassBadge pass={v.pass} />
                                </div>
                            );
                        })}
                    </div>
                    {entry.note && <div className="entryNote">Note: {entry.note}</div>}
                </button>
            ))}

            {historyFor && (
                <div className="modalBackdrop" onClick={() => setHistoryFor(null)}>
                    <div className="modalCard" onClick={(e) => e.stopPropagation()}>
                        <div className="modalTitle">Entry History</div>
                        <div className="historyScroll">
                            {history.map((h, i) => (
                                <div key={h.id} className="historyRow">
                                    <div className="historyRowTitle">
                                        {i === 0 ? 'Original' : `Correction ${i}`} (id {h.id}) -- {h.signed_at ? new Date(h.signed_at).toLocaleString() : 'unsigned'}
                                    </div>
                                    {POINTS.map(({ key, label }) => {
                                        const v = pointValues(h, key, unitFor(h.pipette_id));
                                        return (
                                            <div key={key} className="historyPointLine">
                                                {label}: {v.volume}{v.volumeUnit} / {v.mass}{v.massUnit} &rarr; {v.pass ?? '--'}
                                            </div>
                                        );
                                    })}
                                    {h.note && <div className="historyNote">Note: {h.note}</div>}
                                </div>
                            ))}
                        </div>
                        <button type="button" className="submit" onClick={openCorrection}>
                            Correct This Entry
                        </button>
                        <button type="button" className="closeButton" onClick={() => setHistoryFor(null)}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {correcting && latest && (
                <div className="modalBackdrop" onClick={() => setCorrecting(false)}>
                    <div className="modalCard" onClick={(e) => e.stopPropagation()}>
                        <div className="modalTitle">Correct Entry</div>
                        {POINTS.map(({ key, label }) => (
                            <div key={key} className="correctionPointRow">
                                <span className="correctionPointLabel">{label}</span>
                                <input
                                    className="input"
                                    value={correctionPoints[key].volumeUl}
                                    onChange={(e) => updateCorrectionPoint(key, 'volumeUl', e.target.value)}
                                    inputMode="decimal"
                                    placeholder={`Volume (${unitFor(latest.pipette_id)})`}
                                />
                                <input
                                    className="input"
                                    value={correctionPoints[key].massMg}
                                    onChange={(e) => updateCorrectionPoint(key, 'massMg', e.target.value)}
                                    inputMode="decimal"
                                    placeholder={`Mass (${unitFor(latest.pipette_id) === 'mL' ? 'g' : 'mg'})`}
                                />
                            </div>
                        ))}

                        <label className="filterLabel">Note (required)</label>
                        <textarea className="input" value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)} />

                        <label className="filterLabel">Technician</label>
                        <select className="input" value={correctionUsername} onChange={(e) => setCorrectionUsername(e.target.value)}>
                            <option value="">Select...</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.username}>{u.username}</option>
                            ))}
                        </select>

                        <label className="filterLabel">PIN</label>
                        <input className="input" type="password" value={correctionPin} onChange={(e) => setCorrectionPin(e.target.value)} inputMode="numeric" maxLength={6} />

                        <button type="button" className="submit" onClick={submitCorrection}>
                            Confirm &amp; Sign Correction
                        </button>
                        <button type="button" className="closeButton" onClick={() => setCorrecting(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
