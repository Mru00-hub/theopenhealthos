const axios = require('axios');

// MICROSERVICE URLS (Internal Docker Network)
// We use the Docker Service names, not localhost/host.docker.internal
const SERVICES = {
    LOINC: "http://terminology-loinc:3030/lookup",
    SNOMED: "http://terminology-snomed:3031/lookup",
    RXNORM: "http://terminology-rxnorm:3032/lookup" 
};

/**
 * ENRICH RESOURCE
 * 1. Calls Terminology Services to normalize names.
 * 2. Injects OMOP Concept IDs into 'meta.tag' for the Canonical Mapper.
 */
const enrichResource = async (resource) => {
    // 1. Clone to avoid mutation side-effects
    let res = JSON.parse(JSON.stringify(resource));
    
    // 2. Ensure meta.tag exists (The Integration Layer)
    if (!res.meta) res.meta = {};
    if (!res.meta.tag) res.meta.tag = [];

    try {
        // --- STRATEGY A: OBSERVATIONS (LOINC) ---
        if (res.resourceType === 'Observation' && res.code?.coding) {
            const loincCode = res.code.coding.find(c => c.system.includes('loinc') || c.system.includes('legacy'));
            
            if (loincCode) {
                // Call Layer 3 Service
                // We use a short timeout so we don't block the pipeline if terminology is slow
                const lookup = await axios.get(`${SERVICES.LOINC}?code=${loincCode.code}`, { timeout: 2000 });
                
                if (lookup.data) {
                    // A. Normalize Display Name (e.g. "Heart Rate" -> "Heart rate")
                    if (lookup.data.display) res.code.text = lookup.data.display;

                    // B. Inject OMOP Tag (The Critical Architecture Handshake)
                    // The Canonical Mapper reads THIS tag, not the raw LOINC code.
                    res.meta.tag.push({
                        system: "http://ohdsi.org/concept_id",
                        code: "3027018", // Demo: Hardcoded OMOP ID for Heart Rate
                        display: "OMOP Concept ID"
                    });
                }
            }
        }

        // --- STRATEGY B: IMAGING & PATHOLOGY (Specialty Mapping) ---
        if (res.resourceType === 'ImagingStudy') {
            const modality = res.modality?.[0]?.code;
            
            if (modality === 'SM') { // Slide Microscopy
                // Standardize Description
                res.description = "Whole Slide Imaging (Standardized)";
                
                // Inject OMOP Tag
                res.meta.tag.push({
                    system: "http://ohdsi.org/concept_id",
                    code: "4052536", // OMOP ID for 'Microscopy'
                    display: "OMOP Concept ID"
                });
            }
        }

        // --- STRATEGY C: CONDITIONS (SNOMED) ---
        // Keeps your old logic but updates it to use the correct OMOP handshake
        if (res.resourceType === 'Condition' && res.code?.coding) {
             // For demo simplicity, we just tag it as aligned if it has a code
             res.meta.tag.push({
                system: "http://ohdsi.org/concept_id",
                code: "439777", // Demo: OMOP ID for Anemia/Generic Condition
                display: "OMOP Concept ID"
            });
        }

        // Mark as Processed by Aligner
        res.meta.tag.push({ system: "http://openhealthos.org/status", code: "aligned" });

    } catch (error) {
        // Graceful Degradation: If Terminology Service is down, 
        // we log it but return the original resource so the pipeline doesn't crash.
        console.log(`[Aligner] ⚠️ Enrichment Warning for ${res.resourceType}: ${error.message}`);
    }

    return res;
};

module.exports = { enrichResource };
