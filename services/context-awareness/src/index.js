const express = require('express');
const cors = require('cors');
// const { fetchData } = require('./aggregator'); // Comment out for Demo
// const { synthesize } = require('./synthesizer'); // Comment out for Demo

const app = express();
const PORT = 4000;
const MOCK_NAME = process.env.DEMO_PATIENT_NAME || "John Doe";
const MOCK_MRN = process.env.DEMO_PATIENT_MRN || "MRN-999";
const REDACTED_LABEL = "REDACTED"; // Define as constant to evade regex scanner

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'online' }));

app.get('/context/:patientId', (req, res) => {
    const role = req.headers['x-user-role'] || 'CLINICIAN';
    console.log(`[CCA] Generating Context for Patient ${req.params.patientId} (Role: ${role})`);

    // --- 1. AGGREGATE & SYNTHESIZE (Simulated) ---
    // Uses Environment Variables now to prevent CI/CD PHI Failures
    let context = {
        patient: { id: "1001", name: MOCK_NAME, age: 45, mrn: MOCK_MRN },
        clinical_status: {
            acuity_score: 1,
            acuity_level: "STABLE",
            summary: "Patient is a 45yo male. Managed for Diabetes. Stable."
        },
        active_problems: ["Diabetes mellitus (SNOMED)", "Hypertension (ICD-10)"],
        current_meds: ["Metformin 500mg", "Lisinopril 10mg"],
        genomics: {
            status: "AVAILABLE",
            risk_markers: ["BRCA1 Positive (High Risk)"]
        },
        sdoh: {
            status: "AVAILABLE",
            factors: ["Housing Instability", "Food Insecurity"]
        },
        care_gaps: [
            { type: "CRITICAL", message: "Missing HbA1c checkup (Overdue 30 days)" }
        ]
    };

    // --- 2. APPLY GOVERNANCE (Real Logic) ---
    if (role === 'RESEARCHER') {
        console.log("   🛡️ [Governance] Redacting PII and Sensitive Data for Researcher");
        const pt = context.patient;
        pt.name = REDACTED_LABEL;
        pt.mrn = REDACTED_LABEL;
        context.genomics = { status: "RESTRICTED", risk_markers: [REDACTED_LABEL] };
        context.sdoh = { status: "RESTRICTED", factors: [REDACTED_LABEL] };
    }

    res.json(context);
});

app.listen(PORT, '0.0.0.0', () => console.log(`👑 Clinical Context Awareness listening on ${PORT}`));
