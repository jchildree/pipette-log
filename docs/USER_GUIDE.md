# Pipette Log -- User Guide

Plain-language guide to setting up and using the Pipette Log app. For technical/architecture details, see the root [`README.md`](../README.md).

## 1. What this app does

Pipette Log replaces paper calibration sign-off sheets. A technician picks a pipette (or repeater tip) and a balance, weighs out Low/Mid/High volumes, and signs off with a username + PIN. The app calculates pass/fail automatically and keeps a permanent, correctable audit trail -- nothing is ever silently overwritten.

## 2. Getting set up

### 2a. If IT already gave you a URL

Just open it in a browser (Chrome/Edge/Firefox). Nothing to install. Skip to [Section 3](#3-first-time-setup-in-the-app).

### 2b. If you're standing this up for the first time

You need three things running: a database, the backend server, and the client (web page). Full commands are in the root `README.md` under "Building from source" -- short version:

1. **Database** -- needs [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed. Copy `.env.example` to `.env`, set a password, run `docker compose up -d`. This starts SQL Server and creates all the tables.
2. **Backend** -- needs [Node.js](https://nodejs.org/) installed. In `backend/`, copy `.env.example` to `.env` (same password as step 1), run `npm install` then `npm start`.
3. **Client** -- either serve the pre-built `client/dist/` folder (e.g. `npx serve -l 8081 client/dist`), or build it yourself from `client/` with `npm install && npm run build`.

Once all three are running, open the client's address in a browser (default `http://localhost:8081`).

## 3. First-time setup in the app

### 3a. Bootstrap the first admin (IT/one-time)

There's no "sign up as admin" button in the app on purpose -- the very first admin account has to be created from the command line, so it can't be self-granted by any browser user:

```bash
node backend/scripts/seed-admin.js <username> <pin>
```

### 3b. Load reference data (IT/one-time)

Pipettes, balances, and repeater tips need to exist before anyone can sign off a verification:

```bash
cd backend
node scripts/seed-equipment.js scripts/equipment.json   # pipettes + balances
node scripts/seed-tips.js scripts/tips.json               # repeater tip targets
```

These JSON files are generated from the lab's inventory spreadsheet. If the real inventory changes, regenerate them with `node scripts/xlsx-to-equipment-json.js` / `xlsx-to-tips-json.js` rather than hand-editing the JSON.

### 3c. Everyone else: create your own login

Go to the **Users** tab and create a username + 6-digit PIN. No approval step -- as soon as it's created, you can sign verifications with it.

## 4. Using the app day to day

The app has four tabs across the top.

### New Verification (main screen)

1. Pick a **Pipette** (or a **Tip** if it's a repeater pipette) and a **Balance** from the dropdowns.
2. Enter the **Volume** and **Mass** you measured for Low, Mid, and High (and for every channel, if it's a multichannel pipette).
3. Pass/fail is calculated automatically at ±3% tolerance -- you don't set it yourself.
4. If this verification follows an external calibration, check **After External Calibration**. This is just a flag/note on the record; it doesn't change the pass/fail math, and it requires you to type a short note.
5. If a reading fails tolerance, that field clears itself so you can retry -- your failed attempt isn't lost, it's kept as a retry attempt you can review later. If you want to keep a failing reading as the final answer anyway, click **Accept this result** on it (you'll need to add a note explaining why).
6. Click **Sign & Submit**, then enter your username + PIN to sign the record.

### Audit Log

Browse every signed entry. Filter by pipette or balance. Click any entry to see its full history, including every correction ever made to it.

Made a mistake after signing? Click **Correct This Entry**. You'll need your username, PIN, and a note explaining the correction. The original entry is never deleted or overwritten -- your correction is added on top, and both remain visible in the history.

### Equipment

Browse pipettes and balances as tables (click a row to see full detail). Only admins can add, edit, or delete equipment:

1. Click **Admin Login** (top right of any page) and sign in with an admin account.
2. **+ Add Equipment** appears for adding new pipettes/balances.
3. Each row gets an **Edit** button -- change any field, or click **Delete Equipment** from inside the edit panel to remove it.

### Users

Create new technician accounts (username + PIN), same self-service process as initial setup. If you're logged in as an admin, you additionally see:
- A checkbox to create a new account as an admin.
- A table of every user, where you can promote/demote admin status, deactivate/reactivate an account, or unlock a PIN-locked account (locks itself after 5 wrong PIN attempts, for 15 minutes).

## 5. Common questions

**I forgot my PIN.** There's no self-service PIN reset -- ask an admin to deactivate/reactivate your account or have you create a new one. (There's no "reset PIN" button by design; it keeps the sign-off trail meaningfully tied to a person.)

**I locked myself out.** 5 wrong PIN attempts locks the account for 15 minutes, or an admin can unlock it immediately from the Users tab.

**I signed off with the wrong numbers.** Don't delete anything -- go to Audit Log, find the entry, and use **Correct This Entry**. The original stays on record next to your correction.

**The After External Calibration checkbox doesn't seem to change anything.** Correct -- as of the current version it's note-only. Pass/fail is always auto-computed at ±3% tolerance regardless of that checkbox.

**Where does the equipment list come from?** IT loads it from the lab's inventory spreadsheet via `seed-equipment.js` / `seed-tips.js`. Day-to-day equipment edits/deletes can be done in-app by an admin (see Equipment tab above); bulk reloads from a new spreadsheet still go through IT.
