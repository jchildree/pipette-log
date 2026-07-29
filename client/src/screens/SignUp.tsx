import { useState } from 'react';
import { signUp } from '../api';

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
        <div style={{ padding: 16, maxWidth: 360 }}>
            <h2>Sign Up</h2>
            <p>Create a username and 6-digit PIN for signing off entries.</p>

            <label>
                Username
                <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <br />
            <label>
                PIN
                <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
            </label>
            <br />
            <label>
                Confirm PIN
                <input
                    type="password"
                    inputMode="numeric"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                />
            </label>
            <br />
            <button onClick={submit}>Sign Up</button>

            {error && <p style={{ color: 'red' }}>{error}</p>}
            {status && <p style={{ color: 'green' }}>{status}</p>}
        </div>
    );
}
