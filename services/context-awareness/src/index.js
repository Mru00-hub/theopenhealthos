const express = require('express');
const cors = require('cors');
// const { fetchData } = require('./aggregator'); // Comment out for Demo
// const { synthesize } = require('./synthesizer'); // Comment out for Demo

const app = express();
const PORT = 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'online' }));

app.get('/context/:patientId', (req, res) => {
    const role = req.headers['x-user-role'] || 'CLINICIAN';
    console.log(`[CCA] Generating Context for Patient ${req.params.patientId} (Role: ${role})`);

    // --- 1. AGGREGATE & SYNTHESIZE (Simulated) ---
    // In production, these variables would come from your real 'synthesizer' module
    let context = {
        patient: { id: "1001", name: "John Doe", age: 45, mrn: "MRN-999" },
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
    // This is the architecture part you want to demonstrate
    if (role === 'RESEARCHER') {
        console.log("   🛡️ [Governance] Redacting PII and Sensitive Data for Researcher");
        context.patient.name = "REDACTED";
        context.patient.mrn = "REDACTED";
        context.genomics = { status: "RESTRICTED", risk_markers: ["REDACTED"] };
        context.sdoh = { status: "RESTRICTED", factors: ["REDACTED"] };
    }

    res.json(context);
});

app.listen(PORT, '0.0.0.0', () => console.log(`👑 Clinical Context Awareness listening on ${PORT}`));
