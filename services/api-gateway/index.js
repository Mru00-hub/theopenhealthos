const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8000;

// Service URLs (Internal Docker Network Names)
const SERVICES = {
  fhir: process.env.FHIR_SERVICE || 'http://fhir-server:8080/fhir',
  ml: process.env.ML_SERVICE || 'http://ml-service:5000',
  cdss: process.env.CDSS_SERVICE || 'http://cdss-engine:8083',
  security: process.env.SECURITY_SERVICE || 'http://security-service:8081',
  device: process.env.DEVICE_SERVICE || 'http://device-gateway:8082'
};

app.use(cors()); // Allow React frontend to connect
app.use(express.json());

// 1. SYSTEM HEALTH CHECK (The "Connect" Button Logic)
app.get('/health/system', async (req, res) => {
  console.log('Performing kernel system check...');
  
  const status = {
    services: {
      fhir: false,
      ml: false,
      security: false,
      cdss: false,
      device: false
    },
    endpoints: {
      fhir: SERVICES.fhir
    },
    timestamp: new Date().toISOString()
  };

  // Check all services in parallel
  try {
    const checks = [
      // Check FHIR Server (HAPI FHIR metadata endpoint)
      axios.get(`${SERVICES.fhir}/metadata`, { timeout: 5000 })
        .then(() => { status.services.fhir = true; })
        .catch(err => console.error('FHIR Health Fail:', err.message)),

      // Check ML Service
      axios.get(`${SERVICES.ml}/health`, { timeout: 5000 })
        .then(() => { status.services.ml = true; })
        .catch(err => console.error('ML Health Fail:', err.message)),

      // Check Security Service
      axios.get(`${SERVICES.security}/health`, { timeout: 5000 })
        .then(() => { status.services.security = true; })
        .catch(err => console.error('Security Health Fail:', err.message)),
        
       // Check CDSS Service
      axios.get(`${SERVICES.cdss}/health`, { timeout: 5000 })
        .then(() => { status.services.cdss = true; })
        .catch(err => console.error('CDSS Health Fail:', err.message)),

      // ADDED Device Gateway Check
      axios.get(`${SERVICES.device}/health`, { timeout: 5000 })
        .then(() => { status.services.device = true; })
        .catch(err => console.error('Device Health Fail:', err.message))
    ];

    await Promise.all(checks);
    
    // Calculate global system health (True if critical services are up)
    const isHealthy = status.services.fhir && status.services.ml;
    
    res.status(200).json(status);

  } catch (error) {
    res.status(503).json({ error: 'Kernel panic: Health check failed', details: error.message });
  }
});

// 2. PATIENT API (Forwarding to FHIR Server)
app.post('/api/v1/patients', async (req, res) => {
  try {
    console.log('Forwarding new patient to FHIR server...');
    // In a real app, we would transform the simple JSON to FHIR here.
    // For now, we assume the frontend sends valid FHIR or we wrap it.
    
    const fhirPatient = {
      resourceType: "Patient",
      name: req.body.name, // Expecting array from frontend
      gender: req.body.gender,
      birthDate: req.body.birthDate
    };

    // Forward to HAPI FHIR
    const response = await axios.post(`${SERVICES.fhir}/Patient`, fhirPatient, {
      headers: { 'Content-Type': 'application/fhir+json' }
    });

    res.status(201).json(response.data);
  } catch (error) {
    console.error('Error creating patient:', error.message);
    res.status(500).json({ error: 'Failed to write to Clinical Data Repository' });
  }
});

// 3. ML TRAINING API (Forwarding to Python Service)
app.post('/api/v1/ml/train', async (req, res) => {
  try {
    console.log('Triggering ML training job...');
    const response = await axios.post(`${SERVICES.ml}/train`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('ML Service Error:', error.message);
    res.status(500).json({ error: 'ML Training failed to start' });
  }
});

// 4. CDSS EVALUATION API (Forwarding to CDSS Engine)
app.post('/api/v1/cdss/evaluate', async (req, res) => {
  try {
    console.log('Requesting clinical decision support...');
    const response = await axios.post(`${SERVICES.cdss}/evaluate`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('CDSS Service Error:', error.message);
    res.status(500).json({ error: 'Clinical Decision Support unavailable' });
  }
});

// 5a. RAW SENSOR STREAM (Physics)
app.post('/api/v1/devices/optical', async (req, res) => {
  try {
    // Generate random raw voltages for simulation
    const rawData = {
        red_voltage: 0.8 + Math.random() * 0.4, // Random 0.8 - 1.2v
        ir_voltage: 2.0 + Math.random() * 0.5   // Random 2.0 - 2.5v
    };
    const response = await axios.post(`${SERVICES.device}/stream/driver/optical`, rawData);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Optical driver failed' });
  }
});

// 5b. LEGACY STREAM (Protocol)
app.post('/api/v1/devices/legacy', async (req, res) => {
  try {
    // Generate a messy proprietary string
    const randomHR = 60 + Math.floor(Math.random() * 40);
    const messyString = `HEAD|ID:ERR|HR:0${randomHR}|VOLT:Low|END`;
    
    const response = await axios.post(`${SERVICES.device}/stream/driver/legacy`, { serial_string: messyString });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Legacy driver failed' });
  }
});

// Basic Gateway Health
app.get('/health', (req, res) => res.json({ status: 'Gateway Online', version: '1.0.0' }));

app.listen(PORT, () => {
  console.log(`API Gateway acting as HOS Kernel on port ${PORT}`);
});
