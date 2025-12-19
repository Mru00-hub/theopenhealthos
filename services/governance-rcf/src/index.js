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

app.listen(PORT, () => {
    console.log(`⚖️  RCF Compliance Service listening on port ${PORT}`);
    console.log(`   - Audit Trail & Ethics Engine Active`);
});
