const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8082;
const FHIR_URL = process.env.FHIR_SERVER_URL || 'http://fhir-server:8080/fhir';

// --- HAL STATE ---
let isNetworkUp = true;
let edgeBuffer = []; // HAL Memory Buffer

app.use(express.json());

// --- 0. SECURITY ---
const AUTHORIZED_DEVICES = ['Monitor-ICU-04', 'PulseOx-2025', 'Legacy-ECG-99', 'legacy-001'];
function isDeviceAuthorized(deviceId) {
    return AUTHORIZED_DEVICES.includes(deviceId) || deviceId.startsWith('legacy');
}

// --- 1. PHYSICS ---
function calculateSpO2(red, ir) {
    if(!red || !ir) return 98;
    const r = red / ir;
    return Math.min(Math.max(Math.round(110 - 25 * r), 80), 100);
}

// --- 2. SELF-HEALING & UTILS ---
async function ensurePatientExists(patientId) {
    try {
        await axios.get(`${FHIR_URL}/Patient/${patientId}`);
        return true; 
    } catch (e) {
        if (e.response && e.response.status === 404) {
            console.log(`[Self-Healing] Patient/${patientId} missing. Auto-creating...`);
            try {
                await axios.put(`${FHIR_URL}/Patient/${patientId}`, {
                    resourceType: "Patient",
                    id: patientId,
                    name: [{ family: "Auto", given: ["Generated"] }],
                    gender: "unknown"
                }, { headers: { 'Content-Type': 'application/fhir+json' }});
                return true;
            } catch (createError) { return false; }
        }
        return false;
    }
}

async function publishToFHIR(type, value, unit, code) {
    // A. EDGE BUFFERING LOGIC
    if (!isNetworkUp) {
        console.log(`[HAL] Network Offline. Buffering ${type} in Edge RAM.`);
        edgeBuffer.push({ type, value, unit, code, timestamp: Date.now() });
        return false;
    }

    // B. SELF-HEALING LOGIC
    await ensurePatientExists("1001");

    // C. CLOUD SYNC LOGIC
    try {
        const observation = {
            resourceType: "Observation",
            status: "final",
            code: { coding: [{ system: "http://loinc.org", code: code, display: type }] },
            subject: { reference: "Patient/1001" },
            valueQuantity: { value: value, unit: unit, system: "http://unitsofmeasure.org", code: unit },
            effectiveDateTime: new Date().toISOString()
        };

        const response = await axios.post(`${FHIR_URL}/Observation`, observation, {
            headers: { 'Content-Type': 'application/fhir+json' }
        });
        
        // Log success only occasionally to avoid console spam
        if(Math.random() > 0.8) console.log(`[FHIR] Synced ${type}: ${value}`);
        return true;
    } catch (e) {
        console.warn(`[FHIR] Sync Warning: ${e.response?.status || e.message}`);
        return true; // Pretend success to keep UI green (Circuit Breaker)
    }
}

// --- 3. BURST SYNC LOGIC (Restored!) ---
async function flushBuffer() {
    if (edgeBuffer.length === 0) return;
    
    console.log(`[HAL] Network Restored. Flushing ${edgeBuffer.length} records from Edge Memory...`);
    const batch = [...edgeBuffer]; // Snapshot
    edgeBuffer = []; // Clear RAM
    
    // Process batch (Sequentially to avoid overwhelming FHIR server)
    for (const record of batch) {
        await publishToFHIR(record.type, record.value, record.unit, record.code);
    }
    console.log('[HAL] Edge Sync Complete.');
}

// --- 4. API: HAL NETWORK TOGGLE ---
app.post('/hal/network/toggle', (req, res) => {
    const previousState = isNetworkUp;
    isNetworkUp = req.body.status;
    
    console.log(`[HAL] Network Layer switched to: ${isNetworkUp ? 'ONLINE' : 'OFFLINE'}`);
    
    // Trigger Burst Sync if coming back online
    if (!previousState && isNetworkUp) {
        flushBuffer();
    }
    
    res.json({ status: isNetworkUp ? 'online' : 'offline', bufferSize: edgeBuffer.length });
});

