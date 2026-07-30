import { Fragment, useEffect, useState } from 'react';
import { fetchAllUsers, setupUser, updateUser } from '../api';
import { useAdminSession } from '../admin/AdminSession';
import { useToast } from '../toast/ToastProvider';
import type { FullUser } from '../types';
import './UsersManager.css';

const PAGE_SIZE = 100;

export default function UsersManager() {
    const { isAdmin, username: adminUsername, pin: adminPin } = useAdminSession();
    const toast = useToast();

    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [makeAdmin, setMakeAdmin] = useState(false);

    const [users, setUsers] = useState<FullUser[]>([]);
    const [page, setPage] = useState(0);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        if (isAdmin) loadUsers();
    }, [isAdmin]);

    function loadUsers() {
        fetchAllUsers({ admin_username: adminUsername, admin_pin: adminPin }).then(setUsers).catch(() => {});
    }

    async function submit() {
        if (!username || !pin) {
            toast.error('Username and PIN are required.');
            return;
        }
        if (pin !== confirmPin) {
            toast.error('PINs do not match.');
            return;
        }
        try {
            await setupUser({
                username, pin,
                is_admin: makeAdmin || undefined,
                admin_username: makeAdmin ? adminUsername : undefined,
                admin_pin: makeAdmin ? adminPin : undefined,
            });
            toast.success(`PIN set for ${username}. You can now sign off using it.`);
            setUsername('');
            setPin('');
            setConfirmPin('');
            setMakeAdmin(false);
            if (isAdmin) loadUsers();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Sign up failed.');
        }
    }

    async function toggleAdmin(user: FullUser) {
        try {
            await updateUser(user.id, { admin_username: adminUsername, admin_pin: adminPin, is_admin: !user.is_admin });
            toast.success(`${user.username} is now ${user.is_admin ? 'a regular user' : 'an admin'}.`);
            loadUsers();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Update failed.');
        }
    }

    async function unlock(user: FullUser) {
        try {
            await updateUser(user.id, { admin_username: adminUsername, admin_pin: adminPin, unlock: true });
            toast.success(`${user.username} unlocked.`);
            loadUsers();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Unlock failed.');
        }
    }

    async function toggleActive(user: FullUser) {
        try {
            await updateUser(user.id, { admin_username: adminUsername, admin_pin: adminPin, is_active: !user.is_active });
            toast.success(`${user.username} ${user.is_active ? 'deactivated' : 'reactivated'}.`);
            loadUsers();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Update failed.');
        }
    }

    const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
    const pagedUsers = users.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

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

                {isAdmin && (
                    <label className="checkboxRow">
                        <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
                        Make this user an admin
                    </label>
                )}

                <button type="button" className="submit" onClick={submit}>Sign Up</button>
            </div>

            {isAdmin && (
                <div className="listCard">
                    <span className="cardTitle">Users ({users.length})</span>
                    <div className="tableScroll">
                        <table className="eqTable">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Admin</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedUsers.map((u) => {
                                    const locked = !!u.locked_until && new Date(u.locked_until) > new Date();
                                    const statusLabel = !u.is_active ? 'Deactivated' : locked ? 'Locked' : 'Active';
                                    return (
                                        <Fragment key={u.id}>
                                            <tr className="eqRow" onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
                                                <td>{u.username}</td>
                                                <td>{u.is_admin ? 'Yes' : 'No'}</td>
                                                <td>{statusLabel}</td>
                                                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    <button type="button" className="rowAction" onClick={(e) => { e.stopPropagation(); toggleAdmin(u); }}>
                                                        {u.is_admin ? 'Demote' : 'Promote'}
                                                    </button>
                                                    <button type="button" className="rowAction" onClick={(e) => { e.stopPropagation(); toggleActive(u); }}>
                                                        {u.is_active ? 'Deactivate' : 'Reactivate'}
                                                    </button>
                                                    {locked && (
                                                        <button type="button" className="rowAction" onClick={(e) => { e.stopPropagation(); unlock(u); }}>
                                                            Unlock
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {expandedId === u.id && (
                                                <tr className="eqDetailRow">
                                                    <td colSpan={5}>
                                                        <div className="eqDetailGrid">
                                                            <span>Failed Attempts: {u.failed_attempts}</span>
                                                            <span>Locked Until: {u.locked_until ?? 'n/a'}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <div className="pager">
                            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
                            <span>Page {page + 1} of {totalPages}</span>
                            <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
