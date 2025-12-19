const { v4: uuidv4 } = require('uuid');

/**
 * RESEARCH EXPERT TRANSFORMER
 * Converts Clinical Trial data (Protocol or Subject Status) into FHIR R4.
 * * Capabilities:
 * 1. Maps Study Details -> ResearchStudy
 * 2. Maps Patient Enrollment -> ResearchSubject
 * 3. Standardizes Trial Phases (Phase 1-4)
 */

const transformStudy = (protocolData) => {
    const studyId = uuidv4();
    const resources = [];

    // 1. RESEARCH STUDY (The Protocol)
    const researchStudy = {
        resourceType: "ResearchStudy",
        id: studyId,
        identifier: [
            { system: "http://clinicaltrials.gov", value: protocolData.nct_id || "NCT-PENDING" },
            { system: "http://hospital.org/studies", value: protocolData.protocol_id }
        ],
        title: protocolData.title || "Untitled Clinical Trial",
        status: mapStatus(protocolData.status), // active, completed, etc.
        phase: {
            coding: [{
                system: "http://terminology.hl7.org/CodeSystem/research-study-phase",
                code: mapPhase(protocolData.phase),
                display: `Phase ${protocolData.phase}`
            }]
        },
        category: [{ text: protocolData.condition || "General Research" }],
        
        // Detailed Description (Inclusion/Exclusion)
        description: protocolData.description,
        protocol: [{ display: "Inclusion: " + (protocolData.inclusion_criteria || "See Protocol") }],
        
        // Contact / Sponsor
        sponsor: { display: protocolData.sponsor || "Internal Hospital Research" },
        principalInvestigator: { display: protocolData.pi_name || "Unknown PI" }
    };

    resources.push({ 
        resource: researchStudy, 
        request: { method: "PUT", url: `ResearchStudy/${studyId}` } 
    });

    return {
        resourceType: "Bundle",
        id: uuidv4(),
        type: "transaction",
        entry: resources
    };
};

const transformSubject = (enrollmentData, patientRef) => {
    if (!patientRef) throw new Error("Patient reference required for enrollment");
    
    const subjectId = uuidv4();
    const resources = [];

    // 2. RESEARCH SUBJECT (The Patient in the Trial)
    const researchSubject = {
        resourceType: "ResearchSubject",
        id: subjectId,
        status: mapSubjectStatus(enrollmentData.status), // candidate, enrolled, withdrawn
        period: {
            start: enrollmentData.enrollment_date || new Date().toISOString()
        },
        study: { 
            // In a real system, you'd look up the UUID. 
            // Here we reference the identifier to keep it loose-coupled.
            identifier: { system: "http://hospital.org/studies", value: enrollmentData.protocol_id },
            display: enrollmentData.protocol_id
        },
        individual: { reference: patientRef },
        assignedArm: enrollmentData.arm_group || "Open Label"
    };

    resources.push({ 
        resource: researchSubject, 
        request: { method: "POST", url: "ResearchSubject" } 
    });

    return {
        resourceType: "Bundle",
        id: uuidv4(),
        type: "transaction",
        entry: resources
    };
};

// --- HELPERS ---

const mapStatus = (status) => {
    const map = { 'recruiting': 'active', 'enrolling': 'active', 'closed': 'closed-to-accrual', 'completed': 'completed' };
    return map[status?.toLowerCase()] || 'active';
};

const mapPhase = (phase) => {
    // FHIR codes are usually "phase-1", "phase-2", etc.
    if(String(phase).includes('1')) return 'phase-1';
    if(String(phase).includes('2')) return 'phase-2';
    if(String(phase).includes('3')) return 'phase-3';
    if(String(phase).includes('4')) return 'phase-4';
    return 'n-a';
};

const mapSubjectStatus = (status) => {
    // candidate | eligible | follow-up | ineligible | not-registered | off-study | on-study | ...
    const s = status?.toLowerCase();
    if (s === 'enrolled') return 'on-study';
    if (s === 'screening') return 'candidate';
    if (s === 'completed') return 'completed';
    if (s === 'withdrawn') return 'withdrawn';
    return 'candidate';
};

module.exports = { transformStudy, transformSubject };
