const Fuse = require('fuse.js');
const db = require('./data/snomed-lite.json');

// Initialize Fuzzy Search Engine
const fuse = new Fuse(db, {
    keys: ['display', 'synonyms', 'code'],
    threshold: 0.4, // Sensitivity (0.0 = perfect match, 1.0 = match anything)
    includeScore: true
});

/**
 * LOOKUP: Finds concepts by text
 */
const lookup = (query) => {
    if (!query) return [];
    // Fuzzy search
    const results = fuse.search(query);
    // Format output standard
    return results.map(r => ({
        system: "http://snomed.info/sct",
        code: r.item.code,
        display: r.item.display,
        match_score: (1 - r.score).toFixed(2), // Convert distance to confidence
        category: r.item.category
    })).slice(0, 5); // Return top 5
};

/**
 * VALIDATE: Checks if a code exists
 */
const validate = (code) => {
    const concept = db.find(c => c.code === code);
    if (!concept) return { valid: false, message: "Code not found in terminology server" };
    return {
        valid: true,
        display: concept.display,
        system: "http://snomed.info/sct",
        category: concept.category
    };
};

/**
 * EXPAND: Returns details (Child/Parent relationships)
 */
const getDetails = (code) => {
    const concept = db.find(c => c.code === code);
    if (!concept) return null;

    // Simulate Hierarchy Lookup
    const parent = concept.parent ? db.find(c => c.code === concept.parent) : null;
    
    return {
        ...concept,
        parent_concept: parent ? { code: parent.code, display: parent.display } : null,
        system: "http://snomed.info/sct"
    };
};

module.exports = { lookup, validate, getDetails };
