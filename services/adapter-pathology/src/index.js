const express = require('express');
const cors = require('cors');
const { transform } = require('./transformer');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json()); // Expecting JSON metadata from the scanner

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'adapter-pathology', 
        version: '1.0.0',
        capabilities: ['WSI-Metadata', 'Specimen-Linking']
    });
});

/**
 * POST /ingest
 * Receives scanner metadata and returns FHIR Bundle.
 * * Query Params:
 * - patient: Reference string (e.g., "Patient/123")
 * * Body Example:
 * {
 * "slideId": "SLIDE-2024-X99",
 * "magnification": 40,
 * "stain": "H&E",
 * "bodySite": "Liver",
 * "scannerModel": "Leica Aperio",
 * "scanDate": "2024-12-20T10:00:00Z"
 * }
 */
app.post('/ingest', (req, res) => {
    const patientRef = req.query.patient || "Patient/UNKNOWN";
    console.log(`[Pathology-Adapter] Receiving Slide Data for ${patientRef}...`);

    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
            resourceType: "OperationOutcome",
            issue: [{ severity: "error", code: "required", diagnostics: "Missing JSON metadata body" }]
        });
    }

    try {
        // Run the transformation logic
        const fhirBundle = transform(req.body, patientRef);

        console.log(`[Pathology-Adapter] Success. Generated Bundle/${fhirBundle.id} with ${fhirBundle.entry.length} resources.`);
        res.json(fhirBundle);

    } catch (error) {
        console.error(`[Pathology-Adapter] Ingestion Failed:`, error);
        res.status(500).json({
            resourceType: "OperationOutcome",
            issue: [{ severity: "fatal", code: "exception", diagnostics: error.message }]
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🔬 Pathology Adapter listening on port ${PORT}`);
    console.log(`   - Ready to ingest WSI metadata`);
});
