const express = require('express');
const cors = require('cors');
const { enrichResource } = require('./orchestrator');
const { deduplicate } = require('./merger');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3015;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'semantic-aligner', 
        role: 'orchestrator',
        connected_experts: ['SNOMED', 'LOINC', 'RxNorm'] 
    });
});

/**
 * POST /align
 * The Main Pipeline Endpoint.
 * Input: A raw FHIR Bundle (possibly containing duplicates and messy text).
 * Output: A pristine, normalized, de-duplicated Bundle.
 */
app.post('/align', async (req, res) => {
    const rawBundle = req.body;
    
    if (!rawBundle || !rawBundle.entry) {
        return res.status(400).json({ error: "Invalid FHIR Bundle" });
    }

    console.log(`[Aligner] Processing Bundle with ${rawBundle.entry.length} resources...`);
    const startTime = Date.now();

    try {
        // STEP 1: EXTRACT RESOURCES
        let resources = rawBundle.entry.map(e => e.resource);

        // STEP 2: ENRICHMENT (Parallel Processing)
        // We ask all experts at once to speed up
        const enrichedResources = await Promise.all(
            resources.map(r => enrichResource(r))
        );

        // STEP 3: DEDUPLICATION
        // Now that codes are normalized (e.g., both are LOINC 8867-4), we can merge
        const finalResources = deduplicate(enrichedResources);

        // STEP 4: REBUNDLE
        const outputBundle = {
            resourceType: "Bundle",
            id: uuidv4(),
            type: "collection", // Processed collection
            timestamp: new Date().toISOString(),
            meta: {
                tag: [{ system: "http://openhealthos.org/status", code: "aligned", display: "Semantically Aligned" }]
            },
            entry: finalResources.map(r => ({ resource: r }))
        };

        const duration = Date.now() - startTime;
        console.log(`[Aligner] Complete. Reduced ${resources.length} -> ${finalResources.length} items in ${duration}ms.`);
        
        res.json(outputBundle);

    } catch (error) {
        console.error("[Aligner] Pipeline Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🧠 Semantic Aligner listening on port ${PORT}`);
    console.log(`   - Orchestrating Context Refinery Pipeline`);
});
