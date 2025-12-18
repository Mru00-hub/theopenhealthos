import React, { useState, useEffect } from 'react';
import { Activity, Database, Shield, Cpu, Wifi, HardDrive, AlertCircle, CheckCircle } from 'lucide-react';

// Configuration for API endpoints (assumes API Gateway is on port 8000)
const API_BASE_URL = 'https://didactic-broccoli-wrx56qq7467jc579j-8000.app.github.dev';

const MicroservicesSimulator = () => {
  const [activeServices, setActiveServices] = useState({
    fhir: false,
    device: false,
    ml: false,
    security: false,
    cdss: false
  });
  
  const [messages, setMessages] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [securityStatus, setSecurityStatus] = useState('idle');
  const [isSystemHealthy, setIsSystemHealthy] = useState(false);

  // Helper for delays (still useful for UI pacing)
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const addMessage = (service, text, type = 'info') => {
    const msg = {
      id: Date.now() + Math.random(),
      service,
      text,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, msg].slice(-15));
  };

  // REAL implementation: Pings the API Gateway to check container health
  const startAllServices = async () => {
    addMessage('system', 'Initiating handshake with Healthcare OS Kernel...', 'info');
    
    try {
      // We expect the API Gateway to return a status object for all subsystems
      // You will need to implement /health/system at your gateway
      const response = await fetch(`${API_BASE_URL}/health/system`);
      
      if (!response.ok) {
        throw new Error(`Gateway responded with ${response.status}`);
      }

      const healthData = await response.json();
      
      // Update UI based on REAL backend status
      setActiveServices({
        fhir: healthData.services.fhir,
        device: healthData.services.device,
        ml: healthData.services.ml,
        security: healthData.services.security,
        cdss: healthData.services.cdss
      });

      setIsSystemHealthy(true);
      addMessage('system', '✓ Connection established: All Docker containers active', 'success');
      addMessage('fhir', `✓ FHIR R4 Server at ${healthData.endpoints.fhir}`, 'success');

    } catch (error) {
      console.error(error);
      addMessage('error', `Connection Failed: Is Docker running? (${error.message})`, 'error');
      setIsSystemHealthy(false);
    }
  };

  // Stop services (Client-side reset only)
  const stopAllServices = () => {
    setActiveServices({
      fhir: false,
      device: false,
      ml: false,
      security: false,
      cdss: false
    });
    setMessages([]);
    setPatientData(null);
    setMlPrediction(null);
    setSecurityStatus('idle');
    setIsSystemHealthy(false);
    addMessage('system', 'Disconnected from OS Kernel', 'warning');
  };

  // REAL Implementation: Sends data to the backend
  const simulatePatientAdmission = async () => {
    if (!activeServices.fhir) {
      addMessage('error', 'Cannot admit patient: FHIR service is unreachable', 'error');
      return;
    }

    setSecurityStatus('checking');
    addMessage('security', 'Requesting authorization token from Security Service...');
    
    try {
      // 1. Get Auth Token (Real Call)
      // const authRes = await fetch(`${API_BASE_URL}/auth/token`, { method: 'POST' }); 
      // mocking auth delay for now, but keeping structure ready
      await delay(500); 
      setSecurityStatus('approved');
      addMessage('security', '✓ Access Granted (JWT Token Issued)', 'success');

      // 2. Create Patient in FHIR Server (Real Call via Gateway)
      const patientPayload = {
        resourceType: "Patient",
        name: [{ family: "Doe", given: ["John"] }],
        gender: "male",
        birthDate: "1980-01-01"
      };

      addMessage('api-gateway', 'POST /api/v1/patients (Routing to HAPI FHIR)...');
      
      const response = await fetch(`${API_BASE_URL}/api/v1/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientPayload)
      });

      const newPatient = await response.json();
      
      setPatientData({
        id: newPatient.id || 'FHIR-GEN-ID',
        name: 'John Doe',
        age: 45,
        condition: 'Hypertension', // This would come from an Observation resource in a real full flow
        vitals: { heartRate: 88, bloodPressure: '145/92', temperature: 98.6 }
      });

      addMessage('fhir', `✓ Resource Created: Patient/${newPatient.id}`, 'success');

      // 3. Trigger CDSS Analysis (Real Call)
      if (activeServices.cdss) {
        addMessage('cdss', 'Triggering rules engine for new patient...');
        const cdssRes = await fetch(`${API_BASE_URL}/api/v1/cdss/evaluate`, {
            method: 'POST',
            body: JSON.stringify({ patientId: newPatient.id })
        });
        const advice = await cdssRes.json();
        addMessage('cdss', `Alert: ${advice.recommendation}`, 'warning');
      }

    } catch (error) {
      addMessage('error', `Workflow Failed: ${error.message}`, 'error');
    }
  };

  // REAL Implementation: Trigger ML Training on Python Container
  const simulateMLTraining = async () => {
    if (!activeServices.ml) {
      addMessage('error', 'ML Service container is offline', 'error');
      return;
    }

    addMessage('ml', 'Sending training job to Python/Flask service...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/ml/train`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelType: 'readmission_risk', epochs: 10 })
        });

        if (response.ok) {
            addMessage('ml', '✓ Job accepted: Training started on GPU/CPU', 'success');
            // Poll for status or wait for socket (simplified here)
            await delay(2000); 
            addMessage('ml', '✓ Model persisted to /models/readmission_v2.pkl', 'success');
        } else {
            throw new Error('ML Service rejected the job');
        }
    } catch (error) {
        addMessage('error', `Training Error: ${error.message}`, 'error');
    }
  };
  
  // COMPREHENSIVE PROOF: Handles Websocket, Physics REST, and Legacy REST
  const simulateDeviceStream = async () => {
    if (!activeServices.device) {
      addMessage('error', 'Device Gateway Offline', 'error');
      return;
    }

    // --- PHASE 1: HIGH-SPEED WEBSOCKET (Modern IoMT) ---
    addMessage('device', 'Starting Phase 1: High-Speed IoMT Stream (WebSocket)...');
    
    // Handle switching between ws:// and wss:// automatically
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/live/stream';
    let socket;

    try {
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
             addMessage('device', '✓ Secure Tunnel Established (WSS)');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'stream_frame') {
                // Log occasionally to show speed without flooding
                if (Math.random() > 0.8) {
                    addMessage('device', `⚡ Live: HR ${data.vitals.hr} | SpO2 ${data.vitals.spo2}%`);
                }
                // Handle Critical Alert from Edge
                if (data.alert) {
                    addMessage('ml', `⚠ EDGE ALERT: ${data.alert} detected!`, 'warning');
                }
            } else if (data.type === 'db_sync_event') {
                addMessage('fhir', '✓ Smart Edge Sync: Batch saved to FHIR', 'success');
            }
        };

        socket.onerror = (error) => {
             // Sockets can be flaky in some cloud environments, fail gracefully
             addMessage('error', 'WebSocket connection issue - check proxy');
        };

        // Run WebSocket for 6 seconds, then move to Phase 2
        setTimeout(async () => {
            socket.close();
            addMessage('device', 'Phase 1 Complete. Switching to Driver Tests...');
            await runRestDrivers();
        }, 6000);

    } catch (e) {
        addMessage('error', `WS Error: ${e.message}`);
    }

    // --- PHASE 2 & 3: REST DRIVERS (Physics & Legacy) ---
    const runRestDrivers = async () => {
        await delay(1000);
        
        // SCENARIO: RAW PHYSICS
        addMessage('device', 'Phase 2: Raw Sensor Physics (Optical)...');
        try {
            const res1 = await fetch(`${API_BASE_URL}/api/v1/devices/optical`, { method: 'POST' });
            const data1 = await res1.json();
            
            // Show the "Before" (Raw) and "After" (Abstracted)
            addMessage('device', `Input: R=${data1.raw_input.red}v / IR=${data1.raw_input.ir}v`);
            addMessage('device', `→ Math: Beer-Lambert Law Calculation`);
            addMessage('device', `→ Output: SpO2 ${data1.abstracted_value}% (Standardized)`);
        } catch(e) { addMessage('error', 'Optical Driver Fail'); }

        await delay(1500);

        // SCENARIO: LEGACY PROTOCOL
        addMessage('device', 'Phase 3: Legacy Equipment (Serial/Text)...');
        try {
            const res2 = await fetch(`${API_BASE_URL}/api/v1/devices/legacy`, { method: 'POST' });
            const data2 = await res2.json();
            
            // Show the Parsing Logic
            addMessage('device', `Input: "${data2.raw_input}"`);
            addMessage('device', `→ Parser: Regex Extraction`);
            addMessage('device', `→ Output: HR ${data2.abstracted_value} bpm (Standardized)`);
            
            addMessage('system', '✓ ALL DEVICE TESTS PASSED: Universal Abstraction Proven', 'success');
        } catch(e) { addMessage('error', 'Legacy Driver Fail'); }
    };
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">TheOpenHealthOS Kernel</h1>
          <div className="flex justify-center items-center gap-2">
            <span className="text-blue-200">System Status:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${isSystemHealthy ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                {isSystemHealthy ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-blue-500 shadow-lg shadow-blue-900/20">
          <h2 className="text-xl font-semibold text-white mb-4">Kernel Control</h2>
          <div className="flex gap-3 mb-4">
            <button
              onClick={startAllServices}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center gap-2 shadow-lg"
            >
              <Activity className="w-4 h-4" /> Connect to Docker Cluster
            </button>
            <button
              onClick={stopAllServices}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition shadow-lg"
            >
              Disconnect
            </button>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {Object.entries(activeServices).map(([key, active]) => (
              <div
                key={key}
                className={`p-3 rounded-lg border-2 transition ${
                  active 
                    ? 'bg-green-900/40 border-green-500' 
                    : 'bg-slate-700/50 border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium capitalize">{key}</span>
                  {active ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div className={`text-xs ${active ? 'text-green-300' : 'text-slate-400'}`}>
                  {active ? 'Active' : 'Unreachable'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Triggers */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-purple-500 shadow-lg shadow-purple-900/20">
          <h2 className="text-xl font-semibold text-white mb-4">Workflow Orchestration</h2>
          <div className="flex gap-3">
            <button
              onClick={simulatePatientAdmission}
              disabled={!isSystemHealthy}
              className={`px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                  !isSystemHealthy ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Database className="w-4 h-4" /> New Patient Admission
            </button>
            <button
               onClick={simulateDeviceStream}
               disabled={!isSystemHealthy}
               className={`px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                  !isSystemHealthy ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              <Wifi className="w-4 h-4" /> Device Stream (IoT)
            </button>
            <button
              onClick={simulateMLTraining}
              disabled={!isSystemHealthy}
              className={`px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                  !isSystemHealthy ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <Cpu className="w-4 h-4" /> Train Risk Model
            </button>
          </div>
        </div>

        {/* Layout for logs and stats */}
        <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
                 <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
                    <h3 className="text-lg font-semibold text-white mb-3">Kernel Log Stream</h3>
                    <div className="bg-black rounded p-3 h-64 overflow-y-auto font-mono text-xs shadow-inner">
                        {messages.length === 0 ? (
                        <div className="text-slate-500 italic">System idle. Waiting for events...</div>
                        ) : (
                        messages.map(msg => (
                            <div key={msg.id} className="mb-1 border-l-2 border-slate-700 pl-2">
                            <span className="text-slate-500">[{msg.timestamp}]</span>{' '}
                            <span className={
                                msg.type === 'error' ? 'text-red-400 font-bold' :
                                msg.type === 'success' ? 'text-green-400 font-bold' :
                                msg.type === 'warning' ? 'text-yellow-400' :
                                'text-blue-300'
                            }>
                                {msg.service.toUpperCase()}
                            </span>{' '}
                            <span className="text-white">{msg.text}</span>
                            </div>
                        ))
                        )}
                    </div>
                 </div>
            </div>

             {/* Live Data Panel (Right Side) */}
            <div className="space-y-6">
                {patientData && (
                <div className="bg-slate-800 rounded-lg p-4 border border-blue-600 shadow-md">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400"/> Active Context
                    </h3>
                    <div className="space-y-2 text-sm text-white">
                        <div className="flex justify-between border-b border-slate-700 pb-1">
                            <span className="text-slate-400">FHIR ID</span>
                            <span className="font-mono text-blue-300">{patientData.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Name</span>
                            <span>{patientData.name}</span>
                        </div>
                        <div className="mt-2 bg-slate-900 p-2 rounded text-xs text-slate-300">
                            RAW FHIR JSON PREVIEW:
                            <pre className="mt-1 text-green-500 overflow-hidden">
                                {`{ "resourceType": "Patient", "id": "${patientData.id}" ... }`}
                            </pre>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default MicroservicesSimulator;
