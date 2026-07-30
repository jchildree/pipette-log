import { createContext, useContext, useState } from 'react';
import { fetchAllUsers } from '../api';
import { useToast } from '../toast/ToastProvider';
import './admin.css';

// In-memory only (never persisted) -- gates admin-only UI and pre-fills the
// credential prompt for admin actions (equipment add, user management).
// Sign-off/correction flows are untouched: they still ask for tech+PIN fresh
// every time (ADR-004 per-action attestation), this session is layered on top.
interface AdminSessionValue {
    isAdmin: boolean;
    username: string;
    pin: string;
    logout: () => void;
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
    const [isAdmin, setIsAdmin] = useState(false);
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [loginOpen, setLoginOpen] = useState(false);
    const [formUsername, setFormUsername] = useState('');
    const [formPin, setFormPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    function logout() {
        setIsAdmin(false);
        setUsername('');
        setPin('');
        toast.success('Admin logged out.');
    }

    async function submitLogin() {
        setError(null);
        try {
            await fetchAllUsers({ admin_username: formUsername, admin_pin: formPin });
            setUsername(formUsername);
            setPin(formPin);
            setIsAdmin(true);
            setLoginOpen(false);
            toast.success(`Logged in as admin (${formUsername}).`);
            setFormUsername('');
            setFormPin('');
        } catch {
            setError('Invalid admin credentials.');
        }
    }

    return (
        <AdminSessionContext.Provider value={{ isAdmin, username, pin, logout }}>
            <div className="adminBar">
                {isAdmin ? (
                    <>
                        <span className="adminBadge">Admin: {username}</span>
                        <button type="button" className="adminLink" onClick={logout}>Log out</button>
                    </>
                ) : (
                    <button type="button" className="adminLink" onClick={() => setLoginOpen(true)}>Admin Login</button>
                )}
            </div>

            {children}

            {loginOpen && (
                <div className="modalBackdrop" onClick={() => setLoginOpen(false)}>
                    <div className="modalCard" onClick={(e) => e.stopPropagation()}>
                        <div className="modalTitle">Admin Login</div>
                        <label className="label">Username</label>
                        <input className="input" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} autoCapitalize="none" />
                        <label className="label">PIN</label>
                        <input className="input" type="password" value={formPin} onChange={(e) => setFormPin(e.target.value)} inputMode="numeric" maxLength={6} />
                        {error && <div className="error">{error}</div>}
                        <button type="button" className="submit" onClick={submitLogin}>Log In</button>
                        <button type="button" className="cancel" onClick={() => setLoginOpen(false)}>Cancel</button>
                    </div>
                </div>
            )}
        </AdminSessionContext.Provider>
    );
}

export function useAdminSession(): AdminSessionValue {
    const ctx = useContext(AdminSessionContext);
    if (!ctx) throw new Error('useAdminSession must be used within an AdminSessionProvider');
    return ctx;
}
