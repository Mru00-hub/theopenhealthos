const express = require('express');
const cors = require('cors');
const logic = require('./logic');

const app = express();
const PORT = process.env.PORT || 3012;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'terminology-rxnorm', version: '2025-01-Lite' });
});

/**
 * GET /lookup?drug=...
 * The main normalization endpoint.
 * Example: /lookup?drug=Tylenol -> Returns RxNorm 161 (Acetaminophen)
 */
app.get('/lookup', (req, res) => {
    const { drug } = req.query;
    if (!drug) return res.status(400).json({ error: "Query param 'drug' required" });

    const match = logic.normalize(drug);
    
    if (match) {
        res.json({ found: true, concept: match });
    } else {
        res.json({ found: false, message: "Drug not found in formulary" });
    }
});

/**
 * POST /interaction
 * Checks for interactions between a list of drugs.
 * Body: { "codes": ["11289", "1191"] }
 */
app.post('/interaction', (req, res) => {
    const { codes } = req.body;
    if (!codes || codes.length < 2) return res.json({ interactions: [] });

    const interactions = [];
    
    // Simple O(n^2) check for the simulation
    for (let i = 0; i < codes.length; i++) {
        for (let j = i + 1; j < codes.length; j++) {
            const result = logic.checkInteraction(codes[i], codes[j]);
            if (result) {
                interactions.push({
                    drug_a: codes[i],
                    drug_b: codes[j],
                    ...result
                });
            }
        }
    }

    res.json({ count: interactions.length, interactions });
});

app.listen(PORT, () => {
    console.log(`💊 RxNorm Terminology Service listening on port ${PORT}`);
    console.log(`   - Ready to normalize Medications`);
});