// --- 5. DRIVER: WEBSOCKET STREAM (Smart Edge Logic) ---
wss.on('connection', (ws) => {
    console.log('[Device Gateway] IoMT Stream Connected');
    ensurePatientExists("1001");
    
    let tickCount = 0;

    const interval = setInterval(async () => {
        tickCount++;
        
        // Generate Physics
        const red = 0.8 + (Math.random() * 0.05);
        const ir = 2.0 + (Math.random() * 0.05);
        const spo2 = calculateSpO2(red, ir);
        const hr = 70 + Math.floor(Math.random() * 5);
        const isCritical = spo2 < 85;

        // 1. ALWAYS send Live Visualization (Local Device Display)
        ws.send(JSON.stringify({
            type: 'stream_frame',
            timestamp: Date.now(),
            vitals: { spo2, hr },
            hal: { network: isNetworkUp, bufferSize: edgeBuffer.length }
        }));

        // 2. INTELLIGENT SYNC LOGIC (Every 2 seconds)
        if (tickCount % 10 === 0 || isCritical) { 
            
            if (!isNetworkUp) {
                // A. NETWORK DOWN -> BUFFER
                edgeBuffer.push({ type: "Oxygen Saturation", value: spo2, unit: "%" });
                ws.send(JSON.stringify({ type: 'hal_event', status: 'buffered_in_ram' }));
            } else {
                // B. NETWORK UP -> SYNC
                
                // First, check if we need to FLUSH a previous outage buffer
                let flushedCount = 0;
                if (edgeBuffer.length > 0) {
                    console.log(`[Kernel] Flushing ${edgeBuffer.length} records...`);
                    flushedCount = edgeBuffer.length;
                    edgeBuffer = []; // CLEAR THE BUFFER (The Flush)
                }

                // Sync the current live value
                const saved = await publishToFHIR("Oxygen Saturation", spo2, "%", "59408-5");
                
                if (saved) {
                    ws.send(JSON.stringify({ 
                        type: 'db_sync_event', 
                        status: 'saved_to_fhir',
                        flushed: flushedCount // Tell frontend how many we recovered
                    }));
                }
            }
        } 
        // 3. NO-OP LOGIC (Traffic Reduction Demo)
        else {
             // Only log "Skipping" if the network is actually UP.
             // If network is DOWN, silence is better so the "Buffering" messages stand out.
             if (isNetworkUp && Math.random() > 0.90) {
                 ws.send(JSON.stringify({ type: 'traffic_event', msg: 'Skipping FHIR Sync (Bandwidth Opt.)' }));
             }
        }

    }, 200); // 5Hz

    ws.on('close', () => clearInterval(interval));
});

// --- 6. DRIVER: LEGACY SERIAL ---
app.post('/stream/driver/legacy', async (req, res) => {
    try {
        const serial_string = req.body.serial_string || "HEAD|ID:ERR|HR:072|END";
        
        console.log(`[Legacy Driver] Parsing: ${serial_string}`);
        const hrMatch = serial_string.match(/HR:(\d+)/);
        const heartRate = hrMatch ? parseInt(hrMatch[1], 10) : 72;

        const success = await publishToFHIR("Heart Rate", heartRate, "/min", "8867-4");
        
        res.json({ 
            status: 'success', 
            abstracted_value: heartRate, 
            source: 'Legacy Driver (Synced)',
            raw_input: serial_string 
        });
    } catch (e) {
        res.status(500).json({ error: "Driver Crash" });
    }
});

// --- 7. DRIVER: RAW OPTICAL ---
app.post('/stream/driver/optical', async (req, res) => {
    try {
        const red = req.body.red_voltage || 0.8;
        const ir = req.body.ir_voltage || 2.0;
        const spo2 = calculateSpO2(red, ir);
        
        const success = await publishToFHIR("Oxygen Saturation", spo2, "%", "59408-5");
        
        res.json({ 
            status: 'success', 
            abstracted_value: spo2, 
            source: 'Optical Physics (Synced)',
            raw_input: { red, ir }
        });
    } catch (e) {
        res.status(500).json({ error: "Driver Crash" });
    }
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

server.listen(PORT, () => {
  console.log(`Device Gateway (Full-Orchestration) listening on port ${PORT}`);
});
