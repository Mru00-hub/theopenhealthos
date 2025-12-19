const express = require('express');
const cors = require('cors');
const logic = require('./logic');

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'terminology-snomed', version: '2025-01-Lite' });
});

/**
 * GET /lookup?term=...
 * Used by UI or Aligner to find codes for raw text.
 */
app.get('/lookup', (req, res) => {
    const { term } = req.query;
    if (!term) return res.status(400).json({ error: "Query parameter 'term' required" });
    
    const matches = logic.lookup(term);
    res.json({ count: matches.length, matches });
});

/**
 * POST /validate
 * Used by HPS to verify incoming codes.
 * Body: { "code": "22298006" }
 */
app.post('/validate', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Body field 'code' required" });

    const result = logic.validate(code);
    res.json(result);
});

/**
 * GET /concept/:code
 * Returns rich hierarchy data for the Context Dashboard.
 */
app.get('/concept/:code', (req, res) => {
    const details = logic.getDetails(req.params.code);
    if (!details) return res.status(404).json({ error: "Concept not found" });
    res.json(details);
});

app.listen(PORT, () => {
    console.log(`🧠 SNOMED Terminology Service listening on port ${PORT}`);
    console.log(`   - Loaded ${require('./logic').lookup("").length} concepts`);
});
