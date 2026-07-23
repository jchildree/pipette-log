import { useEffect, useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchBalances, fetchEntries, fetchEntryHistory, fetchPipettes } from '../api';
import { AuditEntry, Balance, Pipette, PointKey, VerificationType } from '../types';

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

function PassBadge({ pass }: { pass: 'Y' | 'N' | null }) {
    if (pass === null) return <Text style={styles.badgeNeutral}>--</Text>;
    return <Text style={pass === 'Y' ? styles.badgePass : styles.badgeFail}>{pass}</Text>;
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

    useEffect(() => {
        loadEntries();
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
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Audit Log</Text>

            <View style={styles.filterRow}>
                <View style={styles.filterField}>
                    <Text style={styles.filterLabel}>Pipette</Text>
                    <Picker selectedValue={pipetteFilter} onValueChange={setPipetteFilter}>
                        <Picker.Item label="All" value={null} />
                        {pipettes.map((p) => (
                            <Picker.Item key={p.id} label={p.equipment_id} value={p.id} />
                        ))}
                    </Picker>
                </View>
                <View style={styles.filterField}>
                    <Text style={styles.filterLabel}>Balance</Text>
                    <Picker selectedValue={balanceFilter} onValueChange={setBalanceFilter}>
                        <Picker.Item label="All" value={null} />
                        {balances.map((b) => (
                            <Picker.Item key={b.id} label={b.equipment_id} value={b.id} />
                        ))}
                    </Picker>
                </View>
            </View>

            {loading && <Text style={styles.status}>Loading...</Text>}
            {error && <Text style={styles.error}>{error}</Text>}
            {!loading && !error && entries.length === 0 && <Text style={styles.status}>No entries found.</Text>}

            {entries.map((entry) => (
                <Pressable key={entry.id} style={styles.entryCard} onPress={() => openHistory(entry)}>
                    <View style={styles.entryHeader}>
                        <Text style={styles.entryDate}>{entry.signed_at ? new Date(entry.signed_at).toLocaleString() : 'unsigned'}</Text>
                        {!!entry.corrected && <Text style={styles.correctedTag}>corrected</Text>}
                    </View>
                    <Text style={styles.entryMeta}>
                        {VERIFICATION_TYPE_LABELS[entry.verification_type]} · Pipette {entry.pipette_equipment_id ?? entry.pipette_id} · Balance{' '}
                        {entry.balance_equipment_id ?? entry.balance_id} · Signed by {entry.signed_by_username ?? entry.signed_by_user_id}
                    </Text>
                    <View style={styles.pointRow}>
                        {POINTS.map(({ key, label }) => {
                            const v = pointValues(entry, key);
                            return (
                                <View style={styles.pointCell} key={key}>
                                    <Text style={styles.pointLabel}>{label}</Text>
                                    <Text style={styles.pointValue}>
                                        {v.volume}µL / {v.mass}mg
                                    </Text>
                                    <PassBadge pass={v.pass} />
                                </View>
                            );
                        })}
                    </View>
                    {entry.note && <Text style={styles.entryNote}>Note: {entry.note}</Text>}
                </Pressable>
            ))}

            <Modal visible={historyFor !== null} transparent animationType="fade" onRequestClose={() => setHistoryFor(null)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Entry History</Text>
                        <ScrollView style={styles.historyScroll}>
                            {history.map((h, i) => (
                                <View key={h.id} style={styles.historyRow}>
                                    <Text style={styles.historyRowTitle}>
                                        {i === 0 ? 'Original' : `Correction ${i}`} (id {h.id}) -- {h.signed_at ? new Date(h.signed_at).toLocaleString() : 'unsigned'}
                                    </Text>
                                    {POINTS.map(({ key, label }) => {
                                        const v = pointValues(h, key);
                                        return (
                                            <Text key={key} style={styles.historyPointLine}>
                                                {label}: {v.volume}µL / {v.mass}mg &rarr; {v.pass ?? '--'}
                                            </Text>
                                        );
                                    })}
                                    {h.note && <Text style={styles.historyNote}>Note: {h.note}</Text>}
                                </View>
                            ))}
                        </ScrollView>
                        <Text style={styles.closeButton} onPress={() => setHistoryFor(null)}>
                            Close
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
    title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
    status: { marginTop: 12, textAlign: 'center', color: '#555' },
    error: { marginTop: 12, textAlign: 'center', color: '#b91c1c' },

    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
    filterField: { flexGrow: 1, flexBasis: 160, backgroundColor: BRAND_LIGHT, borderWidth: 1, borderColor: BRAND_BORDER, borderRadius: 8, padding: 8 },
    filterLabel: { fontWeight: '600', fontSize: 12 },

    entryCard: { borderWidth: 1, borderColor: BRAND_BORDER, borderRadius: 8, padding: 12, marginTop: 10, backgroundColor: '#fff' },
    entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    entryDate: { fontWeight: '700' },
    correctedTag: { backgroundColor: '#fde68a', color: '#78350f', fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    entryMeta: { color: '#1a4d5c', fontSize: 12, marginTop: 2 },
    entryNote: { marginTop: 6, fontStyle: 'italic', color: '#555' },

    pointRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    pointCell: { flex: 1, backgroundColor: '#eef7fb', borderRadius: 6, padding: 6, alignItems: 'center' },
    pointLabel: { fontWeight: '700', fontSize: 12 },
    pointValue: { fontSize: 11, color: '#333' },
    badgePass: { color: '#166534', fontWeight: '700' },
    badgeFail: { color: '#b91c1c', fontWeight: '700' },
    badgeNeutral: { color: '#777' },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, maxHeight: '80%' },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
    historyScroll: { maxHeight: 400 },
    historyRow: { borderTopWidth: 1, borderTopColor: BRAND_BORDER, paddingVertical: 8 },
    historyRowTitle: { fontWeight: '700', marginBottom: 4 },
    historyPointLine: { fontSize: 12, color: '#333' },
    historyNote: { marginTop: 4, fontStyle: 'italic', color: '#555' },
    closeButton: { marginTop: 16, textAlign: 'center', backgroundColor: BRAND_BLUE, color: '#fff', padding: 10, borderRadius: 8, fontWeight: '600' },
});
