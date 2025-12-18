const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8083;
const ML_URL = process.env.ML_SERVICE_URL || 'http://ml-service:5000';
const FHIR_URL = process.env.FHIR_SERVER_URL || 'http://fhir-server:8080/fhir';

app.use(express.json());

// Decision cache to show version impact
const decisionHistory = [];

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'cdss-engine', 
    version: '0.3.0-versioned',
    ml_integration: true,
    fhir_connected: true
  });
});

// COMPARE: Show how different model versions affect decisions
app.post('/compare-versions', async (req, res) => {
  const { patientId, patientData, versions } = req.body;
  
  const results = await Promise.all(
    versions.map(async (v) => {
      // Simulate calling different model versions
      const prediction = await mockPredictWithVersion(patientData, v);
      return {
        version: v,
        risk_score: prediction.risk,
        recommendation: generateRecommendation(prediction.risk),
        changed_outcome: prediction.risk > 50 ? 'admit' : 'discharge'
      };
    })
  );
  
  // Show clinical impact of version change
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

// INTEGRATED EVALUATION with Model Versioning Awareness
app.post('/evaluate', async (req, res) => {
  const { patientId, patientData, requestedModelVersion } = req.body;
  console.log(`[CDSS] Evaluating Patient ${patientId}...`);

  try {
    // 1. Fetch patient context from FHIR (demonstrates HPS integration)
    let fhirContext = {};
    try {
      const fhirRes = await axios.get(`${FHIR_URL}/Patient/${patientId}`);
      fhirContext = {
        age: calculateAge(fhirRes.data.birthDate),
        conditions: fhirRes.data.condition || []
      };
    } catch (e) {
      console.warn('[CDSS] FHIR unavailable, using request data');
    }

    // 2. ML Inference with version tracking
    const features = {
      age: fhirContext.age || patientData?.age || 45,
      condition: patientData?.condition || 'Unknown',
      systolic_bp: parseInt(patientData?.vitals?.bloodPressure?.split('/')[0] || 120)
    };

    const mlResponse = await axios.post(`${ML_URL}/predict`, { 
      features,
      model_version: requestedModelVersion // Allow version pinning
    });
    const aiResult = mlResponse.data;

    // 3. Clinical Rules Engine (CDSS Core Logic)
    const ruleAlerts = applyClinicalRules(patientData, aiResult);

    // 4. Risk Mitigation with Explainability
    let finalRecommendation = "";
    let alertLevel = "info";
    let actionableItems = [];

    if (aiResult.safety_guardrails.drift_detected) {
      // Fallback to rules-based
      finalRecommendation = `⚠️ DATA DRIFT: ${aiResult.safety_guardrails.drift_reasons.join(', ')}. Using protocol-based assessment.`;
      alertLevel = "critical";
      actionableItems = ['Manual physician review required', 'Validate vital signs accuracy'];
    } else {
      const risk = aiResult.prediction.risk_score;
      
      // Generate tiered recommendations
      if (risk > 70) {
        actionableItems = [
          'Schedule follow-up within 24 hours',
          'Activate care coordination team',
          'Review medication adherence',
          'Consider home health services'
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

      const contributors = aiResult.explainability.contributors
        .map(c => `${c.feature} (${c.impact})`)
        .join(', ');
      
      finalRecommendation = `Risk: ${risk}% (${aiResult.prediction.label}). Drivers: ${contributors}.`;
    }

    // 5. Audit trail (demonstrates compliance)
    const decision = {
      timestamp: new Date().toISOString(),
      patientId,
      modelVersion: aiResult.metadata.model_version,
      risk: aiResult.prediction.risk_score,
      decision: alertLevel,
      clinician_notified: alertLevel === 'critical'
    };
    decisionHistory.push(decision);

    // 6. Integrated response
    res.json({
      timestamp: decision.timestamp,
      patientId,
      status: alertLevel,
      recommendation: finalRecommendation,
      actions: actionableItems,
      source: {
        ml_model: aiResult.metadata.model_version,
        rules_engine: ruleAlerts.length > 0,
        confidence: aiResult.safety_guardrails.confidence
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

// Clinical Rules Engine (demonstrates rule-based + AI hybrid)
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
  
  // Rule 2: Age-based protocols
  if (patientData?.age > 65 && aiResult.prediction.risk_score > 40) {
    alerts.push({
      rule: 'GERIATRIC-001',
      severity: 'medium',
      message: 'Geriatric care protocols recommended'
    });
  }
  
  return alerts;
}

// Demonstrate model version impact
function generateRecommendation(riskScore) {
  if (riskScore > 70) return 'Admit for observation';
  if (riskScore > 50) return 'Discharge with close follow-up';
  return 'Standard discharge';
}

async function mockPredictWithVersion(data, version) {
  // Simulates different model versions giving different scores
  const baseRisk = data.age > 60 ? 55 : 35;
  const versionDrift = version === 'v1.0.0' ? -10 : +5; // v2 more sensitive
  return { risk: baseRisk + versionDrift };
}

function calculateAge(birthDate) {
  return Math.floor((new Date() - new Date(birthDate)) / 31557600000);
}

// Analytics endpoint
app.get('/analytics/decisions', (req, res) => {
  const stats = {
    total_decisions: decisionHistory.length,
    critical_alerts: decisionHistory.filter(d => d.decision === 'critical').length,
    avg_risk_score: decisionHistory.reduce((sum, d) => sum + d.risk, 0) / decisionHistory.length,
    model_versions_used: [...new Set(decisionHistory.map(d => d.modelVersion))]
  };
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`CDSS Engine (Enhanced) on port ${PORT}`);
});
