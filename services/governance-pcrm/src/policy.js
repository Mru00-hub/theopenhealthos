const { CONSENT_STORE } = require('./database');

/**
 * EVALUATE CONSENT
 * Checks if a specific 'actor' can access a specific 'resourceType' for a 'patient'.
 */
const evaluateRequest = (request) => {
    const { patientId, resourceType, categoryCode, actorRole } = request;

    // 1. Find Policy for Patient
    const policy = CONSENT_STORE.find(c => c.patient.reference === patientId || c.patient.reference === `Patient/${patientId}`);
    
    // Default: If no policy exists, we assume "Opt-In" (Allow) for standard care, but "Deny" for sensitive data
    if (!policy) {
        return { decision: "PERMIT", reason: "No specific restrictions found." };
    }

    // 2. Check "Deny" Provisions (Exceptions)
    const provisions = policy.provision?.provision || [];
    
    for (const rule of provisions) {
        // Does this rule apply to the requested Resource Type?
        const matchResource = rule.class?.some(c => c.code === resourceType || c.code === categoryCode);
        
        // Does this rule apply to the requesting Actor?
        const matchActor = rule.actor?.some(a => a.role.coding.some(c => c.code === actorRole));

        if (matchResource && matchActor && rule.type === 'deny') {
            return { 
                decision: "DENY", 
                reason: `Patient explicitly blocked ${actorRole} from accessing ${resourceType || categoryCode}` 
            };
        }
    }

    return { decision: "PERMIT", reason: "Access allowed by active policy." };
};

/**
 * UPDATE CONSENT
 * Simulates a patient toggling a privacy switch in their portal.
 */
const updatePolicy = (patientId, toggle) => {
    // toggle example: { category: "genomics", share: false }
    const policy = CONSENT_STORE.find(c => c.patient.reference === `Patient/${patientId}`);
    
    if (policy && toggle.category === 'genomics' && toggle.share === false) {
        // Add a Deny rule
        policy.provision.provision.push({
            type: "deny",
            class: [{ system: "http://hl7.org/fhir/resource-types", code: "MolecularSequence" }],
            actor: [{ role: { coding: [{ code: "RESEARCHER" }] } }]
        });
        return { status: "updated", message: "Genomics sharing disabled." };
    }
    
    // In a full system, this would be dynamic logic
    return { status: "success", message: "Policy updated." };
};

module.exports = { evaluateRequest, updatePolicy };
