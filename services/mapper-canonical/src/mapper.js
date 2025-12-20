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
        MEASUREMENT: [],   
        OBSERVATION: [],   
        NOTE: [],           
        PROCEDURE_OCCURRENCE: []
    };

    if (!bundle || !bundle.entry) return cdm;

    // 1. Create a default Patient (Person)
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
        
        // --- A. VITALS (MEASUREMENT) ---
        if (r.resourceType === 'Observation' && r.valueQuantity) {
            let conceptId = 0; 
            let sourceCode = r.code?.text || "Unknown";

            if (r.code?.coding && r.code.coding.length > 0) {
                const coding = r.code.coding[0]; 
                sourceCode = coding.code;
                if (coding.code === '8867-4') conceptId = 3027018; 
                if (coding.code === '9279-1') conceptId = 3024171; 
                if (coding.code === '8310-5') conceptId = 3012888; 
            }

            cdm.MEASUREMENT.push({
                measurement_id: index + 100,
                person_id: 1001,
                measurement_concept_id: conceptId,
                measurement_date: r.effectiveDateTime ? r.effectiveDateTime.split('T')[0] : new Date().toISOString().split('T')[0],
                measurement_source_value: sourceCode,
                value_as_number: r.valueQuantity.value,
                unit_source_value: r.valueQuantity.unit
            });
        }

        // --- B. SDOH (OBSERVATION) ---
        else if (r.resourceType === 'Observation' && r.valueString) {
            let conceptId = 0;
            if (r.code?.coding && r.code.coding.length > 0) {
                 if (r.code.coding[0].code === '71802-3') conceptId = 4330447; 
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

        // --- C. GENOMICS (NOTE) ---
        else if (r.resourceType === 'MolecularSequence') {
            const variant = r.variant?.[0]?.observedAllele || "Unknown Variant";
            const snomedTag = r.meta?.tag?.find(t => t.system.includes('snomed'));
            const title = snomedTag ? `Genomics (${snomedTag.display})` : "Genomics (Raw)";

            cdm.NOTE.push({
                note_id: index + 300,
                person_id: 1001,
                note_date: new Date().toISOString().split('T')[0],
                note_type_concept_id: 44814645, 
                note_title: title,
                note_text: `Variant: ${variant} | Status: ${snomedTag ? 'Pathogenic' : 'Unknown'}`
            });
        }

        // --- D. IMAGING (PROCEDURE) ---
        else if (r.resourceType === 'ImagingStudy') {
            const modality = r.modality?.[0]?.code || "UNK";
            const desc = r.description || "Imaging";
            
            cdm.PROCEDURE_OCCURRENCE.push({
                procedure_occurrence_id: index + 500,
                person_id: 1001,
                procedure_concept_id: 0, 
                procedure_date: new Date().toISOString().split('T')[0],
                procedure_source_value: `${modality}: ${desc}`,
                modifier_source_value: `${r.numberOfInstances} Instances`
            });
        }

        // --- E. RESEARCH (OBSERVATION) - NEW! ---
        else if (r.resourceType === 'ResearchSubject') {
             cdm.OBSERVATION.push({
                observation_id: index + 400,
                person_id: 1001,
                observation_concept_id: 0, 
                observation_date: new Date().toISOString().split('T')[0],
                observation_source_value: "Clinical Trial",
                value_as_string: `Study: ${r.study?.display} | Arm: ${r.actualArm}`
            });
        }
    });

    return cdm;
};

module.exports = { toOMOP };

ports = { toOMOP };
