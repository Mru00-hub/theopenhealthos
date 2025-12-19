/**
 * MOCK CONSENT DATABASE
 * Stores FHIR Consent resources that define what is allowed.
 */

const CONSENT_STORE = [
    {
        resourceType: "Consent",
        id: "policy-001",
        status: "active",
        scope: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentscope", code: "patient-privacy" }] },
        category: [{ coding: [{ system: "http://loinc.org", code: "59284-0", display: "Consent Document" }] }],
        patient: { reference: "Patient/1001" },
        dateTime: "2024-01-01",
        // The Rules
        provision: {
            type: "deny", // Default Strategy: Deny unless explicitly allowed? Or Permit with exceptions? 
                          // Here: We simulate "Permit All EXCEPT..." logic commonly used in simulations
            period: { start: "2024-01-01" },
            provision: [
                // RULE 1: BLOCK GENOMICS for RESEARCHERS
                {
                    type: "deny",
                    class: [{ system: "http://hl7.org/fhir/resource-types", code: "MolecularSequence" }],
                    actor: [{ role: { coding: [{ code: "RESEARCHER" }] } }]
                },
                // RULE 2: BLOCK MENTAL HEALTH ("Psychotherapy notes") for EVERYONE except PSYCHIATRISTS
                {
                    type: "deny",
                    class: [{ system: "http://snomed.info/sct", code: "442001002" }], // Psych findings
                    actor: [{ role: { coding: [{ code: "GENERAL_PRACTITIONER" }] } }]
                }
            ]
        }
    }
];

module.exports = { CONSENT_STORE };
