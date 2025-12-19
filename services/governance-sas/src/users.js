const bcrypt = require('bcryptjs');

/**
 * MOCK IDENTITY PROVIDER
 * Users representing different Roles and Assurance Levels.
 */

// Pre-hashed password: "password123"
const HASH = "$2a$10$X.x.x.x... (Simulated Hash)"; 

const USERS = [
    {
        username: "dr_smith",
        // In real app, use bcrypt.hashSync("password123", 10)
        password_hash: "$2a$10$CwTycUXWue0Thq9StjUM0u.e/1a2b3c4d5e6f7g8h9i0j", 
        role: "PRACTITIONER",
        department: "CARDIOLOGY",
        clearance: "LEVEL_3"
    },
    {
        username: "nurse_joy",
        password_hash: "$2a$10$CwTycUXWue0Thq9StjUM0u.e/1a2b3c4d5e6f7g8h9i0j",
        role: "NURSE",
        department: "EMERGENCY",
        clearance: "LEVEL_2"
    },
    {
        username: "researcher_bob",
        password_hash: "$2a$10$CwTycUXWue0Thq9StjUM0u.e/1a2b3c4d5e6f7g8h9i0j",
        role: "RESEARCHER",
        department: "ONCOLOGY",
        clearance: "LEVEL_1" // Restricted Access
    },
    {
        username: "admin_alice",
        password_hash: "$2a$10$CwTycUXWue0Thq9StjUM0u.e/1a2b3c4d5e6f7g8h9i0j",
        role: "ADMIN",
        department: "IT",
        clearance: "LEVEL_5"
    }
];

// Helper to find user
const findUser = (username) => USERS.find(u => u.username === username);

// Helper to validate password (Mocked for simplicity in this snippet)
const validatePassword = (user, password) => {
    // In real app: return bcrypt.compareSync(password, user.password_hash);
    return password === "password123"; 
};

module.exports = { findUser, validatePassword };
