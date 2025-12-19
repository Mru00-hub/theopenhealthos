/**
 * ETHICS ENGINE
 * Validates the "Purpose of Use" (POU) against regulatory rules.
 */

const ALLOWED_PURPOSES = {
    'TREATMENT': ['PRACTITIONER', 'NURSE', 'CDSS'],
    'RESEARCH': ['RESEARCHER', 'DATA_SCIENTIST'],
    'BILLING': ['ADMIN', 'BILLING_CLERK'],
    'EMERGENCY': ['PRACTITIONER', 'NURSE', 'EMT'], // Break Glass
    'PATIENT_ACCESS': ['PATIENT']
};

const BANNED_PURPOSES = ['MARKETING', 'PROFILING'];

const validatePurpose = (actorRole, purposeOfUse) => {
    // 1. Check for Banned Purposes (Immediate Fail)
    if (BANNED_PURPOSES.includes(purposeOfUse)) {
        return { 
            valid: false, 
            risk_level: "CRITICAL", 
            message: `Purpose '${purposeOfUse}' is strictly prohibited by Platform Ethics Policy.` 
        };
    }

    // 2. Check Role-Purpose Matrix
    const allowedRoles = ALLOWED_PURPOSES[purposeOfUse];
    
    if (!allowedRoles) {
        return { 
            valid: false, 
            risk_level: "HIGH", 
            message: `Unknown Purpose of Use: ${purposeOfUse}` 
        };
    }

    if (!allowedRoles.includes(actorRole)) {
        return {
            valid: false,
            risk_level: "MEDIUM",
            message: `Role '${actorRole}' is not authorized for '${purposeOfUse}'.`
        };
    }

    // 3. Handle "Break Glass" (Emergency)
    // Valid, but triggers a High-Level Audit Alert
    if (purposeOfUse === 'EMERGENCY') {
        return {
            valid: true,
            risk_level: "ALERT",
            message: "Emergency Access Granted. Incident will be flagged for manual review."
        };
    }

    return { valid: true, risk_level: "LOW", message: "Purpose verified." };
};

module.exports = { validatePurpose };
