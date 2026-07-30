import { useEffect, useState } from 'react';
import SignOffForm from './screens/SignOffForm';
import AuditLog from './screens/AuditLog';
import EquipmentManager from './screens/EquipmentManager';
import UsersManager from './screens/UsersManager';
import { AdminSessionProvider } from './admin/AdminSession';
import { watchConnectivityAndDrain } from './network';

type Tab = 'verification' | 'audit' | 'equipment' | 'users';

const TABS: { key: Tab; label: string }[] = [
    { key: 'verification', label: 'New Verification' },
    { key: 'audit', label: 'Audit Log' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'users', label: 'Users' },
];

export default function App() {
    const [tab, setTab] = useState<Tab>('verification');

    useEffect(() => {
        return watchConnectivityAndDrain((message) => console.warn('Queue drain error:', message));
    }, []);

    return (
        <AdminSessionProvider>
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

                {tab === 'verification' && <SignOffForm />}
                {tab === 'audit' && <AuditLog />}
                {tab === 'equipment' && <EquipmentManager />}
                {tab === 'users' && <UsersManager />}
            </div>
        </AdminSessionProvider>
    );
}
