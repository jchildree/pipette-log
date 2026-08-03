import { Fragment, useEffect, useState } from 'react';
import { addBalance, addPipette, deleteEquipment, fetchBalances, fetchPipettes, fetchUsers, updateEquipment } from '../api';
import { useAdminSession } from '../admin/AdminSession';
import { useToast } from '../toast/ToastProvider';
import { deriveRangeTargets } from '../rangeParse';
import type { Balance, EquipmentPatchPayload, EquipmentUnit, Pipette, User } from '../types';
import './EquipmentManager.css';

const CATEGORIES = ['single channel', 'multi channel', 'repeater', 'positive displacement'];
const UNITS: EquipmentUnit[] = ['uL', 'mL'];
const STATUSES = ['Active', 'Inactive', 'Out of Service'];
const UNIT_FACTOR: Record<EquipmentUnit, number> = { uL: 1, mL: 1000 };
const PAGE_SIZE = 100;

// Every field displayed in the Pipette/Balance detail grid -- key must match
// the equipment column name so confirmEdit() can send it straight through.
const PIPETTE_EDIT_FIELDS: [string, string][] = [
    ['category', 'Category'],
    ['pipette_range', 'Range'],
    ['calibration_due_date', 'Calibration Due Date'],
    ['low_ul', 'Low (uL)'],
    ['mid_ul', 'Mid (uL)'],
    ['high_ul', 'High (uL)'],
    ['low_usage_ul', 'Low Usage (uL)'],
    ['unit', 'Unit'],
    ['status', 'Status'],
    ['rack_number', 'Rack'],
    ['serial_number', 'Serial'],
    ['sub_location', 'Sub Location'],
    ['department', 'Department'],
    ['manufacturer', 'Manufacturer'],
    ['mechanism', 'Mechanism'],
    ['last_calibration_date', 'Last Calibration'],
    ['calibration_conducted_by', 'Calibration Conducted By'],
    ['ranges_used', 'Ranges Used'],
    ['old_id', 'Old ID'],
    ['review_comment', 'Review'],
    ['adjustment_comment', 'Adjustment'],
    ['comments_2', 'Comments'],
];

const BALANCE_EDIT_FIELDS: [string, string][] = [
    ['calibration_due_date', 'Calibration Due Date'],
    ['department', 'Department'],
    ['status', 'Status'],
];

type EquipmentType = 'Pipette' | 'Balance';

// ADR-013: canonical storage is uL -- the form takes input in the selected unit
// and converts to uL before it hits the API, same boundary SignOffForm uses.
function toCanonicalUl(value: string, unit: EquipmentUnit): number | undefined {
    if (!value) return undefined;
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n * UNIT_FACTOR[unit];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="label">{label}</label>
            {children}
        </div>
    );
}

