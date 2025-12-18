const express = require('express');
const app = express();
const PORT = process.env.PORT || 8083;

app.use(express.json());

// 1. Health Check (Required for System Status)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'cdss-engine', 
    rules_loaded: 1450,
    version: '0.1.0' 
  });
});

// 2. Evaluation Endpoint (Called by API Gateway during Patient Admission)
app.post('/evaluate', (req, res) => {
  const { patientId, context } = req.body;
  
  console.log(`[CDSS] Evaluating rules for Patient ${patientId}...`);
  
  // Simulate processing delay (analyzing vitals, history, meds)
  setTimeout(() => {
    // In a real system, we'd fetch the patient's data from FHIR here.
    // For this demo, we return a deterministic "alert" to show the flow works.
    
    res.json({
      timestamp: new Date().toISOString(),
      patientId: patientId,
      status: 'warning',
      recommendation: 'Drug Interaction Alert: ACE Inhibitors may conflict with current potassium levels. Monitor K+.',
      confidence: 0.92,
      rule_triggered: 'RULE-RX-404'
    });
  }, 800); // 800ms "thinking" time
});

app.listen(PORT, () => {
  console.log(`CDSS Engine listening on port ${PORT}`);
});
