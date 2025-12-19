const express = require('express');
const cors = require('cors');
const { transform } = require('./transformer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.text({ type: '*/*' })); // Accept raw text body

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'adapter-hl7-v2', protocols: ['MLLP', 'HTTP'] });
});

// The Main Ingestion Port
app.post('/ingest', (req, res) => {
    console.log(`[HL7-Adapter] Receiving stream...`);
    
    const rawHL7 = req.body;
    
    if (!rawHL7 || typeof rawHL7 !== 'string') {
        return res.status(400).json({ 
            resourceType: "OperationOutcome", 
            issue: [{ severity: "error", code: "structure", diagnostics: "Empty or invalid HL7 payload" }] 
        });
    }

    try {
        console.log(`[HL7-Adapter] Parsing ${rawHL7.length} bytes...`);
        
        // 1. Transform
        const fhirBundle = transform(rawHL7);
        
        // 2. Respond
        console.log(`[HL7-Adapter] Success. Generated Bundle/${fhirBundle.id} with ${fhirBundle.entry.length} resources.`);
        res.json(fhirBundle);

    } catch (error) {
        console.error(`[HL7-Adapter] Conversion Failed:`, error);
        res.status(500).json({ 
            resourceType: "OperationOutcome", 
            issue: [{ severity: "fatal", code: "exception", diagnostics: error.message }] 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🏥 HL7 v2.x Adapter listening on port ${PORT}`);
    console.log(`   - Ready to accept MLLP-over-HTTP`);
});
