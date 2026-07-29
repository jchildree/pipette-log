import { useState } from 'react';
import { signUp } from '../api';
import './SignUp.css';

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
            await signUp({ username, pin });
            setStatus(`PIN set for ${username}. You can now sign off using it.`);
            setUsername('');
            setPin('');
            setConfirmPin('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Sign up failed.');
        }
    }

    return (
        <div className="container">
            <div className="card">
                <span className="cardTitle">Sign Up</span>
                <span className="cardHint">Create a username and 6-digit PIN for signing off entries.</span>

                <label className="label">Username</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />

                <label className="label">PIN</label>
                <input className="input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={6} />

                <label className="label">Confirm PIN</label>
                <input className="input" type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} inputMode="numeric" maxLength={6} />

                <button className="submit" onClick={submit}>Sign Up</button>

                {error && <div className="error">{error}</div>}
                {status && <div className="status">{status}</div>}
            </div>
        </div>
    );
}
