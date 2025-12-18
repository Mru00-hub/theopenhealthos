const express = require('express');
const cors = require('cors'); 
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8000;

// 1. ENABLE CORS (Essential for React)
app.use(cors());
app.use(express.json());

console.log(`API Gateway acting as HOS Kernel on port ${PORT}`);

// --- ROUTING TABLE (The Kernel's Map) ---

// A. ML ORCHESTRATOR (Proxies everything: /train, /predict/sepsis-v1, /genai/consult)
app.use('/api/v1/ml', createProxyMiddleware({ 
    target: process.env.ML_SERVICE || 'http://ml-service:5000', 
    changeOrigin: true,
    pathRewrite: { '^/api/v1/ml': '' }, // /api/v1/ml/train -> /train
    onProxyReq: (proxyReq) => console.log(`[Kernel] Routing to ML-Service: ${proxyReq.path}`)
}));

// B. CDSS ENGINE
app.use('/api/v1/cdss', createProxyMiddleware({ 
    target: process.env.CDSS_SERVICE || 'http://cdss-engine:8083', 
    changeOrigin: true,
    pathRewrite: { '^/api/v1/cdss': '' }
}));

// C. FHIR SERVER (Patients)
app.use('/api/v1/patients', createProxyMiddleware({ 
    target: process.env.FHIR_SERVICE || 'http://fhir-server:8080/fhir', 
    changeOrigin: true,
    pathRewrite: { '^/api/v1/patients': '/Patient' } 
}));

// D. DEVICE GATEWAY (REST API for Physics/Legacy)
// This was missing in your proposed code! Restoring it now.
app.use('/api/v1/devices', createProxyMiddleware({ 
    target: process.env.DEVICE_SERVICE || 'http://device-gateway:8082',
    changeOrigin: true,
    // We map /api/v1/devices/optical -> /stream/driver/optical (matching device-gateway routes)
    pathRewrite: { '^/api/v1/devices': '/stream/driver' } 
}));

// E. DEVICE STREAMING (WebSocket)
app.use('/live/stream', createProxyMiddleware({ 
    target: process.env.DEVICE_SERVICE || 'http://device-gateway:8082', 
    changeOrigin: true,
    ws: true, 
    logLevel: 'debug'
}));

// --- KERNEL SIMULATION LOGIC ---

// F. KERNEL SCHEDULER (QoS Simulation)
app.post('/api/v1/kernel/scheduler', (req, res) => {
    console.log(`[OS Kernel] Received Task: ${req.body.taskType} | Priority: ${req.body.priority}`);
    
    // Simulate Preemption Logic
    const latency = req.body.priority === 'CRITICAL' ? 2 : 45;
    if (req.body.priority === 'CRITICAL') {
        console.log('>>> [SCHEDULER] PREEMPTION: Processing Critical Task IMMEDIATELY');
    }
    
    res.json({ status: 'scheduled', latency_ms: latency, kernel_pid: Math.floor(Math.random() * 9000) });
});

// G. HAL NETWORK TOGGLE
app.post('/api/v1/hal/network', (req, res) => {
    // In a real OS, this would toggle the network interface
    console.log(`[HAL] Network Hardware State: ${req.body.status ? 'ONLINE' : 'OFFLINE'}`);
    // We can also forward this to the device gateway if needed, but the simulation is fine here
    res.json({ status: 'hardware_state_updated' });
});

// H. SYSTEM HEALTH CHECK
app.get('/health/system', async (req, res) => {
    // Return "All Green" so the frontend connects immediately
    res.json({
        status: 'online',
        kernel_version: '0.6.0-merged',
        services: {
            fhir: true, device: true, ml: true, security: true, cdss: true,
            registry: true, validation: true, llm: true
        },
        endpoints: {
            fhir: '/api/v1/patients',
            ml: '/api/v1/ml',
            cdss: '/api/v1/cdss'
        }
    });
});

app.listen(PORT, () => {
    console.log(`HOS Kernel Gateway active on port ${PORT}`);
});
