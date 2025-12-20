const axios = require('axios');

// CONFIGURATION: Exact ports from your index.js files
const SERVICES = {
    // Port 3011 (LOINC) - Validates codes
    LOINC_VALIDATE: "http://terminology-loinc:3011/validate", 
    
    // Port 3012 (RxNorm) - Lookups drug names
    RXNORM_LOOKUP: "http://terminology-rxnorm:3012/lookup", 
    
    // Port 3010 (SNOMED) - Gets rich concept details (including OMOP ID)
    SNOMED_CONCEPT: "http://terminology-snomed:3010/concept" 
};

/**
 * ENRICH RESOURCE
 * Dynamically calls Terminology Services (Layer 3) to get OMOP IDs.
 */
const enrichResource = async (resource) => {
    let res = JSON.parse(JSON.stringify(resource));
    if (!res.meta) res.meta = {};
    if (!res.meta.tag) res.meta.tag = [];

    try {
        // --- A. OBSERVATIONS (LOINC) ---
        if (res.resourceType === 'Observation' && res.code?.coding) {
            const loincCode = res.code.coding.find(c => c.system.includes('loinc'));
            
            if (loincCode) {
                // Call LOINC Service: POST /validate
                const lookup = await axios.post(SERVICES.LOINC_VALIDATE, { code: loincCode.code });
                
                if (lookup.data && lookup.data.valid && lookup.data.concept) {
                    const c = lookup.data.concept;
                    if (c.display) res.code.text = c.display; // Standardize Name
                    
                    // Inject OMOP ID
                    if (c.omop_id) {
                        res.meta.tag.push({
                            system: "http://ohdsi.org/concept_id",
                            code: c.omop_id,
                            display: "OMOP Concept ID"
                        });
                    }
                }
            }
        }

        // --- B. MEDICATIONS (RxNorm) ---
        if (res.resourceType === 'MedicationRequest' && res.medicationCodeableConcept?.text) {
            const drugName = res.medicationCodeableConcept.text;
            
            // Call RxNorm Service: GET /lookup?drug=...
            const lookup = await axios.get(`${SERVICES.RXNORM_LOOKUP}?drug=${encodeURIComponent(drugName)}`);
            
            if (lookup.data.found && lookup.data.concept) {
                const c = lookup.data.concept;
                res.medicationCodeableConcept.text = c.display; // Standardize Name
                
                // Inject OMOP ID
                if (c.omop_id) {
                    res.meta.tag.push({
                        system: "http://ohdsi.org/concept_id",
                        code: c.omop_id,
                        display: "OMOP Concept ID"
                    });
                }
            }
        }

        // --- C. CONDITIONS (SNOMED) ---
        // Your SNOMED service has a specific '/concept/:code' endpoint for rich data
        if (res.resourceType === 'Condition' && res.code?.coding) {
            const snomedCode = res.code.coding.find(c => c.system.includes('snomed'));
            
            if (snomedCode) {
                // Call SNOMED Service: GET /concept/:code
                // Note: We use the base URL defined above + the code
                const lookup = await axios.get(`${SERVICES.SNOMED_CONCEPT}/${snomedCode.code}`);
                
                if (lookup.data) {
                    const c = lookup.data;
                    if (c.display) res.code.text = c.display;
                    
                    // Inject OMOP ID
                    if (c.omop_id) {
                        res.meta.tag.push({
                            system: "http://ohdsi.org/concept_id",
                            code: c.omop_id,
                            display: "OMOP Concept ID"
                        });
                    }
                }
            }
        }

        // --- D. IMAGING (Local Logic) ---
        if (res.resourceType === 'ImagingStudy') {
            const modality = res.modality?.[0]?.code;
            if (modality === 'SM') {
                res.description = "Whole Slide Imaging (Standardized)";
                res.meta.tag.push({
                    system: "http://ohdsi.org/concept_id",
                    code: "4052536", 
                    display: "OMOP Concept ID"
                });
            }
        }

        res.meta.tag.push({ system: "http://openhealthos.org/status", code: "aligned" });

    } catch (error) {
        console.log(`[Aligner] ⚠️ Enrichment Warning: ${error.message}`);
    }

    return res;
};

module.exports = { enrichResource };
