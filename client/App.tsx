import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import SignOffForm from './src/screens/SignOffForm';
import AuditLog from './src/screens/AuditLog';
import { watchConnectivityAndDrain } from './src/network';

type Tab = 'signoff' | 'audit';

export default function App() {
  const [tab, setTab] = useState<Tab>('signoff');

  useEffect(() => {
    return watchConnectivityAndDrain((message) => console.warn('Queue drain error:', message));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabBar}>
        <Pressable style={[styles.tabButton, tab === 'signoff' && styles.tabButtonActive]} onPress={() => setTab('signoff')}>
          <Text style={[styles.tabLabel, tab === 'signoff' && styles.tabLabelActive]}>Sign Off</Text>
        </Pressable>
        <Pressable style={[styles.tabButton, tab === 'audit' && styles.tabButtonActive]} onPress={() => setTab('audit')}>
          <Text style={[styles.tabLabel, tab === 'audit' && styles.tabLabelActive]}>Audit Log</Text>
        </Pressable>
      </View>

      {tab === 'signoff' ? <SignOffForm /> : <AuditLog />}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#7ec8e3' },
  tabButton: { flex: 1, padding: 14, alignItems: 'center' },
  tabButtonActive: { borderBottomWidth: 3, borderBottomColor: '#1298c9' },
  tabLabel: { fontWeight: '600', color: '#555' },
  tabLabelActive: { color: '#1298c9' },
});
