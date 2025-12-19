const moment = require('moment');

/**
 * SYNTHESIZE CONTEXT
 * Turns raw FHIR resources into a "Context Object".
 */
const synthesize = (rawData) => {
    const { patient, conditions, meds, vitals, genomics, sdoh, ml_predictions } = rawData;

    // 1. CALCULATE ACUITY SCORE (0-10)
    // A simple heuristic based on Vitals + ML
    let acuityScore = 1; // Base
    
    // Check Vital Signs (Latest)
    const lastSys = vitals.find(v => v.code === '8480-6')?.value || 120;
    if (lastSys > 180) acuityScore += 3; // Hypertensive Crisis
    
    // Check ML Risk
    if (ml_predictions?.sepsis_risk > 0.8) acuityScore += 5;

    // 2. IDENTIFY CARE GAPS
    const gaps = [];
    // Example: Diabetic but no HbA1c in last 3 months
    const isDiabetic = conditions.some(c => c.code === '73211009'); // SNOMED Diabetes
    if (isDiabetic) {
        // Mock check for lab
        gaps.push({ type: "CRITICAL", message: "Missing HbA1c checkup (Overdue 30 days)" });
    }

    // 3. GENERATE NARRATIVE SUMMARY
    const summary = [
        `Patient is a ${moment().diff(patient.birthDate, 'years')}yo ${patient.gender}.`,
        isDiabetic ? "Managed for Diabetes." : null,
        acuityScore > 5 ? "CURRENTLY UNSTABLE - REQUIRES ATTENTION." : "Stable."
    ].filter(Boolean).join(" ");

    return {
        // IDENTITY
        patient: {
            id: patient.id,
            name: patient.name,
            age: moment().diff(patient.birthDate, 'years'),
            mrn: patient.mrn
        },
        
        // STATUS
        clinical_status: {
            acuity_score: acuityScore,
            acuity_level: acuityScore > 7 ? "CRITICAL" : (acuityScore > 4 ? "WATCH" : "STABLE"),
            summary: summary
        },

        // INSIGHTS (The value add)
        active_problems: conditions.map(c => c.display),
        current_meds: meds.map(m => m.display),
        
        // LAYER SPECIFIC DATA (Standardized)
        genomics: genomics ? {
            status: "AVAILABLE",
            risk_markers: genomics.variants // Array of risks
        } : { status: "NONE" },

        sdoh: sdoh ? {
            status: "AVAILABLE",
            factors: sdoh.factors // Array of social risks
        } : { status: "NONE" },

        // ACTIONABLE ITEMS
        care_gaps: gaps,
        
        // METADATA
        generated_at: new Date().toISOString()
    };
};

module.exports = { synthesize };
