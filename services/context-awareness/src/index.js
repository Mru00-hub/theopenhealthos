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
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => res.json({ 
    status: 'online', 
    service: 'context-awareness',
    governance_layer: 'active' 
}));

/**
 * POST /context/:patientId
 * Generates the "Golden Record" dynamically based strictly on the input bundle.
 */
app.post('/context/:patientId', async (req, res) => {
    // 1. CAPTURE HEADER CONTEXT
    const role = req.headers['x-user-role'] || 'CLINICIAN';
    const policyActive = req.headers['x-policy-active'] === 'true';
    
    // 2. INITIALIZE EMPTY CONTEXT (No Mock Data by default)
    let context = {
        patient: { 
            id: req.params.patientId, 
            name: "Unknown Patient", // Default until Patient resource found
            age: 0, 
            mrn: "Unknown",
            dob: "Unknown"
        },
        clinical_status: {
            acuity_score: 0,
            acuity_level: "UNCERTAIN",
            summary: "Waiting for data stream..."
        },
        active_problems: [],
        current_meds: [],
        genomics: { status: "NONE", risk_markers: [] },
        sdoh: { status: "NONE", factors: [] },
        care_gaps: []
    };

    // 3. EXTRACT LIVE DATA FROM PIPELINE
    const { bundle } = req.body; 
    
    if (bundle && bundle.entry && bundle.entry.length > 0) {
        
        // A. Patient Identity (HL7 Adapter)
        const patientRes = bundle.entry.find(e => e.resource.resourceType === 'Patient')?.resource;
        if (patientRes) {
            context.patient.name = patientRes.name?.[0]?.given?.[0] + " " + patientRes.name?.[0]?.family;
            context.patient.mrn = patientRes.identifier?.[0]?.value;
            context.patient.dob = patientRes.birthDate;
            context.clinical_status.summary = `Patient is a ${patientRes.gender}. Data aggregation active.`;
        }

        // B. Active Problems (Conditions)
        context.active_problems = bundle.entry
            .filter(e => e.resource.resourceType === 'Condition')
            .map(e => e.resource.code?.text || "Unknown Condition");

        // C. Medications
        context.current_meds = bundle.entry
            .filter(e => e.resource.resourceType === 'MedicationRequest' || e.resource.resourceType === 'MedicationStatement')
            .map(e => e.resource.medicationCodeableConcept?.text || "Unknown Med");

        // D. Genomics (MolecularSequence)
        const genomicsRes = bundle.entry.filter(e => e.resource.resourceType === 'MolecularSequence');
        if (genomicsRes.length > 0) {
            context.genomics.status = "AVAILABLE";
            context.genomics.risk_markers = genomicsRes.map(e => {
                const v = e.resource.variant?.[0];
                return v ? `Variant: ${v.observedAllele} (Ref: ${v.referenceAllele})` : "Genomic Marker Found";
            });
        }

        // E. SDOH (Observations with specific category or codes)
        const sdohRes = bundle.entry.filter(e => {
            const r = e.resource;
            if (r.resourceType !== 'Observation') return false;
            // Check for Social History category or specific LOINC codes from your SDOH adapter
            const isSocial = r.category?.[0]?.coding?.[0]?.code === 'social-history';
            const isHousing = r.code?.coding?.[0]?.code === '71802-3'; // Housing status
            const isFood = r.code?.coding?.[0]?.code === '88124-3';    // Food insecurity
            return isSocial || isHousing || isFood;
        });

        if (sdohRes.length > 0) {
            context.sdoh.status = "AVAILABLE";
            context.sdoh.factors = sdohRes.map(e => {
                // Use the valueCodeableConcept display if available, else raw value
                return e.resource.valueCodeableConcept?.coding?.[0]?.display || e.resource.valueBoolean?.toString() || "Social Factor";
            });
        }

        // F. Calculate Simple Acuity based on Data Volume/Severity
        context.clinical_status.acuity_score = Math.min(10, bundle.entry.length); // Dummy logic: more data = higher attention
        if (context.clinical_status.acuity_score > 0) context.clinical_status.acuity_level = "STABLE";
    }

    // 4. APPLY GOVERNANCE (PCRM Enforcement)
    if (role === 'RESEARCHER') {
        if (policyActive) {
            console.log("   🛡️ PCRM Active: Enforcing Data Minimization Policy");
            
            const _n = 'name';
            const _m = 'mrn';
            const _d = 'dob';

            // Redact Identity
            context.patient[_n] = CONSTANTS.REDACTED_TEXT;
            context.patient[_m] = CONSTANTS.REDACTED_SHORT;
            context.patient[_d] = CONSTANTS.REDACTED_SHORT;

            // Restrict Genomics
            if (context.genomics.status === 'AVAILABLE') {
                context.genomics.status = "RESTRICTED";
                context.genomics.risk_markers = [CONSTANTS.ACCESS_DENIED];
            }

            // Restrict SDOH
            if (context.sdoh.status === 'AVAILABLE') {
                context.sdoh.status = "RESTRICTED";
                context.sdoh.factors = [CONSTANTS.ACCESS_DENIED];
            }
        }
    }
    
    res.json(context);
});

app.listen(PORT, '0.0.0.0', () => console.log(`👑 Clinical Context Awareness listening on ${PORT}`));
