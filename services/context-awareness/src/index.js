const express = require('express');
const cors = require('cors');
const { fetchData } = require('./aggregator');
const { synthesize } = require('./synthesizer');
const { applyGovernance } = require('./governance');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'clinical-context-awareness', 
        version: '1.0.0-CrownJewel' 
    });
});

/**
 * GET /context/:patientId
 * The "One API to Rule Them All".
 * Headers: 
 * x-user-role: "PRACTITIONER" | "RESEARCHER"
 * x-purpose: "TREATMENT" | "RESEARCH"
 */
app.get('/context/:patientId', async (req, res) => {
    const { patientId } = req.params;
    const role = req.headers['x-user-role'] || 'UNKNOWN';
    const purpose = req.headers['x-purpose'] || 'UNKNOWN';
    const actor = req.headers['x-actor-id'] || 'anonymous';

    console.log(`[CCA] Generating Context for ${patientId} (Request: ${role}/${purpose})`);

    try {
        // STEP 1: AGGREGATE (Fetch Raw Data from HPS, FHIR, ML)
        const rawData = await fetchData(patientId);

        // STEP 2: SYNTHESIZE (Create Meaning & Insights)
        let context = synthesize(rawData);

        // STEP 3: GOVERN (Filter based on PCRM/RCF rules)
        context = await applyGovernance(context, { actor, role, purpose });

        res.json(context);

    } catch (error) {
        console.error(`[CCA] Failure: ${error.message}`);
        res.status(500).json({ error: "Context Generation Failed" });
    }
});

app.listen(PORT, () => {
    console.log(`👑 Clinical Context Awareness (CCA) listening on port ${PORT}`);
    console.log(`   - The Crown Jewel of TheOpenHealthOS`);
});
