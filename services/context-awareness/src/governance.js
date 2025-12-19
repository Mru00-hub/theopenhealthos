const axios = require('axios');

const PCRM_URL = process.env.PCRM_URL || 'http://governance-pcrm:3020';
const RCF_URL = process.env.RCF_URL || 'http://governance-rcf:3021';

/**
 * APPLY GOVERNANCE
 * 1. Logs access to RCF (Audit).
 * 2. Checks permissions via PCRM.
 * 3. Redacts sensitive fields.
 */
const applyGovernance = async (context, requestInfo) => {
    const { actor, role, purpose } = requestInfo;
    const patientId = context.patient.id;

    // 1. AUDIT LOGGING (Async - don't block)
    axios.post(`${RCF_URL}/log`, {
        actor: actor,
        action: "READ_CONTEXT",
        resource: `Patient/${patientId}`,
        outcome: "0",
        desc: `Context generation requested for ${purpose}`
    }).catch(err => console.error("Audit Log Failed:", err.message));

    // 2. CHECK GENOMICS ACCESS
    if (context.genomics && context.genomics.risk_markers.length > 0) {
        try {
            const pcrmRes = await axios.post(`${PCRM_URL}/check-access`, {
                patientId: patientId,
                resourceType: "MolecularSequence",
                actorRole: role
            });
            
            if (pcrmRes.data.decision === 'DENY') {
                // REDACTION
                context.genomics = {
                    status: "REDACTED",
                    reason: pcrmRes.data.reason,
                    risk_markers: [] // Wipe data
                };
            }
        } catch (e) {
            console.warn("PCRM Check Failed, defaulting to Safe Mode (Redact)");
            context.genomics = { status: "ERROR", message: "Governance Service Unavailable" };
        }
    }

    // 3. CHECK SDOH ACCESS (Sensitive Social Data)
    if (context.sdoh && role === 'BILLING_CLERK') {
        // Hardcoded example: Billing doesn't need to know about homelessness
        context.sdoh = { status: "REDACTED", reason: "Role not authorized for Social History" };
    }

    return context;
};

module.exports = { applyGovernance };
