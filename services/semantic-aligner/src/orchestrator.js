const axios = require('axios');

const SERVICES = {
    LOINC_VALIDATE: "http://terminology-loinc:3011/validate", 
    RXNORM_LOOKUP: "http://terminology-rxnorm:3012/lookup", 
    SNOMED_CONCEPT: "http://terminology-snomed:3010/concept" 
};

const enrichResource = async (resource) => {
    let res = JSON.parse(JSON.stringify(resource));
    if (!res.meta) res.meta = {};
    if (!res.meta.tag) res.meta.tag = [];

    try {
        // HELPER: Reuse this for both Observations and Imaging
        const lookupLoinc = async (coding) => {
            if (!coding) return;
            const loincCode = coding.find(c => c.system && c.system.includes('loinc'));
            
            if (loincCode) {
                try {
                    // REAL NETWORK CALL
                    const lookup = await axios.post(SERVICES.LOINC_VALIDATE, { code: loincCode.code });
                    if (lookup.data && lookup.data.valid && lookup.data.concept) {
                        const c = lookup.data.concept;
                        // Inject OMOP ID
                        if (c.omop_id) {
                            res.meta.tag.push({
                                system: "http://ohdsi.org/concept_id",
                                code: c.omop_id,
                                display: c.display || "OMOP Concept"
                            });
                            if (c.display) loincCode.display = c.display; 
                        }
                    }
                } catch (e) { 
                    console.warn(`[Aligner] LOINC Lookup Failed for ${loincCode.code}: ${e.message}`); 
                }
            }
        };

        // --- A. OBSERVATIONS (Vitals & SDOH) ---
        if (res.resourceType === 'Observation' && res.code?.coding) {
            await lookupLoinc(res.code.coding);
        }

        // --- B. IMAGING & PATHOLOGY (The "New" Logic) ---
        if (res.resourceType === 'ImagingStudy') {
            // 1. Pathology: Check Series Modality for LOINC codes (e.g., 60568-3)
            if (res.series?.[0]?.modality?.coding) {
                await lookupLoinc(res.series[0].modality.coding);
            }
            
            // 2. Radiology: Handle DICOM codes (e.g., 'MR') manually
            const modalityCode = res.modality?.[0]?.code;
            if (modalityCode === 'MR' || modalityCode === 'MRI') {
                res.description = "Magnetic Resonance Imaging (Standardized)";
                res.meta.tag.push({ system: "http://ohdsi.org/concept_id", code: "4013636", display: "MRI Brain" });
            }
        }

        // --- C. CONDITIONS (SNOMED) - RESTORED! ---
        if (res.resourceType === 'Condition' && res.code?.coding) {
            const snomedCode = res.code.coding.find(c => c.system.includes('snomed'));
            if (snomedCode) {
                try {
                    const lookup = await axios.get(`${SERVICES.SNOMED_CONCEPT}/${snomedCode.code}`);
                    if (lookup.data && lookup.data.omop_id) {
                        res.meta.tag.push({
                            system: "http://ohdsi.org/concept_id",
                            code: lookup.data.omop_id,
                            display: lookup.data.display || "Condition"
                        });
                        if (lookup.data.display) res.code.text = lookup.data.display;
                    }
                } catch (e) {
                    console.warn(`[Aligner] SNOMED Lookup Failed for ${snomedCode.code}: ${e.message}`);
                }
            }
        }

        // --- D. MEDICATIONS (RxNorm) ---
        if (res.resourceType === 'MedicationRequest' && res.medicationCodeableConcept?.text) {
            const drugName = res.medicationCodeableConcept.text;
            try {
                const lookup = await axios.get(`${SERVICES.RXNORM_LOOKUP}?drug=${encodeURIComponent(drugName)}`);
                if (lookup.data.found && lookup.data.concept?.omop_id) {
                     res.meta.tag.push({
                        system: "http://ohdsi.org/concept_id",
                        code: lookup.data.concept.omop_id,
                        display: lookup.data.concept.display
                    });
                }
            } catch (e) { 
                console.warn(`[Aligner] RxNorm Lookup Failed for ${drugName}: ${e.message}`);
            }
        }

        // --- E. RESEARCH ---
        if (res.resourceType === 'ResearchSubject') {
            res.meta.tag.push({ system: "http://ohdsi.org/concept_id", code: "44814722", display: "Clinical Trial Participant" });
        }

        res.meta.tag.push({ system: "http://openhealthos.org/status", code: "aligned" });

    } catch (error) {
        console.log(`[Aligner] Error processing ${resource.resourceType}: ${error.message}`);
    }

    return res;
};

module.exports = { enrichResource };

