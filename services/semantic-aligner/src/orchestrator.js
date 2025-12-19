const axios = require('axios');

// Configuration for Expert Microservices
const SERVICES = {
    SNOMED: process.env.URL_SNOMED || 'http://host.docker.internal:3010', // For Conditions
    LOINC:  process.env.URL_LOINC  || 'http://host.docker.internal:3011', // For Observations
    RXNORM: process.env.URL_RXNORM || 'http://host.docker.internal:3012'  // For Medications
};

/**
 * ENRICHMENT ENGINE
 * Iterates through a bundle and standardizes each resource.
 */
const enrichResource = async (resource) => {
    let enriched = { ...resource }; // Clone

    try {
        // STRATEGY A: Observation -> LOINC
        if (resource.resourceType === 'Observation' && resource.code?.text) {
            // Check if it already has a system code (don't overwrite valid data)
            const hasSystem = resource.code.coding?.some(c => c.system === 'http://loinc.org');
            
            if (!hasSystem) {
                const res = await axios.get(`${SERVICES.LOINC}/resolve`, { 
                    params: { term: resource.code.text } 
                });
                if (res.data.found) {
                    const c = res.data.concept;
                    if (!enriched.code.coding) enriched.code.coding = [];
                    enriched.code.coding.push({
                        system: c.system,
                        code: c.code,
                        display: c.display
                    });
                    enriched.meta = addTag(enriched.meta, "semantic-enrichment", "LOINC Mapped");
                }
            }
        }

        // STRATEGY B: Condition -> SNOMED
        if (resource.resourceType === 'Condition' && resource.code?.text) {
             const hasSystem = resource.code.coding?.some(c => c.system === 'http://snomed.info/sct');
             
             if (!hasSystem) {
                const res = await axios.get(`${SERVICES.SNOMED}/lookup`, { 
                    params: { term: resource.code.text } 
                });
                if (res.data.matches?.length > 0) {
                    const best = res.data.matches[0];
                    if (!enriched.code.coding) enriched.code.coding = [];
                    enriched.code.coding.push({
                        system: best.system,
                        code: best.code,
                        display: best.display
                    });
                    enriched.meta = addTag(enriched.meta, "semantic-enrichment", "SNOMED Mapped");
                }
             }
        }

        // STRATEGY C: MedicationRequest -> RxNorm
        if (resource.resourceType === 'MedicationRequest' && resource.medicationCodeableConcept?.text) {
            const term = resource.medicationCodeableConcept.text;
            const res = await axios.get(`${SERVICES.RXNORM}/lookup`, { 
                params: { drug: term } 
            });
            
            if (res.data.found) {
                const c = res.data.concept;
                if (!enriched.medicationCodeableConcept.coding) enriched.medicationCodeableConcept.coding = [];
                enriched.medicationCodeableConcept.coding.push({
                    system: c.system,
                    code: c.code,
                    display: c.display
                });
                // Add the Drug Class as a separate category/tag
                enriched.meta = addTag(enriched.meta, "drug-class", c.drug_class.display);
            }
        }

    } catch (error) {
        console.warn(`[Aligner] Failed to enrich ${resource.resourceType}/${resource.id}: ${error.message}`);
        // We do NOT fail the pipeline; we just return the raw resource (Graceful degradation)
    }

    return enriched;
};

// Helper: Add Meta Tags without destroying existing ones
const addTag = (meta, code, display) => {
    const newMeta = meta || {};
    const tags = newMeta.tag || [];
    tags.push({ system: "http://openhealthos.org/semantic", code, display });
    newMeta.tag = tags;
    return newMeta;
};

module.exports = { enrichResource };
