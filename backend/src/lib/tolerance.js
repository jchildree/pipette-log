function tolerance3pct(volumeUl, massMg) {
    const lower = 0.97 * volumeUl;
    const upper = 1.03 * volumeUl;
    return massMg >= lower && massMg <= upper ? 'Y' : 'N';
}

module.exports = { tolerance3pct };
