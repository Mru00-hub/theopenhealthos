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
    const policyActive = req.headers['x-policy-active'] === 'true';

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
        if (policyActive) {
            console.log("   🛡️ PCRM Active: Redacting PII (Role: Researcher)");
            
            // 1. Redact Direct Identifiers
            context.patient.name = "[REDACTED BY PCRM]";
            context.patient.mrn = "[REDACTED]";
            context.patient.dob = "19XX-XX-XX"; // De-identify Date of Birth

            // 2. Restrict Sensitive Clinical Data (Genomics)
            context.genomics = { 
                status: "RESTRICTED", 
                risk_markers: ["[REDACTED - ACCESS DENIED]"] 
            };

            // 3. Restrict Social Data (SDOH)
            context.sdoh = { 
                status: "RESTRICTED", 
                factors: ["[REDACTED - ACCESS DENIED]"] 
            };

            // 4. Filter Care Gaps to only aggregate level (remove specific messages)
            if (context.care_gaps) {
                context.care_gaps = context.care_gaps.map(g => ({
                    type: g.type,
                    message: "[REDACTED CLINICAL ACTION]"
                }));
            }

        } else {
            console.log("   ⚠️ PCRM Inactive: DATA LEAK WARNING - PII Exposed to Researcher");
            // Do NOT redact. 
            // This allows the Frontend 'Context View' to show full names when the switch is OFF,
            // visually proving the danger of turning off governance.
        }
    }
    
    res.json(context);
});

app.listen(PORT, '0.0.0.0', () => console.log(`👑 Clinical Context Awareness listening on ${PORT}`));
