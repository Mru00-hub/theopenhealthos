const Fuse = require('fuse.js');
const db = require('./data/rxnorm-lite.json');

// Search configuration
const fuse = new Fuse(db, {
    keys: ['display', 'synonyms', 'code'],
    threshold: 0.3, // Low threshold to avoid matching "Morphine" with "Metformin"
    includeScore: true
});

/**
 * NORMALIZE: Converts Brand Name -> Generic Ingredient (RxNorm Code)
 */
const normalize = (drugName) => {
    if (!drugName) return null;
    
    const results = fuse.search(drugName);
    if (results.length === 0) return null;

    const best = results[0].item;
    
    // Check if the input was a Brand Name (found in synonyms)
    const isBrand = best.synonyms.some(s => s.toLowerCase().includes(drugName.toLowerCase()));

    return {
        system: "http://www.nlm.nih.gov/research/umls/rxnorm",
        code: best.code,
        display: best.display, // Always returns the Generic Name (Acetaminophen)
        original_term: drugName,
        type: isBrand ? "Brand Name" : "Ingredient",
        drug_class: {
            code: best.class_id,
            display: best.class_name
        },
        confidence: (1 - results[0].score).toFixed(2)
    };
};

/**
 * INTERACTION CHECKER (Mock): 
 * Checks if two drug codes have a known interaction.
 */
const checkInteraction = (codeA, codeB) => {
    // Mock Interaction Logic
    // Warfarin (11289) + Aspirin (1191) = Bleeding Risk
    if ((codeA === '11289' && codeB === '1191') || (codeA === '1191' && codeB === '11289')) {
        return {
            severity: "high",
            description: "Concurrent use increases risk of bleeding.",
            management: "Monitor INR closely."
        };
    }
    return null;
};

module.exports = { normalize, checkInteraction };
