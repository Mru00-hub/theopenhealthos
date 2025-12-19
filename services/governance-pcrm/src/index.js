const express = require('express');
const cors = require('cors');
const { evaluateRequest, updatePolicy } = require('./policy');

const app = express();
const PORT = process.env.PORT || 3020;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'governance-pcrm', 
        standards: ['FHIR Consent', 'Granular Privacy'] 
    });
});

/**
 * POST /check-access
 * The Gatekeeper Endpoint.
 * Body: { 
 * "patientId": "1001", 
 * "resourceType": "MolecularSequence", 
 * "actorRole": "RESEARCHER" 
 * }
 */
app.post('/check-access', (req, res) => {
    try {
        const decision = evaluateRequest(req.body);
        console.log(`[PCRM] Request: ${req.body.actorRole} -> ${req.body.resourceType} | Decision: ${decision.decision}`);
        res.json(decision);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /manage-consent
 * Endpoint for the Patient Portal UI to toggle settings.
 */
app.post('/manage-consent', (req, res) => {
    const { patientId, toggle } = req.body;
    const result = updatePolicy(patientId, toggle);
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`🛡️ PCRM Governance Service listening on port ${PORT}`);
    console.log(`   - Enforcing Patient Consent Policies`);
});