export default function EquipmentManager() {
    const { isAdmin, username: adminUsername, pin: adminPin } = useAdminSession();
    const toast = useToast();

    const [pipettes, setPipettes] = useState<Pipette[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [pipettePage, setPipettePage] = useState(0);
    const [balancePage, setBalancePage] = useState(0);
    const [expandedPipetteId, setExpandedPipetteId] = useState<number | null>(null);
    const [expandedBalanceId, setExpandedBalanceId] = useState<number | null>(null);

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [addType, setAddType] = useState<EquipmentType>('Pipette');

    const [pipetteId, setPipetteId] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [pipetteRange, setPipetteRange] = useState('');
    const [pipetteCalDate, setPipetteCalDate] = useState('');
    const [lowUl, setLowUl] = useState('');
    const [midUl, setMidUl] = useState('');
    const [highUl, setHighUl] = useState('');
    const [lowUsageUl, setLowUsageUl] = useState('');
    const [unit, setUnit] = useState<EquipmentUnit>('uL');
    const [status, setStatus] = useState(STATUSES[0]);

    // Auto-fill Low/Mid/High from the typed range (stakeholder rule, see
    // rangeParse.ts) -- still freely editable afterward.
    function updatePipetteRange(value: string) {
        setPipetteRange(value);
        const targets = deriveRangeTargets(value);
        setLowUl(targets.low != null ? String(targets.low / UNIT_FACTOR[unit]) : '');
        setMidUl(targets.mid != null ? String(targets.mid / UNIT_FACTOR[unit]) : '');
        setHighUl(targets.high != null ? String(targets.high / UNIT_FACTOR[unit]) : '');
    }

    const [balanceId, setBalanceId] = useState('');
    const [balanceCalDate, setBalanceCalDate] = useState('');

    const [signOffVisible, setSignOffVisible] = useState(false);
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');

    const [editTarget, setEditTarget] = useState<{ type: EquipmentType; item: Pipette | Balance } | null>(null);
    const [editUsername, setEditUsername] = useState('');
    const [editPin, setEditPin] = useState('');
    const [editFields, setEditFields] = useState<Record<string, string>>({});

    useEffect(() => {
        loadEquipment();
        fetchUsers().then(setUsers).catch(() => {});
    }, []);

    function loadEquipment() {
        fetchPipettes().then(setPipettes).catch(() => {});
        fetchBalances().then(setBalances).catch(() => {});
    }

    function resetAddForm() {
        setPipetteId('');
        setCategory(CATEGORIES[0]);
        setPipetteRange('');
        setPipetteCalDate('');
        setLowUl('');
        setMidUl('');
        setHighUl('');
        setLowUsageUl('');
        setUnit('uL');
        setStatus(STATUSES[0]);
        setBalanceId('');
        setBalanceCalDate('');
    }

    function openAddModal() {
        if (!isAdmin) {
            toast.error('Admin login required to add equipment.');
            return;
        }
        resetAddForm();
        setAddType('Pipette');
        setAddModalOpen(true);
    }

    function continueToSignOff() {
        if (addType === 'Pipette' && !pipetteId) {
            toast.error('Pipette ID is required.');
            return;
        }
        if (addType === 'Balance' && !balanceId) {
            toast.error('Balance ID is required.');
            return;
        }
        setUsername(adminUsername);
        setPin(adminPin);
        setAddModalOpen(false);
        setSignOffVisible(true);
    }

    async function confirmSignOff() {
        if (!username || !pin) {
            toast.error('Technician and PIN are required.');
            return;
        }
        try {
            if (addType === 'Pipette') {
                await addPipette({
                    username, pin, equipment_id: pipetteId, category,
                    pipette_range: pipetteRange || undefined,
                    calibration_due_date: pipetteCalDate || undefined,
                    low_ul: toCanonicalUl(lowUl, unit),
                    mid_ul: toCanonicalUl(midUl, unit),
                    high_ul: toCanonicalUl(highUl, unit),
                    low_usage_ul: toCanonicalUl(lowUsageUl, unit),
                    unit, status,
                });
                toast.success(`Added pipette ${pipetteId}.`);
            } else {
                await addBalance({
                    username, pin, equipment_id: balanceId,
                    calibration_due_date: balanceCalDate || undefined,
                });
                toast.success(`Added balance ${balanceId}.`);
            }
            setSignOffVisible(false);
            resetAddForm();
            loadEquipment();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to add equipment.');
        }
    }

    function openEdit(type: EquipmentType, item: Pipette | Balance) {
        const fieldList = type === 'Pipette' ? PIPETTE_EDIT_FIELDS : BALANCE_EDIT_FIELDS;
        const initial: Record<string, string> = {};
        for (const [key] of fieldList) {
            const value = (item as unknown as Record<string, unknown>)[key];
            initial[key] = value == null ? '' : String(value);
        }
        setEditFields(initial);
        setEditUsername('');
        setEditPin('');
        setEditTarget({ type, item });
    }

    async function confirmEdit() {
        if (!editTarget) return;
        if (!editUsername || !editPin) {
            toast.error('Username and PIN are required.');
            return;
        }
        const fieldList = editTarget.type === 'Pipette' ? PIPETTE_EDIT_FIELDS : BALANCE_EDIT_FIELDS;
        const numericFields = new Set(['low_ul', 'mid_ul', 'high_ul', 'low_usage_ul']);
        const payload: Record<string, unknown> = { admin_username: editUsername, admin_pin: editPin };
        for (const [key] of fieldList) {
            const raw = editFields[key] ?? '';
            payload[key] = raw === '' ? null : (numericFields.has(key) ? Number(raw) : raw);
        }
        try {
            await updateEquipment(editTarget.item.id, payload as unknown as EquipmentPatchPayload);
            toast.success('Equipment updated.');
            setEditTarget(null);
            loadEquipment();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update equipment.');
        }
    }

    async function confirmDelete() {
        if (!editTarget) return;
        if (!editUsername || !editPin) {
            toast.error('Username and PIN are required.');
            return;
        }
        if (!window.confirm(`Delete ${editTarget.item.equipment_id}? This cannot be undone.`)) return;
        try {
            await deleteEquipment(editTarget.item.id, { admin_username: editUsername, admin_pin: editPin });
            toast.success(`Deleted ${editTarget.item.equipment_id}.`);
            setEditTarget(null);
            loadEquipment();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete equipment.');
        }
    }

    const pipetteTotalPages = Math.max(1, Math.ceil(pipettes.length / PAGE_SIZE));
    const balanceTotalPages = Math.max(1, Math.ceil(balances.length / PAGE_SIZE));
    const pagedPipettes = pipettes.slice(pipettePage * PAGE_SIZE, pipettePage * PAGE_SIZE + PAGE_SIZE);
    const pagedBalances = balances.slice(balancePage * PAGE_SIZE, balancePage * PAGE_SIZE + PAGE_SIZE);

    return (
        <div className="container">
            <div className="headerRow">
                <span className="title">Equipment</span>
                {isAdmin ? (
                    <button type="button" className="addButton" onClick={openAddModal}>+ Add Equipment</button>
                ) : (
                    <span className="adminNote">Admin login required to add equipment</span>
                )}
            </div>

            <div className="listCard">
                <span className="cardTitle">Pipettes ({pipettes.length})</span>
                <div className="tableScroll">
                    <table className="eqTable">
                        <thead>
                            <tr>
                                <th>Equipment ID</th>
                                <th>Category</th>
                                <th>Range</th>
                                <th>Due Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedPipettes.map((p) => (
                                <Fragment key={p.id}>
                                    <tr className="eqRow" onClick={() => setExpandedPipetteId(expandedPipetteId === p.id ? null : p.id)}>
                                        <td>{p.equipment_id}</td>
                                        <td>{p.category ?? 'n/a'}</td>
                                        <td>{p.pipette_range ?? 'n/a'}</td>
                                        <td>{p.calibration_due_date ?? 'n/a'}</td>
                                        <td>{p.status ?? 'n/a'}</td>
                                    </tr>
                                    {expandedPipetteId === p.id && (
                                        <tr className="eqDetailRow">
                                            <td colSpan={5}>
                                                <div className="eqDetailGrid">
                                                    <span>Low/Mid/High: {p.low_ul ?? 'n/a'} / {p.mid_ul ?? 'n/a'} / {p.high_ul ?? 'n/a'} {p.unit ?? 'uL'}</span>
                                                    <span>Low Usage: {p.low_usage_ul ?? 'n/a'} {p.unit ?? 'uL'}</span>
                                                    <span>Rack: {p.rack_number ?? 'n/a'}</span>
                                                    <span>Serial: {p.serial_number ?? 'n/a'}</span>
                                                    <span>Sub Location: {p.sub_location ?? 'n/a'}</span>
                                                    <span>Department: {p.department ?? 'n/a'}</span>
                                                    <span>Manufacturer: {p.manufacturer ?? 'n/a'}</span>
                                                    <span>Mechanism: {p.mechanism ?? 'n/a'}</span>
                                                    <span>Last Calibration: {p.last_calibration_date ?? 'n/a'}</span>
                                                    <span>Calibration Conducted By: {p.calibration_conducted_by ?? 'n/a'}</span>
                                                    <span>Ranges Used: {p.ranges_used ?? 'n/a'}</span>
                                                    <span>Old ID: {p.old_id ?? 'n/a'}</span>
                                                    {p.review_comment && <span>Review: {p.review_comment}</span>}
                                                    {p.adjustment_comment && <span>Adjustment: {p.adjustment_comment}</span>}
                                                    {p.comments_2 && <span>Comments: {p.comments_2}</span>}
                                                    <button type="button" className="addButton" onClick={(e) => { e.stopPropagation(); openEdit('Pipette', p); }}>Edit</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                {pipetteTotalPages > 1 && (
                    <div className="pager">
                        <button type="button" disabled={pipettePage === 0} onClick={() => setPipettePage((p) => p - 1)}>Prev</button>
                        <span>Page {pipettePage + 1} of {pipetteTotalPages}</span>
                        <button type="button" disabled={pipettePage >= pipetteTotalPages - 1} onClick={() => setPipettePage((p) => p + 1)}>Next</button>
                    </div>
                )}
            </div>

            <div className="listCard">
                <span className="cardTitle">Balances ({balances.length})</span>
                <div className="tableScroll">
                    <table className="eqTable">
                        <thead>
                            <tr>
                                <th>Equipment ID</th>
                                <th>Due Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedBalances.map((b) => (
                                <Fragment key={b.id}>
                                    <tr className="eqRow" onClick={() => setExpandedBalanceId(expandedBalanceId === b.id ? null : b.id)}>
                                        <td>{b.equipment_id}</td>
                                        <td>{b.calibration_due_date ?? 'n/a'}</td>
                                    </tr>
                                    {expandedBalanceId === b.id && (
                                        <tr className="eqDetailRow">
                                            <td colSpan={2}>
                                                <div className="eqDetailGrid">
                                                    <span>Department: {b.department ?? 'n/a'}</span>
                                                    <span>Status: {b.status ?? 'n/a'}</span>
                                                    <button type="button" className="addButton" onClick={(e) => { e.stopPropagation(); openEdit('Balance', b); }}>Edit</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                {balanceTotalPages > 1 && (
                    <div className="pager">
                        <button type="button" disabled={balancePage === 0} onClick={() => setBalancePage((p) => p - 1)}>Prev</button>
                        <span>Page {balancePage + 1} of {balanceTotalPages}</span>
                        <button type="button" disabled={balancePage >= balanceTotalPages - 1} onClick={() => setBalancePage((p) => p + 1)}>Next</button>
                    </div>
                )}
            </div>

            {addModalOpen && (
                <div className="modalBackdrop" onClick={() => setAddModalOpen(false)}>
                    <div className="modalCard" onClick={(e) => e.stopPropagation()}>
                        <div className="modalTitle">Add Equipment</div>

                        <Field label="Equipment Type">
                            <select className="input" value={addType} onChange={(e) => setAddType(e.target.value as EquipmentType)}>
                                <option value="Pipette">Pipette</option>
                                <option value="Balance">Balance</option>
                            </select>
                        </Field>

                        {addType === 'Pipette' ? (
                            <>
                                <Field label="Pipette ID">
                                    <input className="input" value={pipetteId} onChange={(e) => setPipetteId(e.target.value)} placeholder="e.g. PI-099" />
                                </Field>
                                <Field label="Category">
                                    <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                                        {CATEGORIES.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Pipette Range">
                                    <input className="input" value={pipetteRange} onChange={(e) => updatePipetteRange(e.target.value)} placeholder="e.g. 20-200 uL" />
                                </Field>
                                <Field label="Calibration Due Date">
                                    <input className="input" value={pipetteCalDate} onChange={(e) => setPipetteCalDate(e.target.value)} placeholder="YYYY-MM-DD" />
                                </Field>
                                <Field label="Unit">
                                    <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as EquipmentUnit)}>
                                        {UNITS.map((u) => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </Field>
                                <div className="pointRow">
                                    <div className="pointField">
                                        <label className="label">Low ({unit})</label>
                                        <input className="input" value={lowUl} onChange={(e) => setLowUl(e.target.value)} inputMode="decimal" />
                                    </div>
                                    <div className="pointField">
                                        <label className="label">Mid ({unit})</label>
                                        <input className="input" value={midUl} onChange={(e) => setMidUl(e.target.value)} inputMode="decimal" />
                                    </div>
                                    <div className="pointField">
                                        <label className="label">High ({unit})</label>
                                        <input className="input" value={highUl} onChange={(e) => setHighUl(e.target.value)} inputMode="decimal" />
                                    </div>
                                </div>
                                <Field label={`Low Usage (${unit})`}>
                                    <input className="input" value={lowUsageUl} onChange={(e) => setLowUsageUl(e.target.value)} inputMode="decimal" />
                                </Field>
                                <Field label="Status">
                                    <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                                        {STATUSES.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </Field>
                            </>
                        ) : (
                            <>
                                <Field label="Balance ID">
                                    <input className="input" value={balanceId} onChange={(e) => setBalanceId(e.target.value)} placeholder="e.g. BAL-020" />
                                </Field>
                                <Field label="Calibration Due Date">
                                    <input className="input" value={balanceCalDate} onChange={(e) => setBalanceCalDate(e.target.value)} placeholder="YYYY-MM-DD" />
                                </Field>
                            </>
                        )}

                        <button type="button" className="submit" onClick={continueToSignOff}>Continue to Sign-Off</button>
                        <button type="button" className="cancel" onClick={() => setAddModalOpen(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {signOffVisible && (
                <div className="modalBackdrop" onClick={() => setSignOffVisible(false)}>
                    <div className="modalCard" onClick={(e) => e.stopPropagation()}>
                        <div className="modalTitle">Technician Sign-Off</div>

                        <Field label="Technician">
                            <select className="input" value={username} onChange={(e) => setUsername(e.target.value)}>
                                <option value="">Select...</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.username}>{u.username}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="PIN">
                            <input className="input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={6} />
                        </Field>

                        <button type="button" className="submit" onClick={confirmSignOff}>Confirm &amp; Sign</button>
                        <button type="button" className="cancel" onClick={() => { setSignOffVisible(false); setAddModalOpen(true); }}>Back</button>
                    </div>
                </div>
            )}

            {editTarget && (
                <div className="modalBackdrop" onClick={() => setEditTarget(null)}>
                    <div className="modalCard" onClick={(e) => e.stopPropagation()}>
                        <div className="modalTitle">Edit {editTarget.type} -- {editTarget.item.equipment_id}</div>

                        {(editTarget.type === 'Pipette' ? PIPETTE_EDIT_FIELDS : BALANCE_EDIT_FIELDS).map(([key, label]) => (
                            <Field key={key} label={label}>
                                {key === 'status' ? (
                                    <select className="input" value={editFields[key] ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, [key]: e.target.value }))}>
                                        {STATUSES.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                ) : key === 'unit' ? (
                                    <select className="input" value={editFields[key] ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, [key]: e.target.value }))}>
                                        {UNITS.map((u) => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                ) : key === 'category' ? (
                                    <select className="input" value={editFields[key] ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, [key]: e.target.value }))}>
                                        {CATEGORIES.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input className="input" value={editFields[key] ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, [key]: e.target.value }))} />
                                )}
                            </Field>
                        ))}

                        <Field label="Username">
                            <select className="input" value={editUsername} onChange={(e) => setEditUsername(e.target.value)}>
                                <option value="">Select...</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.username}>{u.username}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="PIN">
                            <input className="input" type="password" value={editPin} onChange={(e) => setEditPin(e.target.value)} inputMode="numeric" maxLength={6} />
                        </Field>

                        <button type="button" className="submit" onClick={confirmEdit}>Save</button>
                        <button type="button" className="cancel" onClick={confirmDelete}>Delete Equipment</button>
                        <button type="button" className="cancel" onClick={() => setEditTarget(null)}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}
