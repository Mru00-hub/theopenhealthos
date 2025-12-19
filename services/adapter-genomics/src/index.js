const express = require('express');
const cors = require('cors');
const { transform } = require('./transformer');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.text({ type: '*/*', limit: '50mb' })); // VCFs can be large

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'adapter-genomics', supported_formats: ['VCFv4.1', 'VCFv4.2'] });
});

// Ingestion Endpoint
app.post('/ingest', (req, res) => {
    console.log(`[Genomics-Adapter] Receiving VCF stream...`);
    
    const rawVCF = req.body;
    
    // Basic validation
    if (!rawVCF || !rawVCF.includes('#CHROM')) {
        return res.status(400).json({ 
            resourceType: "OperationOutcome", 
            issue: [{ severity: "error", code: "structure", diagnostics: "Invalid VCF format: Missing header" }] 
        });
    }

    try {
        const patientId = req.query.patient || "Patient/1001";
        console.log(`[Genomics-Adapter] Processing for ${patientId}...`);
        
        // 1. Transform
        const fhirBundle = transform(rawVCF, patientId);
        
        // 2. Respond
        console.log(`[Genomics-Adapter] Success. Generated ${fhirBundle.entry.length} resources.`);
        res.json(fhirBundle);

    } catch (error) {
        console.error(`[Genomics-Adapter] Parsing Failed:`, error);
        res.status(500).json({ 
            resourceType: "OperationOutcome", 
            issue: [{ severity: "fatal", code: "exception", diagnostics: error.message }] 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🧬 Genomics Adapter listening on port ${PORT}`);
    console.log(`   - Ready for VCF ingestion`);
});
