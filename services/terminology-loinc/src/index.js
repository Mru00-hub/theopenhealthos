const express = require('express');
const cors = require('cors');
const logic = require('./logic');

const app = express();
const PORT = process.env.PORT || 3011;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'terminology-loinc', version: '2.74-Lite' });
});

/**
 * GET /resolve?term=...
 * The main mapping endpoint.
 * Example: /resolve?term=Pulse -> Returns LOINC 8867-4
 */
app.get('/resolve', (req, res) => {
    const { term } = req.query;
    if (!term) return res.status(400).json({ error: "Query param 'term' required" });

    const match = logic.normalize(term);
    
    if (match) {
        res.json({ found: true, concept: match });
    } else {
        res.json({ found: false, message: "No matching LOINC code found" });
    }
});

/**
 * POST /validate
 * Validates strictly by code.
 */
app.post('/validate', (req, res) => {
    const { code } = req.body;
    const result = logic.validate(code);
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`🩸 LOINC Terminology Service listening on port ${PORT}`);
    console.log(`   - Ready to standardize Labs & Vitals`);
});
