const express = require('express');
const cors = require('cors');
const { findUser, validatePassword } = require('./users');
const { generateToken, verifyToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3022;

app.use(cors());
app.use(cors({ origin: true, credentials: true }));

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'governance-sas', 
        auth_methods: ['Password', 'MFA-Mock', 'Break-Glass'] 
    });
});

/**
 * POST /login
 * Standard Login. Returns a JWT.
 * Body: { "username": "dr_smith", "password": "password123", "mfa_code": "123456" }
 */
app.post('/login', (req, res) => {
    const { username, password, mfa_code } = req.body;

    const user = findUser(username);
    if (!user || !validatePassword(user, password)) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // Mock MFA Check (Simulating that any 6-digit code is valid if provided)
    const isMfaValid = mfa_code && mfa_code.length === 6;

    const token = generateToken(user, isMfaValid);
    
    res.json({
        token,
        user: { username: user.username, role: user.role },
        assurance_level: isMfaValid ? "High (MFA)" : "Low (Password)",
        message: "Authentication Successful"
    });
});

/**
 * POST /break-glass
 * Emergency Access Login.
 * Requires: Valid User Creds + "Emergency Reason".
 * Grants: High Assurance Token but flags 'context: emergency'.
 */
app.post('/break-glass', (req, res) => {
    const { username, password, reason } = req.body;

    const user = findUser(username);
    if (!user || !validatePassword(user, password)) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!reason || reason.length < 5) {
        return res.status(400).json({ error: "Emergency reason required for Break Glass" });
    }

    // Issue Emergency Token
    // Note: We grant LoA 2 (High) even without MFA because it's an emergency, 
    // but the 'context: emergency' claim triggers intense auditing in RCF.
    const token = generateToken(user, true, 'emergency');

    console.log(`[SAS] BREAK-GLASS EVENT: ${username} accessed emergency mode. Reason: ${reason}`);

    res.json({
        token,
        warning: "This session is being audited. Access granted for 15 minutes.",
        context: "EMERGENCY"
    });
});

/**
 * POST /verify
 * Used by API Gateway to check tokens.
 */
app.post('/verify', (req, res) => {
    const { token } = req.body;
    const result = verifyToken(token);
    
    if (result.valid) {
        res.json(result.decoded);
    } else {
        res.status(401).json({ error: "Invalid or expired token" });
    }
});

/**
 * POST /audit
 * Logs immutable access events from the dashboard.
 */
app.post('/audit', (req, res) => {
    const log = req.body;
    // In production, this writes to a WORM (Write Once Read Many) storage
    console.log(`[SAS AUDIT] ${new Date().toISOString()} | User: ${log.user} | Action: ${log.action} | Scope: ${log.records} records`);
    res.json({ status: "logged", id: Date.now() });
});

app.listen(PORT, () => {
    console.log(`🔐 SAS Identity Service listening on port ${PORT}`);
    console.log(`   - IAM Ready (Roles: Practitioner, Nurse, Researcher, Admin)`);
});
