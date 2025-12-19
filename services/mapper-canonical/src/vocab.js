/**
 * OMOP VOCABULARY MAPPINGS (Lite)
 * Maps standard FHIR codes/values to OMOP Concept IDs.
 */

const VOCAB = {
    // GENDER
    gender: {
        'male': 8507,
        'female': 8532,
        'other': 8551,
        'unknown': 8570
    },
    // RACE (US Core mappings)
    race: {
        '2106-3': 8527, // White
        '2054-5': 8516, // Black
        '2028-9': 8515  // Asian
    },
    // TYPES (Provenance)
    types: {
        'ehr': 32020,        // EHR encounter record
        'lab': 44818707,     // Lab result
        'diagnosis': 44786627 // Clinical finding
    },
    // CONDITION MAPPINGS (SNOMED -> OMOP)
    // Note: In real OMOP, SNOMED codes often map 1:1 to Concept IDs
    conditions: {
        '22298006': 312327,  // Myocardial infarction
        '38341003': 316866,  // Hypertensive disorder
        '73211009': 201820,  // Diabetes mellitus
        '254837009': 4115276 // Malignant tumor of breast
    },
    // DRUG MAPPINGS (RxNorm -> OMOP)
    drugs: {
        '161': 1125315,  // Acetaminophen
        '1191': 1112807, // Aspirin
        '6809': 1503297, // Metformin
        '11289': 1310149 // Warfarin
    }
};

module.exports = VOCAB;
