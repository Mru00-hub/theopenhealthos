const { v4: uuidv4 } = require('uuid');

/**
 * SDOH EXPERT TRANSFORMER
 * Converts raw survey JSON into FHIR R4.
 * * Logic:
 * 1. Creates a QuestionnaireResponse (The raw proof of what the patient said).
 * 2. Creates Observations (The clinical data points for the Kernel).
 * 3. Maps common survey answers to standardized LOINC/SNOMED codes.
 */

const transform = (surveyData, patientRef) => {
    if (!patientRef) throw new Error("Patient reference is required");

    const resources = [];
    const qrId = uuidv4();
    const timestamp = new Date().toISOString();

    // ------------------------------------------
    // 1. QUESTIONNAIRE RESPONSE (Raw Data)
    // ------------------------------------------
    const questionnaireResponse = {
        resourceType: "QuestionnaireResponse",
        id: qrId,
        status: "completed",
        subject: { reference: patientRef },
        authored: timestamp,
        item: Object.entries(surveyData).map(([key, value]) => ({
            linkId: key,
            text: formatLabel(key),
            answer: [{ valueString: value }]
        }))
    };
    
    resources.push({ 
        resource: questionnaireResponse, 
        request: { method: "POST", url: "QuestionnaireResponse" } 
    });

    // ------------------------------------------
    // 2. OBSERVATIONS (Inferred Clinical Data)
    // ------------------------------------------
    
    // Logic: Check specific keys and generate clinical observations
    
    // A. Housing Status
    if (surveyData.housing_status) {
        const isUnstable = ['homeless', 'unstable', 'shelter'].includes(surveyData.housing_status.toLowerCase());
        
        resources.push({
            resource: {
                resourceType: "Observation",
                status: "final",
                category: [{ 
                    coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "social-history" }] 
                }],
                code: { 
                    coding: [{ system: "http://loinc.org", code: "71802-3", display: "Housing status" }] 
                },
                valueCodeableConcept: { 
                    coding: isUnstable 
                        ? [{ system: "http://snomed.info/sct", code: "425068000", display: "Homelessness (finding)" }]
                        : [{ system: "http://snomed.info/sct", code: "224227000", display: "Housed" }]
                },
                subject: { reference: patientRef },
                derivedFrom: [{ reference: `QuestionnaireResponse/${qrId}` }],
                effectiveDateTime: timestamp
            },
            request: { method: "POST", url: "Observation" }
        });
    }

    // B. Food Insecurity
    if (surveyData.food_security) {
        const isInsecure = ['insecure', 'hungry', 'scarce'].includes(surveyData.food_security.toLowerCase());
        
        resources.push({
            resource: {
                resourceType: "Observation",
                status: "final",
                category: [{ 
                    coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "social-history" }] 
                }],
                code: { 
                    coding: [{ system: "http://loinc.org", code: "88124-3", display: "Food insecurity risk [HVS]" }] 
                },
                valueCodeableConcept: { 
                    coding: isInsecure
                        ? [{ system: "http://loinc.org", code: "LA19952-3", display: "At risk" }]
                        : [{ system: "http://loinc.org", code: "LA19951-5", display: "No risk" }]
                },
                subject: { reference: patientRef },
                derivedFrom: [{ reference: `QuestionnaireResponse/${qrId}` }],
                effectiveDateTime: timestamp
            },
            request: { method: "POST", url: "Observation" }
        });
    }

    // C. Transport Issues
    if (surveyData.transportation) {
        const hasIssues = ['no car', 'none', 'difficult'].includes(surveyData.transportation.toLowerCase());
        
        resources.push({
            resource: {
                resourceType: "Observation",
                status: "final",
                category: [{ 
                    coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "social-history" }] 
                }],
                code: { 
                    coding: [{ system: "http://loinc.org", code: "93033-9", display: "Transport insecurity" }] 
                },
                valueBoolean: hasIssues,
                subject: { reference: patientRef },
                derivedFrom: [{ reference: `QuestionnaireResponse/${qrId}` }],
                effectiveDateTime: timestamp
            },
            request: { method: "POST", url: "Observation" }
        });
    }

    // ------------------------------------------
    // 3. CREATE TRANSACTION BUNDLE
    // ------------------------------------------
    return {
        resourceType: "Bundle",
        id: uuidv4(),
        type: "transaction",
        timestamp: timestamp,
        entry: resources
    };
};

// Helper: Formats "housing_status" to "Housing Status"
const formatLabel = (str) => {
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

module.exports = { transform };
