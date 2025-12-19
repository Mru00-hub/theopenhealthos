const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8083;

// Service URLs (Docker Network)
const ML_URL = process.env.ML_SERVICE_URL || 'http://ml-service:5000';
const FHIR_URL = process.env.FHIR_SERVER_URL || 'http://fhir-server:8080/fhir';

app.use(express.json());

// In-memory audit log for the "Analytics" tab
const decisionHistory = [];

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'cdss-engine', 
    version: '0.5.0-orchestrator', 
    capabilities: ['multi-model-routing', 'clinical-rules', 'fhir-context']
  });
});

// --- 1. CORE ENGINE: EVALUATE PATIENT (Orchestration) ---
app.post('/evaluate', async (req, res) => {
  const { patientId, patientData, requestedModelVersion } = req.body;
  const targetModel = requestedModelVersion || 'readmission-v1';
  
  console.log(`[CDSS] Orchestrating Evaluation for ${patientId} using Plugin: ${targetModel}`);

  try {
    // A. CONTEXT ASSEMBLY (FHIR + Input)
    // We prioritize FHIR data (Source of Truth) but fallback to Request Data
    let fhirContext = {};
    try {
      const fhirRes = await axios.get(`${FHIR_URL}/Patient/${patientId}`);
      const birthDate = fhirRes.data.birthDate;
      const age = birthDate ? Math.floor((new Date() - new Date(birthDate)) / 31557600000) : 45;
      fhirContext = { age: age, conditions: fhirRes.data.condition || [] };
    } catch (e) {
      console.warn('[CDSS] Warning: FHIR Context unavailable, relying on frontend input');
    }

    // Prepare Standardized Feature Vector for ML Service
    const features = {
      age: fhirContext.age || patientData?.age || 45,
      condition: patientData?.condition || 'Unknown',
      systolic_bp: parseInt(patientData?.vitals?.bloodPressure?.split('/')[0] || 120)
    };

    // B. ML INFERENCE (Real Network Call)
    console.log(`[CDSS] Calling ML Service: POST ${ML_URL}/predict/${targetModel}`);
    const mlResponse = await axios.post(`${ML_URL}/predict/${targetModel}`, { features });
    const aiResult = mlResponse.data;

    // C. CLINICAL RULES ENGINE (Deterministic Logic)
    const ruleAlerts = applyClinicalRules(patientData || { age: features.age, ...patientData }, aiResult);

    // D. DECISION SYNTHESIS & SAFETY
    let finalRecommendation = "";
    let alertLevel = "info";
    let actionableItems = [];

    // Safety Guardrails (Drift Detection)
    if (aiResult.safety_guardrails && aiResult.safety_guardrails.drift_detected) {
      finalRecommendation = `⚠️ DATA DRIFT DETECTED: ${aiResult.safety_guardrails.drift_reasons.join(', ')}. AI Confidence Reduced.`;
      alertLevel = "critical"; // Downgrade trust, upgrade alert urgency
      actionableItems = ['Manual physician review required', 'Validate vital signs accuracy'];
    } else {
      // Standard Risk Stratification
      const risk = aiResult.prediction.risk_score;
      const label = aiResult.prediction.label;
      
      if (risk > 70) {
        actionableItems = ['Immediate Admit', 'Activate Sepsis Protocol', 'Page Resident'];
        alertLevel = "critical";
      } else if (risk > 50) {
        actionableItems = ['Schedule Follow-up (24hr)', 'Review Meds'];
        alertLevel = "warning";
      } else {
        actionableItems = ['Standard Discharge'];
        alertLevel = "success";
      }

      // XAI Integration
      const contributors = aiResult.explainability?.contributors
        .map(c => `${c.feature}`)
        .join(', ') || "None";
      
      finalRecommendation = `Risk: ${risk}% (${label}). Key Drivers: ${contributors}.`;
    }

    // E. AUDIT LOGGING
    const decision = {
      timestamp: new Date().toISOString(),
      patientId,
      modelVersion: aiResult.metadata.model,
      risk: aiResult.prediction.risk_score,
      outcome: alertLevel
    };
    decisionHistory.push(decision);

    // F. RETURN RESPONSE
    res.json({
      timestamp: decision.timestamp,
      patientId,
      status: alertLevel,
      recommendation: finalRecommendation,
      actions: actionableItems,
      source: {
        ml_model: aiResult.metadata.model,
        version: aiResult.metadata.version,
        governance: aiResult.metadata.governance
      },
      explainability: aiResult.explainability,
      clinical_rules_triggered: ruleAlerts,
      audit_logged: true
    });

  } catch (error) {
    console.error('[CDSS] Orchestration Failed:', error.message);
    // Graceful Degradation
    res.json({ 
      status: 'error', 
      recommendation: '⚠️ ML Service Unavailable. Defaulting to Safety Protocol.',
      source: 'Fallback Engine',
      actions: ['Use Paper Protocol', 'Check System Status'],
      explainability: { contributors: [] }
    });
  }
});

// --- 2. FEATURE: REAL A/B TESTING (No Mocking) ---
app.post('/compare-versions', async (req, res) => {
  const { patientData, versions } = req.body;
  // Default comparisons if none provided
  const modelsToCompare = versions || ['readmission-v1', 'sepsis-v2'];
  
  console.log(`[CDSS] Running Real A/B Test: ${modelsToCompare.join(' vs ')}`);

  try {
    // Parallel Execution: Run both models at the same time
    const results = await Promise.all(
      modelsToCompare.map(async (v) => {
        try {
            const features = {
                age: patientData?.age || 50,
                condition: patientData?.condition || 'Unknown',
                systolic_bp: 120
            };
            // HIT THE REAL SERVICE
            const resp = await axios.post(`${ML_URL}/predict/${v}`, { features });
            
            return {
                version: v,
                risk_score: resp.data.prediction.risk_score,
                recommendation: resp.data.prediction.risk_score > 50 ? 'High Risk' : 'Low Risk',
                changed_outcome: resp.data.prediction.risk_score > 50 ? 'admit' : 'discharge'
            };
        } catch (e) {
            console.error(`[CDSS] Model ${v} failed: ${e.message}`);
            return { version: v, risk_score: 0, recommendation: 'Model Offline', changed_outcome: 'error' };
        }
      })
    );
    
    // Impact Analysis
    const v1 = results[0];
    const v2 = results[1];
    let impactMsg = 'No decision change';
    
    if (v1.changed_outcome !== v2.changed_outcome && v1.changed_outcome !== 'error') {
        impactMsg = `⚠️ CRITICAL: Upgrade changes decision from ${v1.changed_outcome} to ${v2.changed_outcome}`;
    }

    res.json({
      comparison: results,
      clinical_impact: impactMsg,
      audit_trail: true
    });
  } catch (e) {
      res.status(500).json({ error: "Comparison Orchestration Failed" });
  }
});

// --- HELPER: CLINICAL RULES ---
function applyClinicalRules(patientData, aiResult) {
  const alerts = [];
  if (patientData?.age > 80 && aiResult.prediction.risk_score > 50) {
    alerts.push({
      rule: 'GERIATRIC-SEPSIS',
      severity: 'high',
      message: 'Geriatric Sepsis Protocol Activated'
    });
  }
  return alerts;
}

// --- HELPER: ANALYTICS ---
app.get('/analytics/decisions', (req, res) => {
  res.json({
    total_decisions: decisionHistory.length,
    recent_logs: decisionHistory.slice(-5)
  });
});

app.listen(PORT, () => {
  console.log(`CDSS Engine (Multi-Model Orchestrator) active on port ${PORT}`);
});
