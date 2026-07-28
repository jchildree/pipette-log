import { useState } from 'react';
import { setupUser } from '../api';
import './EquipmentManager.css';

export default function SignUp() {
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    async function submit() {
        setError(null);
        setStatus(null);
        if (!username || !pin) {
            setError('Username and PIN are required.');
            return;
        }
        if (pin !== confirmPin) {
            setError('PINs do not match.');
            return;
        }
        try {
            await setupUser({ username, pin });
            setStatus(`Account created for ${username}. Use it on the Sign Off tab.`);
            setUsername('');
            setPin('');
            setConfirmPin('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create account.');
        }
    }

    return (
        <div className="container">
            <div className="card">
                <span className="cardTitle">Sign Up</span>
                <label className="label">Username</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
                <label className="label">PIN</label>
                <input className="input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={6} />
                <label className="label">Confirm PIN</label>
                <input className="input" type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} inputMode="numeric" maxLength={6} />
                {error && <div className="error">{error}</div>}
                {status && <div className="status">{status}</div>}
                <button type="button" className="submit" onClick={submit}>
                    Create Account
                </button>
            </div>
        </div>
    );
}
