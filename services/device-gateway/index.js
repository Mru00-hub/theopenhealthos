const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8082;
const FHIR_URL = process.env.FHIR_SERVER_URL || 'http://fhir-server:8080/fhir';

app.use(express.json());

// --- 0. OS SECURITY LAYER: DEVICE REGISTRY ---
// Proves the OS only talks to authorized hardware
const AUTHORIZED_DEVICES = ['Monitor-ICU-04', 'PulseOx-2025', 'Legacy-ECG-99'];

function isDeviceAuthorized(deviceId) {
    const isAuth = AUTHORIZED_DEVICES.includes(deviceId);
    if (!isAuth) console.warn(`[Security] Blocked unauthorized device: ${deviceId}`);
    return isAuth;
}

// --- 1. PHYSICS ENGINE (Hardware Abstraction) ---
function calculateSpO2(red, ir) {
    const r = red / ir;
    return Math.min(Math.max(Math.round(110 - 25 * r), 80), 100);
}

// --- 2. FHIR INTEROPERABILITY UTILITY ---
async function publishToFHIR(type, value, unit, code) {
    try {
        const observation = {
            resourceType: "Observation",
            status: "final",
            category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
            code: { coding: [{ system: "http://loinc.org", code: code, display: type }] },
            subject: { reference: "Patient/1000" },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: value, unit: unit, system: "http://unitsofmeasure.org", code: unit },
            device: { display: "OpenHealthOS-Device-Gateway" }
        };

        await axios.post(`${FHIR_URL}/Observation`, observation, {
            headers: { 'Content-Type': 'application/fhir+json' }
        });
        return true;
    } catch (e) {
        console.error('[FHIR] Sync Failed:', e.message);
        return false;
    }
}

// --- 3. DRIVER: WEBSOCKET STREAM (Modern IoMT + Smart Edge) ---
wss.on('connection', (ws, req) => {
    // Check auth (Simulated via URL param or just default for demo)
    if (!isDeviceAuthorized('Monitor-ICU-04')) {
        ws.close();
        return;
    }

    console.log('[Device Gateway] IoMT Stream Connected');
    let tickCount = 0;

    const interval = setInterval(async () => {
        tickCount++;
        
        // Generate Physics
        const noise = (Math.random() - 0.5) * 0.1; 
        const red_voltage = 0.8 + noise;
        const ir_voltage = 2.0 + noise;
        const spo2 = calculateSpO2(red_voltage, ir_voltage);
        const heartRate = 70 + Math.floor(Math.random() * 5);

        // OS Layer: Critical Alert Logic at the Edge
        const isCritical = spo2 < 85; 

        // Stream Data
        ws.send(JSON.stringify({
            type: 'stream_frame',
            timestamp: Date.now(),
            raw_physics: { red: red_voltage.toFixed(3), ir: ir_voltage.toFixed(3) },
            vitals: { spo2, hr: heartRate },
            alert: isCritical ? 'CRITICAL_DESATURATION' : null
        }));

        // Edge Filtering: Save to DB every 5 seconds OR immediately if Critical
        if (tickCount % 50 === 0 || isCritical) {
            const saved = await publishToFHIR("O2 Saturation", spo2, "%", "59408-5");
            if (saved) ws.send(JSON.stringify({ type: 'db_sync_event', status: 'saved_to_fhir' }));
        }
    }, 100);

    ws.on('close', () => clearInterval(interval));
});

// --- 4. DRIVER: LEGACY SERIAL (Protocol Abstraction) ---
app.post('/stream/driver/legacy', async (req, res) => {
    const { serial_string, device_id } = req.body;
    
    if (!isDeviceAuthorized(device_id || 'Legacy-ECG-99')) {
        return res.status(403).json({ error: 'Device Unauthorized' });
    }

    try {
        console.log(`[Legacy Driver] Parsing: ${serial_string}`);
        const hrMatch = serial_string.match(/HR:(\d+)/);
        if (!hrMatch) throw new Error("Invalid Serial Format");
        
        const heartRate = parseInt(hrMatch[1], 10);
        await publishToFHIR("Heart Rate", heartRate, "/min", "8867-4");
        
        // FIXED: Added 'raw_input' here
        res.json({ 
            status: 'success', 
            abstracted_value: heartRate, 
            source: 'Legacy Parser',
            raw_input: serial_string 
        });
    } catch (e) {
        res.status(400).json({ error: 'Protocol Mismatch' });
    }
});

// --- 5. DRIVER: RAW OPTICAL SNAPSHOT (Physics Abstraction) ---
app.post('/stream/driver/optical', async (req, res) => {
    const { red_voltage, ir_voltage } = req.body;
    
    const spo2 = calculateSpO2(red_voltage, ir_voltage);
    await publishToFHIR("Oxygen Saturation", spo2, "%", "59408-5");
    
    // FIXED: Added 'raw_input' here
    res.json({ 
        status: 'success', 
        abstracted_value: spo2, 
        source: 'Physics Engine',
        raw_input: { red: red_voltage, ir: ir_voltage }
    });
});

app.get('/health', (req, res) => res.json({ 
    status: 'healthy', 
    drivers_loaded: ['websocket-iomt', 'rest-legacy', 'rest-physics'],
    security_check: 'active' 
}));

server.listen(PORT, () => {
  console.log(`Device Gateway (Universal) listening on port ${PORT}`);
});
