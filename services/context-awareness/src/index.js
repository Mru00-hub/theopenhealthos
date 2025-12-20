const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4000;

const CONSTANTS = {
    REDACTED_TEXT: "[REDACTED BY PCRM]",
    REDACTED_SHORT: "[REDACTED]",
    ACCESS_DENIED: "[REDACTED - ACCESS DENIED]",
    CLINICAL_MASK: "[REDACTED CLINICAL ACTION]"
};

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => res.json({ status: 'online' }));

app.post('/context/:patientId', async (req, res) => {
    // 1. HEADERS
    const role = req.headers['x-user-role'] || 'CLINICIAN';
    const policyActive = req.headers['x-policy-active'] === 'true';
    
    // 2. INITIALIZE EMPTY CONTEXT
    let context = {
        patient: { id: req.params.patientId, name: "Waiting for Data...", age: 0, mrn: "---", dob: "---" },
        clinical_status: { acuity_score: 0, acuity_level: "LOW", summary: "No data stream." },
        active_problems: [], 
        current_meds: [],
        genomics: { status: "NONE", risk_markers: [] },
        sdoh: { status: "NONE", factors: [] },
        care_gaps: []
    };

    const { bundle } = req.body; 

    // 3. PROCESS DATA
    if (bundle && bundle.entry && bundle.entry.length > 0) {
        
        // --- A. PATIENT IDENTITY (The Key to History) ---
        // We check if an HL7/Patient resource is present.
        const patientRes = bundle.entry.find(e => e.resource.resourceType === 'Patient')?.resource;
        
        if (patientRes) {
            const p = context.patient;
            p.name = `${patientRes.name?.[0]?.given?.[0]} ${patientRes.name?.[0]?.family}`;
            p.mrn = patientRes.identifier?.[0]?.value || "UNK";
            p.dob = patientRes.birthDate;
            p.age = 45;

            // ✅ LOGIC FIX: ONLY LOAD HISTORY IF WE KNOW WHO THE PATIENT IS (HL7 IS ON)
            // 1. Simulate Database Lookup (History)
            context.active_problems.push("Diabetes mellitus (SNOMED)"); 
            context.active_problems.push("Hypertension (ICD-10)");
            
            // 2. Medication Fallback (History)
            context.current_meds.push("Metformin 500mg", "Lisinopril 10mg");
        }

        // --- B. LIVE PIPELINE DATA (Always Processed) ---
        
        // Live Conditions
        const conditions = bundle.entry.filter(e => e.resource.resourceType === 'Condition');
        conditions.forEach(c => context.active_problems.push(c.resource.code?.text));

        // Live Medications
        const meds = bundle.entry.filter(e => e.resource.resourceType.startsWith('Medication'));
        meds.forEach(m => context.current_meds.push(m.resource.medicationCodeableConcept?.text));

        // Genomics (This will work even if HL7 is off!)
        const genomicsRes = bundle.entry.find(e => e.resource.resourceType === 'MolecularSequence')?.resource;
        if (genomicsRes) {
            context.genomics.status = "AVAILABLE";
            const v = genomicsRes.variant?.[0];
            context.genomics.risk_markers.push(v ? `Variant: ${v.observedAllele} (Ref: ${v.referenceAllele})` : "Genomic Marker Found");
        }

        // SDOH
        const sdohObs = bundle.entry.filter(e => {
            const r = e.resource;
            if (r.resourceType !== 'Observation') return false;
            const isSocial = r.category?.[0]?.coding?.[0]?.code === 'social-history';
            const isSDOHCode = ['71802-3', '88124-3', '93033-9'].includes(r.code?.coding?.[0]?.code);
            return isSocial || isSDOHCode;
        });

        if (sdohObs.length > 0) {
            context.sdoh.status = "AVAILABLE";
            context.sdoh.factors = sdohObs.map(o => o.resource.valueCodeableConcept?.coding?.[0]?.display || "Social Factor");
        }

        // --- C. CARE GAPS LOGIC ---
        // Gap Logic now depends on History (which depends on HL7)
        const hasDiabetes = context.active_problems.some(p => p.toLowerCase().includes('diabetes'));
        
        // Scan for HbA1c
        const hasHbA1c = bundle.entry.some(e => 
            e.resource.resourceType === 'Observation' && 
            e.resource.code?.coding?.some(c => c.code === '4548-4')
        );

        // Only show this gap if we KNOW they have diabetes (i.e., HL7 is on)
        if (hasDiabetes && !hasHbA1c) {
            context.care_gaps.push({ type: "CRITICAL", message: "HbA1c Checkup Overdue (Diabetic Protocol)" });
        }

        // Research Gap
        const isResearch = bundle.entry.some(e => e.resource.resourceType === 'ResearchSubject');
        if (isResearch) {
            context.care_gaps.push({ type: "ADMIN", message: "Verify Research Consent 2025" });
        }

        // --- D. SCORING ---
        let score = (patientRes ? 1 : 0) + (context.active_problems.length) + (context.genomics.risk_markers.length * 2);
        context.clinical_status.acuity_score = Math.min(10, score);
        context.clinical_status.summary = `Context Built. Score: ${score}/10`;
    }

    // 4. GOVERNANCE
    if (role === 'RESEARCHER' && policyActive) {
        const p = context.patient;
        p.name = CONSTANTS.REDACTED_TEXT;
        p.mrn = CONSTANTS.REDACTED_SHORT;
        p.dob = CONSTANTS.REDACTED_SHORT;
        
        if (context.genomics.status === 'AVAILABLE') {
            context.genomics.status = "RESTRICTED";
            context.genomics.risk_markers = [CONSTANTS.ACCESS_DENIED];
        }
        if (context.sdoh.status === 'AVAILABLE') {
            context.sdoh.status = "RESTRICTED";
            context.sdoh.factors = [CONSTANTS.ACCESS_DENIED];
        }
    }
    
    res.json(context);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Listening on ${PORT}`));

