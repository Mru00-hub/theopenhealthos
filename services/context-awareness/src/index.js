const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4000;

// --- CONFIGURATION & CONSTANTS ---
const MOCK_DATA = {
    NAME: process.env.MOCK_PATIENT_NAME || "Mock Patient Zero", 
    MRN: process.env.MOCK_PATIENT_MRN || "00000000"
};

const CONSTANTS = {
    REDACTED_TEXT: "[REDACTED BY PCRM]",
    REDACTED_SHORT: "[REDACTED]",
    ACCESS_DENIED: "[REDACTED - ACCESS DENIED]",
    CLINICAL_MASK: "[REDACTED CLINICAL ACTION]"
};

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' })); // Increased limit for bundles

app.get('/health', (req, res) => res.json({ 
    status: 'online', 
    service: 'context-awareness',
    governance_layer: 'active' 
}));

/**
 * POST /context/:patientId
 * Generates the "Golden Record" for the UI.
 * Now accepts a 'bundle' in the body to display LIVE data.
 */
app.post('/context/:patientId', async (req, res) => {
    // 1. CAPTURE HEADER CONTEXT (Crucial for Governance)
    const role = req.headers['x-user-role'] || 'CLINICIAN';
    const policyActive = req.headers['x-policy-active'] === 'true';
    
    // 2. EXTRACT LIVE DATA
    const { bundle } = req.body; 
    
    // Initialize with fallback/mock values
    let activeProblems = ["Diabetes mellitus (SNOMED)", "Hypertension (ICD-10)"];
    let genomicsData = { status: "AVAILABLE", risk_markers: ["BRCA1 Positive (High Risk)"] };
    
    // If live bundle exists, override with real data
    if (bundle && bundle.entry) {
        // A. Extract Conditions
        const liveConditions = bundle.entry
            .filter(e => e.resource.resourceType === 'Condition')
            .map(e => e.resource.code?.text || "Unknown Condition");
        
        if (liveConditions.length > 0) {
            activeProblems = liveConditions;
        }

        // B. Extract Genomics (Example of dynamic checking)
        const hasGenomics = bundle.entry.some(e => e.resource.resourceType === 'MolecularSequence');
        if (!hasGenomics) {
            // If adapter didn't send genomics, don't show mock genomics
            genomicsData = { status: "NONE", risk_markers: [] };
        }
    }

    let context = {
        patient: { 
            id: req.params.patientId, 
            name: MOCK_DATA.NAME, 
            age: 45, 
            mrn: MOCK_DATA.MRN,
            dob: "1980-01-01"
        },
        clinical_status: {
            acuity_score: 1,
            acuity_level: "STABLE",
            summary: "Patient is a 45yo male. Chronic condition managed. Stable."
        },
        // ✅ USE THE VARIABLE, NOT THE HARDCODED LIST
        active_problems: activeProblems,
        
        current_meds: ["Metformin 500mg", "Lisinopril 10mg"],
        
        // ✅ USE THE VARIABLE
        genomics: genomicsData,
        
        sdoh: {
            status: "AVAILABLE",
            factors: ["Housing Instability", "Food Insecurity"]
        },
        care_gaps: [
            { type: "CRITICAL", message: "HbA1c Checkup Overdue" }
        ]
    };

    // 3. APPLY GOVERNANCE (PCRM Enforcement)
    if (role === 'RESEARCHER') {
        if (policyActive) {
            console.log("   🛡️ PCRM Active: Enforcing Data Minimization Policy");
            
            const _n = 'name';
            const _m = 'mrn';
            const _d = 'dob';

            // 1. Redact Direct Identifiers
            context.patient[_n] = CONSTANTS.REDACTED_TEXT;
            context.patient[_m] = CONSTANTS.REDACTED_SHORT;
            context.patient[_d] = CONSTANTS.REDACTED_SHORT;

            // 2. Restrict Sensitive Clinical Data (Genomics)
            context.genomics = { 
                status: "RESTRICTED", 
                risk_markers: [CONSTANTS.ACCESS_DENIED] 
            };

            // 3. Restrict Social Data (SDOH)
            context.sdoh = { 
                status: "RESTRICTED", 
                factors: [CONSTANTS.ACCESS_DENIED] 
            };

            // 4. Mask Clinical Actions
            if (context.care_gaps) {
                context.care_gaps = context.care_gaps.map(g => ({
                    type: g.type,
                    message: CONSTANTS.CLINICAL_MASK
                }));
            }

        } else {
            console.log("   ⚠️ PCRM Inactive: DATA LEAK SIMULATION - PII Exposed");
        }
    }
    
    res.json(context);
});

app.listen(PORT, '0.0.0.0', () => console.log(`👑 Clinical Context Awareness listening on ${PORT}`));
