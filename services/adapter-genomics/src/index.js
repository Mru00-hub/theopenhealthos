const express = require('express');
const cors = require('cors');
const { transform } = require('./transformer');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());

// IMPORTANT: Parse text/plain for VCF files
app.use(express.text({ type: ['text/plain', 'application/json'], limit: '10mb' }));

app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'adapter-genomics', supported_formats: ['VCF v4.2', 'HGVS'] });
});

/**
 * POST /ingest
 * Accepts raw VCF string.
 */
app.post('/ingest', (req, res) => {
    const patientRef = req.query.patient || "Patient/UNKNOWN";
    console.log(`[Genomics] Processing sequence for ${patientRef}...`);

    try {
        // Handle case where body might be JSON wrapped string
        let rawData = req.body;
        if (typeof rawData === 'object' && rawData.content) {
            rawData = rawData.content;
        }

        const fhirResource = transform(rawData, patientRef);
        
        console.log(`[Genomics] Success. Mapped to ${fhirResource.id}`);
        res.json(fhirResource);

    } catch (error) {
        console.error(`[Genomics] Error: ${error.message}`);
        res.status(400).json({
            resourceType: "OperationOutcome",
            issue: [{
                severity: "error",
                code: "structure", // The specific error code you likely saw
                diagnostics: error.message
            }]
        });
    }
});

app.listen(PORT, () => {
    console.log(`🧬 Genomics Adapter listening on port ${PORT}`);
});

