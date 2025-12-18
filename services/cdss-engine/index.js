const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8083;

// Service URLs
const ML_URL = process.env.ML_SERVICE_URL || 'http://ml-service:5000';
const FHIR_URL = process.env.FHIR_SERVER_URL || 'http://fhir-server:8080/fhir';

app.use(express.json());

// Decision cache to show version impact
const decisionHistory = [];

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'cdss-engine', 
    version: '0.4.0-multi-model', // Updated version
    ml_integration: true,
    fhir_connected: true
  });
});

// KEEPING YOUR FEATURE: Compare Model Versions (A/B Testing Simulation)
app.post('/compare-versions', async (req, res) => {
  const { patientId, patientData, versions } = req.body;
  
  const results = await Promise.all(
    versions.map(async (v) => {
      const prediction = await mockPredictWithVersion(patientData, v);
      return {
        version: v,
        risk_score: prediction.risk,
        recommendation: generateRecommendation(prediction.risk),
        changed_outcome: prediction.risk > 50 ? 'admit' : 'discharge'
      };
    })
  );
  
  const v1_decision = results[0].changed_outcome;
  const v2_decision = results[1].changed_outcome;
  
  res.json({
    comparison: results,
    clinical_impact: v1_decision !== v2_decision ? 
      `⚠️ CRITICAL: Model upgrade changed decision from ${v1_decision} to ${v2_decision}` :
      'No decision change',
    audit_trail: true
  });
});

// CRITICAL UPDATE: Integrated Evaluation with Multi-Model Routing
app.post('/evaluate', async (req, res) => {
  const { patientId, patientData, requestedModelVersion } = req.body;
  console.log(`[CDSS] Evaluating Patient ${patientId}...`);

  try {
    // 1. Fetch patient context from FHIR
    let fhirContext = {};
    try {
      const fhirRes = await axios.get(`${FHIR_URL}/Patient/${patientId}`);
      // Calculate age from birthDate
      const birthDate = fhirRes.data.birthDate;
      const age = birthDate ? Math.floor((new Date() - new Date(birthDate)) / 31557600000) : 45;
      
      fhirContext = {
        age: age,
        conditions: fhirRes.data.condition || []
      };
    } catch (e) {
      console.warn('[CDSS] FHIR unavailable, using request data');
    }

    // 2. ML Inference (UPDATED LOGIC)
    const features = {
      age: fhirContext.age || patientData?.age || 45,
      condition: patientData?.condition || 'Unknown',
      systolic_bp: parseInt(patientData?.vitals?.bloodPressure?.split('/')[0] || 120)
    };

    // ROUTING CHANGE: Construct the specific URL for the model (e.g., /predict/readmission-v1)
    const targetModel = requestedModelVersion || 'readmission-v1';
    console.log(`[CDSS] Routing inference to model: ${targetModel}`);

    // Call the new ML Service endpoint
    const mlResponse = await axios.post(`${ML_URL}/predict/${targetModel}`, { 
      features 
    });
    const aiResult = mlResponse.data;

    // 3. Clinical Rules Engine (Keeping your detailed logic)
    const ruleAlerts = applyClinicalRules(patientData || { age: features.age, ...patientData }, aiResult);

    // 4. Risk Mitigation & Recommendations
    let finalRecommendation = "";
    let alertLevel = "info";
    let actionableItems = [];

    if (aiResult.safety_guardrails.drift_detected) {
      finalRecommendation = `⚠️ DATA DRIFT DETECTED: ${aiResult.safety_guardrails.drift_reasons.join(', ')}. Using protocol-based assessment.`;
      alertLevel = "critical";
      actionableItems = ['Manual physician review required', 'Validate vital signs accuracy'];
    } else {
      const risk = aiResult.prediction.risk_score;
      const label = aiResult.prediction.label;
      
      if (risk > 70) {
        actionableItems = [
          'Schedule follow-up within 24 hours',
          'Activate care coordination team',
          'Review medication adherence'
        ];
        alertLevel = "critical";
      } else if (risk > 50) {
        actionableItems = [
          'Schedule follow-up within 7 days',
          'Patient education on warning signs'
        ];
        alertLevel = "warning";
      } else {
        actionableItems = ['Standard discharge protocol'];
        alertLevel = "success";
      }

      // Format Explainability
      const contributors = aiResult.explainability.contributors
        .map(c => `${c.feature} (${c.impact})`)
        .join(', ');
      
      finalRecommendation = `Risk: ${risk}% (${label}). Drivers: ${contributors}.`;
    }

    // 5. Audit trail
    const decision = {
      timestamp: new Date().toISOString(),
      patientId,
      modelVersion: aiResult.metadata.version || 'unknown',
      risk: aiResult.prediction.risk_score,
      decision: alertLevel,
      clinician_notified: alertLevel === 'critical'
    };
    decisionHistory.push(decision);

    // 6. Response (Matching your frontend expectations)
    res.json({
      timestamp: decision.timestamp,
      patientId,
      status: alertLevel,
      recommendation: finalRecommendation,
      actions: actionableItems,
      source: {
        ml_model: aiResult.metadata.model, // Updated to match new ML response
        version: aiResult.metadata.version,
        governance: aiResult.metadata.governance
      },
      explainability: aiResult.explainability,
      clinical_rules_triggered: ruleAlerts,
      audit_logged: true
    });

  } catch (error) {
    console.error('[CDSS] Error:', error.message);
    res.json({ 
      status: 'error', 
      recommendation: '⚠️ Systems unavailable. Manual clinical assessment required.',
      source: 'Fallback',
      actions: ['Page on-call physician', 'Use paper protocols']
    });
  }
});

// KEEPING YOUR FEATURE: Clinical Rules Engine
function applyClinicalRules(patientData, aiResult) {
  const alerts = [];
  
  // Rule 1: Drug interaction check
  if (patientData?.medications?.includes('ACE-inhibitor') && 
      patientData?.labs?.potassium > 5.0) {
    alerts.push({
      rule: 'DRUG-INTERACT-001',
      severity: 'high',
      message: 'ACE inhibitor + hyperkalemia risk'
    });
  }
  
  // Rule 2: Age-based protocols (Using AI result context)
  if (patientData?.age > 65 && aiResult.prediction.risk_score > 40) {
    alerts.push({
      rule: 'GERIATRIC-001',
      severity: 'medium',
      message: 'Geriatric care protocols recommended'
    });
  }
  
  return alerts;
}

// KEEPING YOUR FEATURE: Recommendation Helper
function generateRecommendation(riskScore) {
  if (riskScore > 70) return 'Admit for observation';
  if (riskScore > 50) return 'Discharge with close follow-up';
  return 'Standard discharge';
}

// KEEPING YOUR FEATURE: Mock Prediction for A/B Testing
async function mockPredictWithVersion(data, version) {
  const baseRisk = data && data.age > 60 ? 55 : 35;
  const versionDrift = version === 'v1.0.0' ? -10 : +5;
  return { risk: baseRisk + versionDrift };
}

// KEEPING YOUR FEATURE: Analytics Endpoint
app.get('/analytics/decisions', (req, res) => {
  const stats = {
    total_decisions: decisionHistory.length,
    critical_alerts: decisionHistory.filter(d => d.decision === 'critical').length,
    avg_risk_score: decisionHistory.length ? decisionHistory.reduce((sum, d) => sum + d.risk, 0) / decisionHistory.length : 0,
    model_versions_used: [...new Set(decisionHistory.map(d => d.modelVersion))]
  };
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`CDSS Engine (Multi-Model Integrated) on port ${PORT}`);
});
