const express = require('express');
const entriesRouter = require('./routes/entries');
const referenceRouter = require('./routes/reference');
const usersRouter = require('./routes/users');

const app = express();
app.use(express.json());
app.use('/api', entriesRouter);
app.use('/api', referenceRouter);
app.use('/api', usersRouter);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => console.log(`Pipette Log backend listening on ${PORT}`));
}

module.exports = app;
