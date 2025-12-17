const express = require('express');
const app = express();
const PORT = process.env.PORT || 8082;

app.use(express.json());

// Health Check (Critical for the Simulator to see it as "Online")
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'device-gateway', protocol: 'HL7/DICOM' });
});

// Mock Data Stream Endpoint
app.post('/stream/data', (req, res) => {
  console.log('Received IoMT device data packet');
  res.json({ status: 'accepted', latency_ms: 12 });
});

app.listen(PORT, () => {
  console.log(`Device Gateway listening on port ${PORT}`);
});
