const _ = require('lodash');
const VOCAB = require('./vocab');

/**
 * FHIR -> OMOP MAPPER (Architecture Compliant)
 * This mapper is "dumb". It does not know codes. 
 * It only knows how to read "Concept ID" tags injected by the Semantic Aligner.
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
        
        // --- CRITICAL ARCHITECTURE STEP ---
        // Look for the tag injected by the Semantic Aligner.
        // If Aligner is OFF, this will be undefined, and ID will defaults to 0.
        const omopTag = r.meta?.tag?.find(t => t.system === 'http://ohdsi.org/concept_id');
        const alignedId = omopTag ? parseInt(omopTag.code) : 0;
        
        const sourceCode = r.code?.text || r.code?.coding?.[0]?.code || "Unknown";

        // --- A. VITALS (MEASUREMENT) ---
        if (r.resourceType === 'Observation' && r.valueQuantity) {
            cdm.MEASUREMENT.push({
                measurement_id: index + 100,
                person_id: 1001,
                measurement_concept_id: alignedId, // <--- USES TAG OR 0
                measurement_date: r.effectiveDateTime ? r.effectiveDateTime.split('T')[0] : new Date().toISOString().split('T')[0],
                measurement_source_value: sourceCode,
                value_as_number: r.valueQuantity.value,
                unit_source_value: r.valueQuantity.unit
            });
        }

        // --- B. SDOH (OBSERVATION) ---
        else if (r.resourceType === 'Observation' && r.valueString) {
            cdm.OBSERVATION.push({
                observation_id: index + 200,
                person_id: 1001,
                observation_concept_id: alignedId, // <--- USES TAG OR 0
                observation_date: new Date().toISOString().split('T')[0],
                observation_source_value: r.code?.text || "Survey",
                value_as_string: r.valueString
            });
        }

        // --- C. GENOMICS (NOTE) ---
        else if (r.resourceType === 'MolecularSequence') {
            const variant = r.variant?.[0]?.observedAllele || "Unknown Variant";
            
            // For notes, we might map the "Type" if aligned, otherwise generic
            const noteType = alignedId > 0 ? alignedId : 44814645; // Default to 'Pathology Note' if unmapped

            cdm.NOTE.push({
                note_id: index + 300,
                person_id: 1001,
                note_date: new Date().toISOString().split('T')[0],
                note_type_concept_id: noteType, 
                note_title: "Genomic Variant",
                note_text: `Variant: ${variant}`
            });
        }

        // --- D. IMAGING (PROCEDURE) ---
        else if (r.resourceType === 'ImagingStudy') {
            const modality = r.modality?.[0]?.code || "UNK";
            const desc = r.description || "Imaging";
            
            cdm.PROCEDURE_OCCURRENCE.push({
                procedure_occurrence_id: index + 500,
                person_id: 1001,
                procedure_concept_id: alignedId, // <--- USES TAG (e.g., 4052536 for Microscopy)
                procedure_date: new Date().toISOString().split('T')[0],
                procedure_source_value: `${modality}: ${desc}`,
                modifier_source_value: `${r.numberOfInstances} Instances`
            });
        }

        // --- E. RESEARCH (OBSERVATION) ---
        else if (r.resourceType === 'ResearchSubject') {
             cdm.OBSERVATION.push({
                observation_id: index + 400,
                person_id: 1001,
                observation_concept_id: alignedId, 
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
