const _ = require('lodash');
const VOCAB = require('./vocab');

/**
 * FHIR -> OMOP MAPPER
 * The "Rosetta Stone" that converts modern HL7 FHIR into Research-Grade OMOP CDM.
 */

const toOMOP = (bundle) => {
    // Initialize empty OMOP Tables
    const cdm = {
        PERSON: [],
        OBSERVATION_PERIOD: [],
        VISIT_OCCURRENCE: [],
        CONDITION_OCCURRENCE: [],
        DRUG_EXPOSURE: [],
        MEASUREMENT: [],   // Vitals, Labs
        OBSERVATION: [],   // Surveys, Social History
        NOTE: []           // Unstructured text (Genomics)
    };

    if (!bundle || !bundle.entry) return cdm;

    // 1. Create a default Patient (Person)
    // In a real app, we'd extract this from Patient resources.
    cdm.PERSON.push({
        person_id: 1001,
        gender_concept_id: 8507, // Male
        year_of_birth: 1980,
        race_concept_id: 8527,
        ethnicity_concept_id: 38003564
    });

    // 2. Process Clinical Resources
    bundle.entry.forEach((entry, index) => {
        const r = entry.resource;
        
        // --- A. VITALS & LABS (MEASUREMENT) ---
        if (r.resourceType === 'Observation' && r.valueQuantity) {
            
            // CRITICAL FIX: Look for the LOINC code injected by Aligner
            let conceptId = 0; // Default "Unmapped"
            let sourceCode = r.code?.text || "Unknown";

            // Check if Aligner added a standard coding
            if (r.code?.coding && r.code.coding.length > 0) {
                const coding = r.code.coding[0]; // Take the first one (e.g., 8867-4)
                sourceCode = coding.code;

                // Simple Lookup Table for Demo
                if (coding.code === '8867-4') conceptId = 3027018; // Heart Rate
                if (coding.code === '9279-1') conceptId = 3024171; // Respiratory Rate
                if (coding.code === '8310-5') conceptId = 3012888; // Body Temp
            }

            cdm.MEASUREMENT.push({
                measurement_id: index + 100,
                person_id: 1001,
                measurement_concept_id: conceptId, // <--- This will now be 3027018
                measurement_date: r.effectiveDateTime ? r.effectiveDateTime.split('T')[0] : new Date().toISOString().split('T')[0],
                measurement_source_value: sourceCode,
                value_as_number: r.valueQuantity.value,
                unit_source_value: r.valueQuantity.unit
            });
        }

        // --- B. SOCIAL HISTORY (OBSERVATION) ---
        else if (r.resourceType === 'Observation' && r.valueString) {
            
            let conceptId = 0;
            // Check for LOINC codes for Housing/SDOH
            if (r.code?.coding && r.code.coding.length > 0) {
                 if (r.code.coding[0].code === '71802-3') conceptId = 4330447; // Housing status
            }

            cdm.OBSERVATION.push({
                observation_id: index + 200,
                person_id: 1001,
                observation_concept_id: conceptId,
                observation_date: new Date().toISOString().split('T')[0],
                observation_source_value: r.code?.text || "Survey",
                value_as_string: r.valueString
            });
        }

        // --- C. GENOMICS (NOTE / MEASUREMENT) ---
        else if (r.resourceType === 'MolecularSequence') {
            const variant = r.variant?.[0]?.observedAllele || "Unknown Variant";
            
            // Check if Aligner tagged it with SNOMED
            const snomedTag = r.meta?.tag?.find(t => t.system.includes('snomed'));
            const title = snomedTag ? `Genomics (${snomedTag.display})` : "Genomics (Raw)";

            cdm.NOTE.push({
                note_id: index + 300,
                person_id: 1001,
                note_date: new Date().toISOString().split('T')[0],
                note_type_concept_id: 44814645, // "Note"
                note_title: title,
                note_text: `Variant: ${variant} | Status: ${snomedTag ? 'Pathogenic' : 'Unknown'}`
            });
        }
    });

    return cdm;
};

module.exports = { toOMOP };
