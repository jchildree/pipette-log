import { useEffect, useState } from 'react';
import { addBalance, addPipette, fetchBalances, fetchPipettes } from '../api';
import type { Balance, Pipette } from '../types';
import './EquipmentManager.css';

const CATEGORIES = ['single channel', 'multi channel', 'repeater', 'positive displacement'];

export default function EquipmentManager() {
    const [pipettes, setPipettes] = useState<Pipette[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);

    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');

    const [pipetteId, setPipetteId] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [pipetteRange, setPipetteRange] = useState('');
    const [pipetteCalDate, setPipetteCalDate] = useState('');
    const [lowUl, setLowUl] = useState('');
    const [midUl, setMidUl] = useState('');
    const [highUl, setHighUl] = useState('');
    const [pipetteError, setPipetteError] = useState<string | null>(null);
    const [pipetteStatus, setPipetteStatus] = useState<string | null>(null);

    const [balanceId, setBalanceId] = useState('');
    const [balanceCalDate, setBalanceCalDate] = useState('');
    const [balanceError, setBalanceError] = useState<string | null>(null);
    const [balanceStatus, setBalanceStatus] = useState<string | null>(null);

    useEffect(() => {
        loadEquipment();
    }, []);

    function loadEquipment() {
        fetchPipettes().then(setPipettes).catch(() => {});
        fetchBalances().then(setBalances).catch(() => {});
    }

    async function submitPipette() {
        setPipetteError(null);
        setPipetteStatus(null);
        if (!username || !pin || !pipetteId) {
            setPipetteError('Technician, PIN, and Pipette ID are required.');
            return;
        }
        try {
            await addPipette({
                username,
                pin,
                equipment_id: pipetteId,
                category,
                pipette_range: pipetteRange || undefined,
                calibration_due_date: pipetteCalDate || undefined,
                low_ul: lowUl ? Number(lowUl) : undefined,
                mid_ul: midUl ? Number(midUl) : undefined,
                high_ul: highUl ? Number(highUl) : undefined,
            });
            setPipetteStatus(`Added pipette ${pipetteId}.`);
            setPipetteId('');
            setPipetteRange('');
            setPipetteCalDate('');
            setLowUl('');
            setMidUl('');
            setHighUl('');
            loadEquipment();
        } catch (err) {
            setPipetteError(err instanceof Error ? err.message : 'Failed to add pipette.');
        }
    }

    async function submitBalance() {
        setBalanceError(null);
        setBalanceStatus(null);
        if (!username || !pin || !balanceId) {
            setBalanceError('Technician, PIN, and Balance ID are required.');
            return;
        }
        try {
            await addBalance({
                username,
                pin,
                equipment_id: balanceId,
                calibration_due_date: balanceCalDate || undefined,
            });
            setBalanceStatus(`Added balance ${balanceId}.`);
            setBalanceId('');
            setBalanceCalDate('');
            loadEquipment();
        } catch (err) {
            setBalanceError(err instanceof Error ? err.message : 'Failed to add balance.');
        }
    }

    return (
        <div className="container">
            <div className="card">
                <span className="cardTitle">Technician Sign-Off</span>
                <label className="label">Technician</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
                <label className="label">PIN</label>
                <input className="input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={6} />
            </div>

            <div className="card">
                <span className="cardTitle">Add Pipette</span>
                <label className="label">Pipette ID</label>
                <input className="input" value={pipetteId} onChange={(e) => setPipetteId(e.target.value)} placeholder="e.g. PI-099" />
                <label className="label">Category</label>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <label className="label">Pipette Range</label>
                <input className="input" value={pipetteRange} onChange={(e) => setPipetteRange(e.target.value)} placeholder="e.g. 20-200 uL" />
                <label className="label">Calibration Due Date</label>
                <input className="input" value={pipetteCalDate} onChange={(e) => setPipetteCalDate(e.target.value)} placeholder="YYYY-MM-DD" />
                <div className="pointRow">
                    <div className="pointField">
                        <label className="label">Low (µL)</label>
                        <input className="input" value={lowUl} onChange={(e) => setLowUl(e.target.value)} inputMode="decimal" />
                    </div>
                    <div className="pointField">
                        <label className="label">Mid (µL)</label>
                        <input className="input" value={midUl} onChange={(e) => setMidUl(e.target.value)} inputMode="decimal" />
                    </div>
                    <div className="pointField">
                        <label className="label">High (µL)</label>
                        <input className="input" value={highUl} onChange={(e) => setHighUl(e.target.value)} inputMode="decimal" />
                    </div>
                </div>
                {pipetteError && <div className="error">{pipetteError}</div>}
                {pipetteStatus && <div className="status">{pipetteStatus}</div>}
                <button type="button" className="submit" onClick={submitPipette}>
                    Add Pipette
                </button>
            </div>

            <div className="card">
                <span className="cardTitle">Add Balance</span>
                <label className="label">Balance ID</label>
                <input className="input" value={balanceId} onChange={(e) => setBalanceId(e.target.value)} placeholder="e.g. BAL-020" />
                <label className="label">Calibration Due Date</label>
                <input className="input" value={balanceCalDate} onChange={(e) => setBalanceCalDate(e.target.value)} placeholder="YYYY-MM-DD" />
                {balanceError && <div className="error">{balanceError}</div>}
                {balanceStatus && <div className="status">{balanceStatus}</div>}
                <button type="button" className="submit" onClick={submitBalance}>
                    Add Balance
                </button>
            </div>

            <div className="listCard">
                <span className="cardTitle">Pipettes ({pipettes.length})</span>
                {pipettes.map((p) => (
                    <div key={p.id} className="listRow">
                        {p.equipment_id} -- {p.category ?? 'n/a'} -- {p.pipette_range ?? 'n/a'} -- due {p.calibration_due_date ?? 'n/a'}
                    </div>
                ))}
            </div>

            <div className="listCard">
                <span className="cardTitle">Balances ({balances.length})</span>
                {balances.map((b) => (
                    <div key={b.id} className="listRow">
                        {b.equipment_id} -- due {b.calibration_due_date ?? 'n/a'}
                    </div>
                ))}
            </div>
        </div>
    );
}
