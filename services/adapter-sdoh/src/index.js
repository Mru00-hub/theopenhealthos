const express = require('express');
const cors = require('cors');
const { transform } = require('./transformer');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json()); // Expecting JSON survey results

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'adapter-sdoh', 
        version: '1.0.0',
        supported_domains: ['Housing', 'Food Security', 'Transportation']
    });
});

/**
 * POST /ingest
 * Receives raw survey JSON and returns FHIR Bundle with Observations.
 * * Query Params:
 * - patient: Reference string (e.g., "Patient/123")
 * * Body Example:
 * {
 * "housing_status": "homeless",
 * "food_security": "insecure",
 * "transportation": "none"
 * }
 */
app.post('/ingest', (req, res) => {
    const patientRef = req.query.patient || "Patient/UNKNOWN";
    console.log(`[SDOH-Adapter] Receiving Survey Data for ${patientRef}...`);

    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
            resourceType: "OperationOutcome",
            issue: [{ severity: "error", code: "required", diagnostics: "Missing survey data" }]
        });
    }

    try {
        // Run the transformation logic
        const fhirBundle = transform(req.body, patientRef);

        console.log(`[SDOH-Adapter] Success. Generated Bundle/${fhirBundle.id} with ${fhirBundle.entry.length} resources.`);
        res.json(fhirBundle);

    } catch (error) {
        console.error(`[SDOH-Adapter] Ingestion Failed:`, error);
        res.status(500).json({
            resourceType: "OperationOutcome",
            issue: [{ severity: "fatal", code: "exception", diagnostics: error.message }]
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🏘️  SDOH Adapter listening on port ${PORT}`);
    console.log(`   - Ready to ingest Social Surveys`);
});
