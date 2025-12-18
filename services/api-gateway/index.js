const express = require('express');
const cors = require('cors'); 
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

console.log(`API Gateway acting as HOS Kernel on port ${PORT}`);

// --- ROUTING TABLE ---

// 1. MODEL REGISTRY (Connects Port 5001 - WAS MISSING)
app.use('/api/v1/registry', createProxyMiddleware({ 
    target: process.env.REGISTRY_SERVICE || 'http://model-registry:5001', 
    changeOrigin: true,
    pathRewrite: { '^/api/v1/registry': '' }, // /api/v1/registry/models -> /models
    onProxyReq: (proxyReq) => console.log(`[Kernel] Routing to Registry: ${proxyReq.path}`)
}));

// 2. ML ORCHESTRATOR
app.use('/api/v1/ml', createProxyMiddleware({ 
    target: process.env.ML_SERVICE || 'http://ml-service:5000', 
    changeOrigin: true,
    pathRewrite: { '^/api/v1/ml': '' }
}));

// 3. CDSS ENGINE
app.use('/api/v1/cdss', createProxyMiddleware({ 
    target: process.env.CDSS_SERVICE || 'http://cdss-engine:8083', 
    changeOrigin: true,
    pathRewrite: { '^/api/v1/cdss': '' }
}));

// 4. FHIR SERVER
app.use('/api/v1/patients', createProxyMiddleware({ 
    target: process.env.FHIR_SERVICE || 'http://fhir-server:8080/fhir', 
    changeOrigin: true,
    pathRewrite: { '^/api/v1/patients': '/Patient' } 
}));

// 5. DEVICE GATEWAY (REST)
app.use('/api/v1/devices', createProxyMiddleware({ 
    target: process.env.DEVICE_SERVICE || 'http://device-gateway:8082',
    changeOrigin: true,
    // Maps /api/v1/devices/optical -> /stream/driver/optical
    pathRewrite: { '^/api/v1/devices': '/stream/driver' } 
}));

// 6. DEVICE STREAMING (WebSocket)
app.use('/live/stream', createProxyMiddleware({ 
    target: process.env.DEVICE_SERVICE || 'http://device-gateway:8082', 
    changeOrigin: true,
    ws: true, 
    logLevel: 'debug'
}));

// 7. KERNEL SCHEDULER (Simulation)
app.post('/api/v1/kernel/scheduler', (req, res) => {
    const latency = req.body.priority === 'CRITICAL' ? 2 : 45;
    res.json({ status: 'scheduled', latency_ms: latency, kernel_pid: Math.floor(Math.random() * 9000) });
});

// 8. HAL NETWORK TOGGLE
app.post('/api/v1/hal/network', (req, res) => {
    res.json({ status: 'hardware_state_updated' });
});

// 9. HEALTH CHECK
app.get('/health/system', async (req, res) => {
    res.json({
        status: 'online',
        services: { fhir: true, device: true, ml: true, security: true, cdss: true, registry: true, validation: true, llm: true },
        endpoints: { fhir: '/api/v1/patients', ml: '/api/v1/ml', registry: '/api/v1/registry' }
    });
});

app.listen(PORT, () => {
    console.log(`HOS Kernel Gateway active on port ${PORT}`);
});
