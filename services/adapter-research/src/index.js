const express = require('express');
const cors = require('cors');
const { transformStudy, transformSubject } = require('./transformer');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json()); // Expecting JSON

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'adapter-research', 
        version: '1.0.0',
        supported_standards: ['CDISC-ODM (Mock)', 'JSON-Protocol'] 
    });
});

/**
 * POST /ingest/protocol
 * Ingests a new Clinical Trial Definition.
 * Body: { "protocol_id": "ONCO-2025-001", "title": "...", "phase": 2 }
 */
app.post('/ingest/protocol', (req, res) => {
    console.log(`[Research-Adapter] Ingesting New Protocol Definition...`);
    try {
        const fhirBundle = transformStudy(req.body);
        console.log(`[Research-Adapter] Created Study: ${req.body.protocol_id}`);
        res.json(fhirBundle);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ingest/subject
 * Enrolls a patient into a trial.
 * Query: ?patient=Patient/123
 * Body: { "protocol_id": "ONCO-2025-001", "status": "enrolled", "arm_group": "Experimental" }
 */
app.post('/ingest/subject', (req, res) => {
    const patientRef = req.query.patient || "Patient/UNKNOWN";
    console.log(`[Research-Adapter] Enrolling ${patientRef} into trial...`);
    
    try {
        const fhirBundle = transformSubject(req.body, patientRef);
        console.log(`[Research-Adapter] Enrollment Successful.`);
        res.json(fhirBundle);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🧪 Research Adapter listening on port ${PORT}`);
    console.log(`   - Ready for Clinical Trial Protocols`);
});
