const express = require('express');
const cors = require('cors');
const { validatePurpose } = require('./ethics');
const { logEvent, getLogs } = require('./auditor');

const app = express();
const PORT = process.env.PORT || 3021;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'governance-rcf', 
        compliance_standards: ['HIPAA', 'GDPR', 'Audit-trail'] 
    });
});

/**
 * POST /validate-purpose
 * Called BEFORE data access to check ethics.
 * Body: { "actorRole": "RESEARCHER", "purpose": "MARKETING" }
 */
app.post('/validate-purpose', (req, res) => {
    const { actorRole, purpose } = req.body;
    const result = validatePurpose(actorRole, purpose);
    
    // Log the validation attempt itself if it failed
    if (!result.valid) {
        logEvent({
            actor: actorRole,
            action: "E", // Execute
            resource: "Policy/Ethics",
            outcome: "8", // Serious Failure
            desc: `Blocked invalid purpose: ${purpose}`
        });
    }

    res.json(result);
});

/**
 * POST /log
 * Called AFTER data access (successful or failed) to record the event.
 * Body: { "actor": "Dr. Smith", "action": "R", "resource": "Patient/1001", "outcome": "0" }
 */
app.post('/log', (req, res) => {
    try {
        const id = logEvent(req.body);
        res.json({ status: "logged", audit_id: id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /audit-trail
 * (Admin Only) View logs.
 */
app.get('/audit-trail', (req, res) => {
    const { q } = req.query;
    const logs = getLogs(q);
    res.json({ count: logs.length, events: logs });
});

/**
 * POST /check-consent
 * (REQUIRED BY FRONTEND SIMULATOR)
 * Checks patient opt-in status using your Architecture Logic.
 */
app.post('/check-consent', (req, res) => {
    const { patientId, studyId } = req.body;
    
    // 1. Log the attempt using your EXISTING auditor.js
    logEvent({
        actor: "RESEARCHER",
        action: "R", // Read
        resource: `Patient/${patientId}/Consent`,
        outcome: "0",
        desc: `Consent Check for Study: ${studyId}`
    });

    // 2. Perform Simulation Logic
    // In a real DB, you'd look up the patient's Consent Resource.
    // For Demo: Patient 1001 = Consented. Others = Not.
    const isConsented = (patientId === '1001');

    if (isConsented) {
        res.json({ consented: true, status: "OPT_IN" });
    } else {
        // Log the denial event
        logEvent({
            actor: "RESEARCHER",
            action: "E", // Execute decision
            resource: `Patient/${patientId}`,
            outcome: "4", // Minor Failure (Blocked)
            desc: "Consent Denied by RCF"
        });
        res.json({ consented: false, status: "OPT_OUT" });
    }
});

app.listen(PORT, () => {
    console.log(`⚖️  RCF Compliance Service listening on port ${PORT}`);
    console.log(`   - Audit Trail & Ethics Engine Active`);
});
