const axios = require('axios');

// In sim, we mock the FHIR Server response for specific patient IDs
// In prod, this calls 'http://fhir-server:8080/fhir/Patient/...'

const mockDb = {
    "1001": {
        patient: { id: "1001", name: "John Doe", birthDate: "1980-01-01", gender: "male", mrn: "MRN-999" },
        conditions: [
            { code: '73211009', display: "Diabetes mellitus (SNOMED)" }
        ],
        meds: [
            { code: '6809', display: "Metformin (RxNorm)" }
        ],
        vitals: [
            { code: '8480-6', value: 145, unit: 'mmHg' } // High BP
        ],
        genomics: {
            variants: ["BRCA1 Positive (High Risk)"]
        },
        sdoh: {
            factors: ["Housing Instability"]
        },
        ml_predictions: {
            sepsis_risk: 0.1,
            readmission_risk: 0.4
        }
    }
};

const fetchData = async (patientId) => {
    // 1. TRY MOCK DB FIRST (For specific Simulation Scenarios)
    if (mockDb[patientId]) {
        return mockDb[patientId];
    }

    // 2. FALLBACK: Return empty structure
    return {
        patient: { id: patientId, name: "Unknown", birthDate: "2000-01-01" },
        conditions: [],
        meds: [],
        vitals: [],
        genomics: null,
        sdoh: null,
        ml_predictions: {}
    };
};

module.exports = { fetchData };
