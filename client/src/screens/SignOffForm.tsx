import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchBalances, fetchPipettes, fetchUsers, submitEntry } from '../api';
import { getCachedBalances, getCachedPipettes, getCachedUsers, setCachedBalances, setCachedPipettes, setCachedUsers } from '../storage/referenceCache';
import { enqueueEntry } from '../storage/queue';
import { isOnline } from '../network';
import { Balance, EntryPayload, NOTE_REQUIRED_TYPES, Pipette, User, VerificationType } from '../types';

const VERIFICATION_TYPES: VerificationType[] = ['tolerance_3pct', 'manufacturer_spec', 'after_external_cal'];

export default function SignOffForm() {
    const [users, setUsers] = useState<User[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [pipettes, setPipettes] = useState<Pipette[]>([]);

    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [pipetteId, setPipetteId] = useState<number | null>(null);
    const [balanceId, setBalanceId] = useState<number | null>(null);
    const [verificationType, setVerificationType] = useState<VerificationType>('tolerance_3pct');
    const [volumeUl, setVolumeUl] = useState('');
    const [massMg, setMassMg] = useState('');
    const [note, setNote] = useState('');
    const [passFail, setPassFail] = useState<'Y' | 'N'>('Y');

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

    function resetForm() {
        setPin('');
        setVolumeUl('');
        setMassMg('');
        setNote('');
        setPassFail('Y');
    }

    async function handleSubmit() {
        setStatus(null);

        if (!username || !pin || !pipetteId || !balanceId || !volumeUl || !massMg) {
            setStatus('Fill in all required fields.');
            return;
        }
        if (noteRequired && !note) {
            setStatus('Note is required for this verification type.');
            return;
        }

        const payload: EntryPayload = {
            username,
            pin,
            pipette_id: pipetteId,
            balance_id: balanceId,
            verification_type: verificationType,
            volume_ul: Number(volumeUl),
            mass_mg: Number(massMg),
            note: note || undefined,
            pass_fail: passFailEditable ? passFail : undefined,
        };

        const state = await NetInfo.fetch();
        if (isOnline(state)) {
            try {
                await submitEntry(payload);
                setStatus('Entry signed and submitted.');
                resetForm();
            } catch (err) {
                setStatus(err instanceof Error ? err.message : 'Submission failed.');
            }
        } else {
            await enqueueEntry(payload);
            setStatus('Offline -- entry signed and queued, will sync automatically.');
            resetForm();
        }
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.label}>Technician</Text>
            <Picker selectedValue={username} onValueChange={setUsername}>
                <Picker.Item label="Select..." value="" />
                {users.map((u) => (
                    <Picker.Item key={u.id} label={u.username} value={u.username} />
                ))}
            </Picker>

            <Text style={styles.label}>PIN</Text>
            <TextInput style={styles.input} value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} />

            <Text style={styles.label}>Pipette</Text>
            <Picker selectedValue={pipetteId} onValueChange={setPipetteId}>
                <Picker.Item label="Select..." value={null} />
                {pipettes.map((p) => (
                    <Picker.Item key={p.id} label={p.pipette_number} value={p.id} />
                ))}
            </Picker>

            <Text style={styles.label}>Balance</Text>
            <Picker selectedValue={balanceId} onValueChange={setBalanceId}>
                <Picker.Item label="Select..." value={null} />
                {balances.map((b) => (
                    <Picker.Item key={b.id} label={b.name} value={b.id} />
                ))}
            </Picker>

            <Text style={styles.label}>Verification Type</Text>
            <Picker selectedValue={verificationType} onValueChange={setVerificationType}>
                {VERIFICATION_TYPES.map((t) => (
                    <Picker.Item key={t} label={t} value={t} />
                ))}
            </Picker>

            <Text style={styles.label}>Volume (uL)</Text>
            <TextInput style={styles.input} value={volumeUl} onChangeText={setVolumeUl} keyboardType="decimal-pad" />

            <Text style={styles.label}>Mass (mg)</Text>
            <TextInput style={styles.input} value={massMg} onChangeText={setMassMg} keyboardType="decimal-pad" />

            <Text style={styles.label}>Note{noteRequired ? ' (required)' : ' (optional)'}</Text>
            <TextInput style={styles.input} value={note} onChangeText={setNote} multiline />

            <Text style={styles.label}>Pass / Fail</Text>
            {passFailEditable ? (
                <Picker selectedValue={passFail} onValueChange={setPassFail}>
                    <Picker.Item label="Pass (Y)" value="Y" />
                    <Picker.Item label="Fail (N)" value="N" />
                </Picker>
            ) : (
                <Text style={styles.computedNote}>Computed server-side from the 3% tolerance formula.</Text>
            )}

            <Text style={styles.submit} onPress={handleSubmit}>
                Sign &amp; Submit
            </Text>

            {status && <Text style={styles.status}>{status}</Text>}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, gap: 4 },
    label: { fontWeight: '600', marginTop: 12 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginTop: 4 },
    computedNote: { fontStyle: 'italic', color: '#555' },
    submit: { marginTop: 24, textAlign: 'center', backgroundColor: '#2563eb', color: '#fff', padding: 12, borderRadius: 8, fontWeight: '600' },
    status: { marginTop: 12, textAlign: 'center' },
});
