// One-off: create (or promote) the first admin account, bypassing the app's
// admin-gate since no admin exists yet on a fresh DB. Not part of the app
// runtime -- run manually: node scripts/seed-admin.js <username> <pin>
const { sql, getPool } = require('../src/lib/db');
const { setPin } = require('../src/lib/auth');

async function main() {
    const [username, pin] = process.argv.slice(2);
    if (!username || !pin) {
        console.error('Usage: node scripts/seed-admin.js <username> <pin>');
        process.exit(1);
    }

    await setPin(username, pin);
    const pool = await getPool();
    await pool.request()
        .input('username', sql.NVarChar, username)
        .query('UPDATE users SET is_admin = 1 WHERE username = @username');

    console.log(`${username} is now an admin.`);
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
