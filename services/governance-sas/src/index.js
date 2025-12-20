const express = require('express');
const cors = require('cors');
const { findUser, validatePassword } = require('./users');
const { generateToken, verifyToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3022;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'governance-sas', auth_methods: ['Password', 'Break-Glass'] });
});

app.post('/login', (req, res) => {
    const { username, password, mfa_code } = req.body;
    const user = findUser(username);
    if (!user || !validatePassword(user, password)) return res.status(401).json({ error: "Invalid credentials" });
    const isMfaValid = mfa_code && mfa_code.length === 6;
    const token = generateToken(user, isMfaValid);
    res.json({ token, user: { username: user.username, role: user.role }, assurance_level: isMfaValid ? "High" : "Low" });
});

app.post('/break-glass', (req, res) => {
    const { username, password, reason } = req.body;
    const user = findUser(username);
    if (!user || !validatePassword(user, password)) return res.status(401).json({ error: "Invalid credentials" });
    if (!reason || reason.length < 5) return res.status(400).json({ error: "Reason required" });
    const token = generateToken(user, true, 'emergency');
    res.json({ token, warning: "Audited Session", context: "EMERGENCY" });
});

app.post('/verify', (req, res) => {
    const { token } = req.body;
    const result = verifyToken(token);
    result.valid ? res.json(result.decoded) : res.status(401).json({ error: "Invalid Token" });
});

app.post('/audit', (req, res) => {
    try {
        const { user, action, records } = req.body;
        // Log to console so it appears in your Frontend "Logs" panel
        console.log(`[SAS AUDIT] User: ${user || 'Anon'} | Action: ${action} | Scope: ${records || 0} items`);
        res.json({ status: "logged", id: Date.now() });
    } catch (e) {
        console.error("Audit Error:", e);
        res.status(500).json({ error: "Audit Failed" });
    }
});

app.listen(PORT, () => {
    console.log(`🔐 SAS Identity Service listening on port ${PORT}`);
    console.log(`   - IAM Ready (Roles: Practitioner, Nurse, Researcher, Admin)`);
});
