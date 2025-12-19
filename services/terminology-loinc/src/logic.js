const Fuse = require('fuse.js');
const db = require('./data/loinc-lite.json');

// Search configuration
const fuse = new Fuse(db, {
    keys: ['display', 'code', 'keywords'],
    threshold: 0.4,
    includeScore: true
});

/**
 * NORMALIZE: Takes a raw string (e.g., "HR", "Pulse") and finds the LOINC code
 */
const normalize = (rawTerm) => {
    if (!rawTerm) return null;
    
    const results = fuse.search(rawTerm);
    if (results.length === 0) return null;

    // Return the best match
    const best = results[0].item;
    return {
        code: best.code,
        display: best.display,
        system: "http://loinc.org",
        unit: best.unit,
        category: best.category,
        confidence: (1 - results[0].score).toFixed(2)
    };
};

/**
 * VALIDATE: Checks if a code exists (for incoming FHIR validation)
 */
const validate = (code) => {
    const item = db.find(d => d.code === code);
    if (!item) return { valid: false, message: "LOINC code not found" };
    return { valid: true, display: item.display, category: item.category };
};

module.exports = { normalize, validate };
