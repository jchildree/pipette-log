import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchBalances, fetchPipettes, fetchUsers, submitEntry } from '../api';
import { getCachedBalances, getCachedPipettes, getCachedUsers, setCachedBalances, setCachedPipettes, setCachedUsers } from '../storage/referenceCache';
import { enqueueEntry } from '../storage/queue';
import { isOnline } from '../network';
import { Balance, EntryPayload, NOTE_REQUIRED_TYPES, Pipette, PointKey, User, VerificationType } from '../types';

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

interface PointRow {
    volumeUl: string;
    massMg: string;
    passFail: 'Y' | 'N';
}

const EMPTY_ROW: PointRow = { volumeUl: '', massMg: '', passFail: 'Y' };

function emptyRows(): Record<PointKey, PointRow> {
    return { low: { ...EMPTY_ROW }, mid: { ...EMPTY_ROW }, high: { ...EMPTY_ROW } };
}

export default function SignOffForm() {
    const [users, setUsers] = useState<User[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [pipettes, setPipettes] = useState<Pipette[]>([]);

    const [pipetteId, setPipetteId] = useState<number | null>(null);
    const [balanceId, setBalanceId] = useState<number | null>(null);
    const [verificationType, setVerificationType] = useState<VerificationType>('tolerance_3pct');
    const [rows, setRows] = useState<Record<PointKey, PointRow>>(emptyRows());
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
        const state = await NetInfo.fetch();
        if (isOnline(state)) {
            try {
                const [freshUsers, freshBalances, freshPipettes] = await Promise.all([fetchUsers(), fetchBalances(), fetchPipettes()]);
                setUsers(freshUsers);
                setBalances(freshBalances);
                setPipettes(freshPipettes);
                await Promise.all([setCachedUsers(freshUsers), setCachedBalances(freshBalances), setCachedPipettes(freshPipettes)]);
                return;
            } catch {
                // fall through to cache below
            }
        }
        const [cachedUsers, cachedBalances, cachedPipettes] = await Promise.all([getCachedUsers(), getCachedBalances(), getCachedPipettes()]);
        setUsers(cachedUsers);
        setBalances(cachedBalances);
        setPipettes(cachedPipettes);
    }

    const noteRequired = NOTE_REQUIRED_TYPES.includes(verificationType);
    const passFailEditable = verificationType !== 'tolerance_3pct';
    const selectedPipette = pipettes.find((p) => p.id === pipetteId) ?? null;
    const selectedBalance = balances.find((b) => b.id === balanceId) ?? null;

    // Pre-fill each point's Volume from the pipette's reference low/mid/high (editable, per ADR-009).
    useEffect(() => {
        if (!selectedPipette) return;
        setRows((prev) => ({
            low: { ...prev.low, volumeUl: prev.low.volumeUl || (selectedPipette.low_ul != null ? String(selectedPipette.low_ul) : '') },
            mid: { ...prev.mid, volumeUl: prev.mid.volumeUl || (selectedPipette.mid_ul != null ? String(selectedPipette.mid_ul) : '') },
            high: { ...prev.high, volumeUl: prev.high.volumeUl || (selectedPipette.high_ul != null ? String(selectedPipette.high_ul) : '') },
        }));
    }, [selectedPipette]);

    function updateRow(key: PointKey, field: keyof PointRow, value: string) {
        setRows((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    }

    function resetForm() {
        setRows(emptyRows());
        setNote('');
        setUsername('');
        setPin('');
    }

    function openSignOff() {
        setStatus(null);

        const allFilled = POINTS.every(({ key }) => rows[key].volumeUl && rows[key].massMg);
        if (!pipetteId || !balanceId || !allFilled) {
            setStatus('Fill in all required fields (Low/Mid/High Volume and Mass).');
            return;
        }
        if (noteRequired && !note) {
            setStatus('Note is required for this verification type.');
            return;
        }

        setSignOffError(null);
        setSignOffVisible(true);
    }

    async function confirmSignOff() {
        if (!username || !pin) {
            setSignOffError('Technician and PIN are required.');
            return;
        }

        const payload: EntryPayload = {
            username,
            pin,
            pipette_id: pipetteId!,
            balance_id: balanceId!,
            verification_type: verificationType,
            points: {
                low: { volume_ul: Number(rows.low.volumeUl), mass_mg: Number(rows.low.massMg), pass_fail: passFailEditable ? rows.low.passFail : undefined },
                mid: { volume_ul: Number(rows.mid.volumeUl), mass_mg: Number(rows.mid.massMg), pass_fail: passFailEditable ? rows.mid.passFail : undefined },
                high: { volume_ul: Number(rows.high.volumeUl), mass_mg: Number(rows.high.massMg), pass_fail: passFailEditable ? rows.high.passFail : undefined },
            },
            note: note || undefined,
        };

        const state = await NetInfo.fetch();
        if (isOnline(state)) {
            try {
                await submitEntry(payload);
                setSignOffVisible(false);
                setStatus('Entry signed and submitted.');
                resetForm();
            } catch (err) {
                setSignOffError(err instanceof Error ? err.message : 'Submission failed.');
            }
        } else {
            await enqueueEntry(payload);
            setSignOffVisible(false);
            setStatus('Offline -- entry signed and queued, will sync automatically.');
            resetForm();
        }
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.cardRow}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Pipette ID</Text>
                    <Picker selectedValue={pipetteId} onValueChange={setPipetteId} style={styles.cardPicker}>
                        <Picker.Item label="Select..." value={null} />
                        {pipettes.map((p) => (
                            <Picker.Item key={p.id} label={p.equipment_id} value={p.id} />
                        ))}
                    </Picker>
                    {selectedPipette && (
                        <View style={styles.cardMeta}>
                            <Text style={styles.cardMetaLine}>Pipette Range: {selectedPipette.pipette_range ?? 'n/a'}</Text>
                            <Text style={styles.cardMetaLine}>Calibration Due Date: {selectedPipette.calibration_due_date ?? 'n/a'}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Balance ID</Text>
                    <Picker selectedValue={balanceId} onValueChange={setBalanceId} style={styles.cardPicker}>
                        <Picker.Item label="Select..." value={null} />
                        {balances.map((b) => (
                            <Picker.Item key={b.id} label={b.equipment_id} value={b.id} />
                        ))}
                    </Picker>
                    {selectedBalance && (
                        <View style={styles.cardMeta}>
                            <Text style={styles.cardMetaLine}>Calibration Due Date: {selectedBalance.calibration_due_date ?? 'n/a'}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Verification Type</Text>
                    {VERIFICATION_TYPES.map((t, i) => (
                        <Pressable key={t.value} style={styles.radioRow} onPress={() => setVerificationType(t.value)}>
                            <View style={[styles.radioOuter, i === 2 && styles.checkboxOuter]}>
                                {verificationType === t.value && <View style={[styles.radioInner, i === 2 && styles.checkboxInner]} />}
                            </View>
                            <Text style={styles.radioLabel}>{t.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, styles.tablePointCell]}> </Text>
                    <Text style={styles.tableHeaderCell}>Volume (µL)</Text>
                    <Text style={styles.tableHeaderCell}>Mass (mg)</Text>
                    <Text style={styles.tableHeaderCell}>Pass (Y/N)</Text>
                </View>
                {POINTS.map(({ key, label }) => (
                    <View style={styles.tableRow} key={key}>
                        <Text style={[styles.tableRowLabel, styles.tablePointCell]}>{label}</Text>
                        <TextInput
                            style={styles.tableCellInput}
                            value={rows[key].volumeUl}
                            onChangeText={(v) => updateRow(key, 'volumeUl', v)}
                            keyboardType="decimal-pad"
                        />
                        <TextInput
                            style={styles.tableCellInput}
                            value={rows[key].massMg}
                            onChangeText={(v) => updateRow(key, 'massMg', v)}
                            keyboardType="decimal-pad"
                        />
                        <View style={styles.tableCellInput}>
                            {passFailEditable ? (
                                <Picker selectedValue={rows[key].passFail} onValueChange={(v) => updateRow(key, 'passFail', v)}>
                                    <Picker.Item label="Y" value="Y" />
                                    <Picker.Item label="N" value="N" />
                                </Picker>
                            ) : (
                                <Text style={styles.computedNote}>auto</Text>
                            )}
                        </View>
                    </View>
                ))}
            </View>

            <Text style={styles.label}>Notes{noteRequired ? ' (required)' : ' (optional)'}</Text>
            <TextInput style={styles.notesBox} value={note} onChangeText={setNote} multiline textAlignVertical="top" />

            <Text style={styles.submit} onPress={openSignOff}>
                Sign &amp; Submit
            </Text>

            {status && <Text style={styles.status}>{status}</Text>}

            <Modal visible={signOffVisible} transparent animationType="fade" onRequestClose={() => setSignOffVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Sign Off</Text>

                        <Text style={styles.label}>Technician</Text>
                        <Picker selectedValue={username} onValueChange={setUsername}>
                            <Picker.Item label="Select..." value="" />
                            {users.map((u) => (
                                <Picker.Item key={u.id} label={u.username} value={u.username} />
                            ))}
                        </Picker>

                        <Text style={styles.label}>PIN</Text>
                        <TextInput style={styles.input} value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} />

                        {signOffError && <Text style={styles.error}>{signOffError}</Text>}

                        <Text style={styles.submit} onPress={confirmSignOff}>
                            Confirm &amp; Sign
                        </Text>
                        <Text style={styles.cancel} onPress={() => setSignOffVisible(false)}>
                            Cancel
                        </Text>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const BRAND_BLUE = '#1298c9';
const BRAND_LIGHT = '#d6ecf7';
const BRAND_BORDER = '#7ec8e3';

const styles = StyleSheet.create({
    container: { padding: 16, gap: 4 },
    label: { fontWeight: '600', marginTop: 12 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginTop: 4 },
    computedNote: { fontStyle: 'italic', color: '#555', padding: 8 },
    submit: { marginTop: 24, textAlign: 'center', backgroundColor: '#2563eb', color: '#fff', padding: 12, borderRadius: 8, fontWeight: '600' },
    status: { marginTop: 12, textAlign: 'center' },
    error: { color: '#b91c1c', marginTop: 8, textAlign: 'center' },
    cancel: { marginTop: 12, textAlign: 'center', color: '#555' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },

    cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: { flexGrow: 1, flexBasis: 220, backgroundColor: BRAND_LIGHT, borderWidth: 1, borderColor: BRAND_BORDER, borderRadius: 8, padding: 12 },
    cardTitle: { fontWeight: '700', marginBottom: 4 },
    cardPicker: { backgroundColor: 'transparent' },
    cardMeta: { marginTop: 8, borderTopWidth: 1, borderTopColor: BRAND_BORDER, paddingTop: 8 },
    cardMetaLine: { fontSize: 12, color: '#1a4d5c' },

    radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: BRAND_BLUE, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND_BLUE },
    checkboxOuter: { borderRadius: 3 },
    checkboxInner: { borderRadius: 1, width: 10, height: 10 },
    radioLabel: { flexShrink: 1 },

    table: { marginTop: 16, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: BRAND_BORDER },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: BRAND_BLUE },
    tableHeaderCell: { flex: 1, color: '#fff', fontWeight: '700', padding: 10, textAlign: 'center' },
    tableRow: { flexDirection: 'row', backgroundColor: '#eef7fb', borderTopWidth: 1, borderTopColor: BRAND_BORDER },
    tableRowLabel: { flex: 1, fontWeight: '600', padding: 10, textAlign: 'center', color: '#1a4d5c' },
    tablePointCell: { flex: 0.6 },
    tableCellInput: { flex: 1, padding: 8, borderLeftWidth: 1, borderLeftColor: BRAND_BORDER, textAlign: 'center' },

    notesBox: {
        marginTop: 4,
        minHeight: 100,
        borderWidth: 1,
        borderColor: BRAND_BORDER,
        backgroundColor: BRAND_LIGHT,
        borderRadius: 8,
        padding: 10,
    },
});
