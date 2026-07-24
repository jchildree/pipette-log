import { useEffect, useState } from 'react';
import SignOffForm from './screens/SignOffForm';
import AuditLog from './screens/AuditLog';
import EquipmentManager from './screens/EquipmentManager';
import { watchConnectivityAndDrain } from './network';

type Tab = 'signoff' | 'audit' | 'equipment';

const TABS: { key: Tab; label: string }[] = [
    { key: 'signoff', label: 'Sign Off' },
    { key: 'audit', label: 'Audit Log' },
    { key: 'equipment', label: 'Equipment' },
];

export default function App() {
    const [tab, setTab] = useState<Tab>('signoff');

    useEffect(() => {
        return watchConnectivityAndDrain((message) => console.warn('Queue drain error:', message));
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--brand-border)' }}>
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            flex: 1,
                            padding: 14,
                            textAlign: 'center',
                            fontWeight: 600,
                            border: 'none',
                            borderBottom: tab === t.key ? '3px solid var(--brand-blue)' : '3px solid transparent',
                            color: tab === t.key ? 'var(--brand-blue)' : '#555',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'signoff' && <SignOffForm />}
            {tab === 'audit' && <AuditLog />}
            {tab === 'equipment' && <EquipmentManager />}
        </div>
    );
}
