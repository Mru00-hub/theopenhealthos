const { v4: uuidv4 } = require('uuid');

// Mock Secure Storage
const AUDIT_LOG = [];

const logEvent = (eventData) => {
    const { 
        timestamp = new Date().toISOString(),
        actor,     // Who? (e.g., "Dr. Smith")
        action,    // What? (e.g., "READ")
        resource,  // Which data? (e.g., "Patient/1001")
        outcome,   // Result (0=Success, 4=Minor Fail, 8=Severe Fail)
        desc       // Readable description
    } = eventData;

    // Construct FHIR AuditEvent Resource
    const auditEvent = {
        resourceType: "AuditEvent",
        id: uuidv4(),
        type: { system: "http://terminology.hl7.org/CodeSystem/audit-event-type", code: "rest" },
        action: action, // C=Create, R=Read, U=Update, D=Delete, E=Execute
        recorded: timestamp,
        outcome: outcome,
        outcomeDesc: desc,
        agent: [{
            who: { display: actor },
            requestor: true
        }],
        source: { observer: { display: "HOS-Governance-Layer" } },
        entity: [{
            what: { reference: resource }
        }]
    };

    // "Write" to secure log
    AUDIT_LOG.push(auditEvent);
    
    console.log(`[RCF-Audit] LOGGED: ${timestamp} | ${actor} -> ${action} ${resource} | Status: ${outcome}`);
    
    return auditEvent.id;
};

const getLogs = (filter) => {
    // Simple filter simulation
    if (!filter) return AUDIT_LOG;
    return AUDIT_LOG.filter(entry => 
        JSON.stringify(entry).toLowerCase().includes(filter.toLowerCase())
    );
};

module.exports = { logEvent, getLogs };
