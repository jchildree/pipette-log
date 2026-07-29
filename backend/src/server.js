const express = require('express');
const cors = require('cors');
const entriesRouter = require('./routes/entries');
const referenceRouter = require('./routes/reference');
const usersRouter = require('./routes/users');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', entriesRouter);
app.use('/api', referenceRouter);
app.use('/api', usersRouter);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => console.log(`Pipette Log backend listening on ${PORT}`));
}

module.exports = app;
