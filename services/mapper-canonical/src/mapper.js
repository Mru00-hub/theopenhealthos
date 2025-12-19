const _ = require('lodash');
const VOCAB = require('./vocab');

/**
 * MAPPING ENGINE
 * Transforms FHIR Bundle -> OMOP CDM Tables (JSON representation)
 */
const toOMOP = (fhirBundle) => {
    const cdm = {
        PERSON: [],
        VISIT_OCCURRENCE: [],
        CONDITION_OCCURRENCE: [],
        DRUG_EXPOSURE: [],
        MEASUREMENT: []
    };

    const resources = fhirBundle.entry?.map(e => e.resource) || [];
    
    // We need a map of Patient FHIR ID -> OMOP Person ID (Integer)
    // For sim, we hash the string ID to an integer
    const getPersonId = (ref) => {
        if (!ref) return null;
        const idStr = ref.replace('Patient/', '');
        // Simple hash to integer
        let hash = 0;
        for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash) + idStr.charCodeAt(i);
        return Math.abs(hash); // Ensure positive ID
    };

    resources.forEach(r => {
        const id = getPersonId(`Patient/${r.id}`);

        // --- TABLE: PERSON ---
        if (r.resourceType === 'Patient') {
            cdm.PERSON.push({
                person_id: id,
                gender_concept_id: VOCAB.gender[r.gender] || 8570,
                year_of_birth: r.birthDate ? parseInt(r.birthDate.split('-')[0]) : null,
                month_of_birth: r.birthDate ? parseInt(r.birthDate.split('-')[1]) : null,
                day_of_birth: r.birthDate ? parseInt(r.birthDate.split('-')[2]) : null,
                race_concept_id: 0, // Placeholder
                ethnicity_concept_id: 0,
                person_source_value: r.id
            });
        }

        // --- TABLE: CONDITION_OCCURRENCE ---
        if (r.resourceType === 'Condition') {
            const snomedCode = r.code?.coding?.find(c => c.system === 'http://snomed.info/sct')?.code;
            const conceptId = VOCAB.conditions[snomedCode] || 0; // 0 = Unknown

            cdm.CONDITION_OCCURRENCE.push({
                condition_occurrence_id: _.uniqueId(),
                person_id: getPersonId(r.subject?.reference),
                condition_concept_id: conceptId,
                condition_start_date: r.onsetDateTime?.split('T')[0] || r.recordedDate?.split('T')[0],
                condition_type_concept_id: VOCAB.types.diagnosis, 
                condition_source_value: r.code?.text || snomedCode
            });
        }

        // --- TABLE: DRUG_EXPOSURE ---
        if (r.resourceType === 'MedicationRequest') {
            const rxNormCode = r.medicationCodeableConcept?.coding?.find(c => c.system.includes('rxnorm'))?.code;
            const conceptId = VOCAB.drugs[rxNormCode] || 0;

            cdm.DRUG_EXPOSURE.push({
                drug_exposure_id: _.uniqueId(),
                person_id: getPersonId(r.subject?.reference),
                drug_concept_id: conceptId,
                drug_exposure_start_date: r.authoredOn?.split('T')[0],
                drug_type_concept_id: VOCAB.types.ehr,
                drug_source_value: r.medicationCodeableConcept?.text || rxNormCode
            });
        }

        // --- TABLE: MEASUREMENT (Labs/Vitals) ---
        if (r.resourceType === 'Observation') {
            // Check for numeric values
            if (r.valueQuantity) {
                const loincCode = r.code?.coding?.find(c => c.system === 'http://loinc.org')?.code;
                
                cdm.MEASUREMENT.push({
                    measurement_id: _.uniqueId(),
                    person_id: getPersonId(r.subject?.reference),
                    measurement_concept_id: 0, // In full system, map LOINC -> OMOP Concept
                    measurement_date: r.effectiveDateTime?.split('T')[0],
                    value_as_number: r.valueQuantity.value,
                    unit_source_value: r.valueQuantity.unit,
                    measurement_source_value: loincCode || r.code?.text
                });
            }
        }
    });

    return cdm;
};

module.exports = { toOMOP };
