const express = require('express');
const cors = require('cors');
const { toOMOP } = require('./mapper');

const app = express();
const PORT = process.env.PORT || 3016;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'mapper-canonical', 
        target_schema: 'OMOP CDM v5.4',
        supported_tables: ['PERSON', 'CONDITION', 'DRUG', 'MEASUREMENT']
    });
});

/**
 * POST /convert
 * Converts a FHIR Bundle into OMOP CDM JSON tables.
 * Used by the "Research View" in the dashboard.
 */
app.post('/convert', (req, res) => {
    const fhirBundle = req.body;
    
    if (!fhirBundle || !fhirBundle.entry) {
        return res.status(400).json({ error: "Invalid FHIR Bundle" });
    }

    console.log(`[Canonical] Transforming ${fhirBundle.entry.length} resources to OMOP...`);
    
    try {
        const omopData = toOMOP(fhirBundle);
        
        // Calculate basic stats for the response
        const stats = {
            person_count: omopData.PERSON.length,
            condition_count: omopData.CONDITION_OCCURRENCE.length,
            drug_count: omopData.DRUG_EXPOSURE.length,
            measurement_count: omopData.MEASUREMENT.length
        };

        console.log(`[Canonical] Success. Generated research dataset.`, stats);
        res.json({ meta: stats, cdm: omopData });

    } catch (error) {
        console.error("[Canonical] Transformation Failed:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`📊 Canonical Mapper listening on port ${PORT}`);
    console.log(`   - Ready to convert FHIR -> OMOP`);
});
