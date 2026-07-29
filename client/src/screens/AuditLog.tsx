import { useEffect, useState } from 'react';
import { fetchBalances, fetchEntries, fetchEntryHistory, fetchPipettes } from '../api';
import type { AuditEntry, Balance, Pipette, PointKey, VerificationType } from '../types';
import { toDisplay } from '../units';
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

function pointValues(entry: AuditEntry, key: PointKey) {
    return {
        volume: entry[`volume_${key}_ul` as const],
        mass: entry[`mass_${key}_mg` as const],
        pass: entry[`pass_${key}` as const],
    };
}

function massUnitLabel(unit: 'uL' | 'mL') {
    return unit === 'mL' ? 'g' : 'mg';
}

function PassBadge({ pass }: { pass: 'Y' | 'N' | null }) {
    if (pass === null) return <span className="badgeNeutral">--</span>;
    return <span className={pass === 'Y' ? 'badgePass' : 'badgeFail'}>{pass}</span>;
}

export default function AuditLog() {
    const [pipettes, setPipettes] = useState<Pipette[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [pipetteFilter, setPipetteFilter] = useState<number | null>(null);
    const [balanceFilter, setBalanceFilter] = useState<number | null>(null);

    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [historyFor, setHistoryFor] = useState<AuditEntry | null>(null);
    const [history, setHistory] = useState<AuditEntry[]>([]);

    useEffect(() => {
        fetchPipettes().then(setPipettes).catch(() => {});
        fetchBalances().then(setBalances).catch(() => {});
    }, []);

    const unitByPipetteId = new Map(pipettes.map((p) => [p.id, p.unit ?? 'uL']));
    function unitFor(entry: AuditEntry) {
        return unitByPipetteId.get(entry.pipette_id) ?? 'uL';
    }

    useEffect(() => {
        loadEntries();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pipetteFilter, balanceFilter]);

    async function loadEntries() {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchEntries({
                pipette_id: pipetteFilter ?? undefined,
                balance_id: balanceFilter ?? undefined,
            });
            setEntries(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load entries.');
        } finally {
            setLoading(false);
        }
    }

    async function openHistory(entry: AuditEntry) {
        setHistoryFor(entry);
        try {
            setHistory(await fetchEntryHistory(entry.id));
        } catch {
            setHistory([entry]);
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
            {error && <div className="error">{error}</div>}
            {!loading && !error && entries.length === 0 && <div className="status">No entries found.</div>}

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
                            const v = pointValues(entry, key);
                            const unit = unitFor(entry);
                            return (
                                <div className="pointCell" key={key}>
                                    <span className="pointLabel">{label}</span>
                                    <span className="pointValue">
                                        {toDisplay(String(v.volume), unit)}{unit} / {toDisplay(String(v.mass), unit)}{massUnitLabel(unit)}
                                    </span>
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
                                        const v = pointValues(h, key);
                                        const unit = unitFor(h);
                                        return (
                                            <div key={key} className="historyPointLine">
                                                {label}: {toDisplay(String(v.volume), unit)}{unit} / {toDisplay(String(v.mass), unit)}{massUnitLabel(unit)} &rarr; {v.pass ?? '--'}
                                            </div>
                                        );
                                    })}
                                    {h.note && <div className="historyNote">Note: {h.note}</div>}
                                </div>
                            ))}
                        </div>
                        <button type="button" className="closeButton" onClick={() => setHistoryFor(null)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
