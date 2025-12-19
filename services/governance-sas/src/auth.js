const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-me";

/**
 * GENERATE TOKEN
 * Creates a JWT with embedded claims for Role and Assurance Level.
 */
const generateToken = (user, mfaVerified = false, context = "standard") => {
    const payload = {
        sub: user.username,
        role: user.role,
        dept: user.department,
        
        // LEVEL OF ASSURANCE (LoA)
        // 1 = Password only
        // 2 = Password + MFA (Required for e-Prescribing or Break Glass)
        loa: mfaVerified ? 2 : 1, 

        // Context: 'standard' or 'emergency'
        context: context, 

        // JTI (Unique Token ID) for audit tracking
        jti: uuidv4()
    };

    // Emergency tokens expire fast (15 mins), Standard tokens (1 hour)
    const expiry = context === 'emergency' ? '15m' : '1h';

    return jwt.sign(payload, JWT_SECRET, { expiresIn: expiry });
};

/**
 * VERIFY TOKEN
 * Middleware logic to check if a token is valid.
 */
const verifyToken = (token) => {
    try {
        return { valid: true, decoded: jwt.verify(token, JWT_SECRET) };
    } catch (err) {
        return { valid: false, error: err.message };
    }
};

module.exports = { generateToken, verifyToken };
