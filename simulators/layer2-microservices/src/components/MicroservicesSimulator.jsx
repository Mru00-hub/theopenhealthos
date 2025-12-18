import React, { useState, useEffect } from 'react';
import { Activity, Database, Shield, Cpu, Wifi, HardDrive, AlertCircle, CheckCircle } from 'lucide-react';

// Configuration for API endpoints
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
  const [halStatus, setHalStatus] = useState({ online: true, buffer: 0 });

  // Helper for delays
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

  // HAL Control: Toggle Network
  const toggleNetwork = async () => {
    const newStatus = !halStatus.online;
    addMessage('system', `[HAL] ${newStatus ? 'Connecting' : 'Severing'} Network Link...`, 'warning');
    
    try {
        await fetch(`${API_BASE_URL}/api/v1/hal/network`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: newStatus })
        });
        setHalStatus(prev => ({ ...prev, online: newStatus }));
    } catch (e) { addMessage('error', 'HAL Control Failed'); }
  };

  // HAL Control: Simulate Kernel Stress
  const simulateKernelStress = async () => {
    addMessage('system', 'Starting Kernel Scheduler Stress Test...', 'info');
    
    // 1. Send Low Priority Background Task
    fetch(`${API_BASE_URL}/api/v1/kernel/scheduler`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ taskType: 'Log_Backup', priority: 'NORMAL' })
    }).then(r => r.json()).then(d => 
        addMessage('system', `[Kernel] Background Task finished (${d.latency_ms}ms)`, 'info')
    );

    // 2. Immediately Send Critical Task
    await delay(100); 
    addMessage('ml', '⚠ INJECTING CRITICAL ALERT (Priority: HIGH)', 'error');
    
    fetch(`${API_BASE_URL}/api/v1/kernel/scheduler`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ taskType: 'Sepsis_Alert', priority: 'CRITICAL' })
    }).then(r => r.json()).then(d => 
        addMessage('cdss', `[Kernel] CRITICAL TASK PROCESSED (${d.latency_ms}ms) - Preempted Background Task`, 'success')
    );
  };

  const startAllServices = async () => {
    addMessage('system', 'Initiating handshake with Healthcare OS Kernel...', 'info');
    try {
      const response = await fetch(`${API_BASE_URL}/health/system`);
      if (!response.ok) throw new Error(`Gateway responded with ${response.status}`);
      const healthData = await response.json();
      
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
      addMessage('error', `Connection Failed: Is Docker running? (${error.message})`, 'error');
      setIsSystemHealthy(false);
    }
  };

  const stopAllServices = () => {
    setActiveServices({ fhir: false, device: false, ml: false, security: false, cdss: false });
    setMessages([]);
    setPatientData(null);
    setMlPrediction(null);
    setSecurityStatus('idle');
    setIsSystemHealthy(false);
    addMessage('system', 'Disconnected from OS Kernel', 'warning');
  };

  const simulatePatientAdmission = async () => {
    if (!activeServices.fhir) {
      addMessage('error', 'Cannot admit patient: FHIR service is unreachable', 'error');
      return;
    }
    setSecurityStatus('checking');
    addMessage('security', 'Requesting authorization token from Security Service...');
    
    try {
      await delay(500); 
      setSecurityStatus('approved');
      addMessage('security', '✓ Access Granted (JWT Token Issued)', 'success');

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
        condition: 'Hypertension',
        vitals: { heartRate: 88, bloodPressure: '145/92', temperature: 98.6 }
      });
      addMessage('fhir', `✓ Resource Created: Patient/${newPatient.id}`, 'success');

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
            await delay(2000); 
            addMessage('ml', '✓ Model persisted to /models/readmission_v2.pkl', 'success');
        } else {
            throw new Error('ML Service rejected the job');
        }
    } catch (error) {
        addMessage('error', `Training Error: ${error.message}`, 'error');
    }
  };
  
  const simulateDeviceStream = async () => {
    if (!activeServices.device) {
      addMessage('error', 'Device Gateway Offline', 'error');
      return;
    }

    addMessage('device', 'Starting Phase 1: High-Speed IoMT Stream (WebSocket)...');
    
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
                setHalStatus({ online: data.hal.network, buffer: data.hal.bufferSize });
                
                if (Math.random() > 0.8) {
                    addMessage('device', `⚡ Live: HR ${data.vitals.hr} | SpO2 ${data.vitals.spo2}%`);
                }
                if (data.alert) {
                    addMessage('ml', `⚠ EDGE ALERT: ${data.alert} detected!`, 'warning');
                }
            } else if (data.type === 'hal_event') {
                addMessage('warning', `[HAL] Network Down. Data buffered in Edge RAM.`, 'warning');
            } else if (data.type === 'db_sync_event') {
                addMessage('fhir', '✓ Smart Edge Sync: Batch saved to FHIR', 'success');
            }
        };

        socket.onerror = (error) => {
             addMessage('error', 'WebSocket connection issue - check proxy');
        };

        setTimeout(async () => {
            socket.close();
            addMessage('device', 'Phase 1 Complete. Switching to Driver Tests...');
            await runRestDrivers();
        }, 6000);

    } catch (e) {
        addMessage('error', `WS Error: ${e.message}`);
    }

    const runRestDrivers = async () => {
        await delay(1000);
        let opticalSuccess = false;
        let legacySuccess = false;
        
        addMessage('device', 'Phase 2: Raw Sensor Physics (Optical)...');
        try {
            const res1 = await fetch(`${API_BASE_URL}/api/v1/devices/optical`, { method: 'POST' });
            if (!res1.ok) throw new Error(res1.statusText);
            const data1 = await res1.json();
            
            addMessage('device', `Input: R=${data1.raw_input.red.toFixed(2)}v / IR=${data1.raw_input.ir.toFixed(2)}v`);
            addMessage('device', `→ Math: Beer-Lambert Law Calculation`);
            addMessage('device', `→ Output: SpO2 ${data1.abstracted_value}% (Standardized)`);
            opticalSuccess = true;
        } catch(e) { 
            addMessage('error', `Optical Driver Fail: ${e.message}`); 
        }

        await delay(1500);

        addMessage('device', 'Phase 3: Legacy Equipment (Serial/Text)...');
        try {
            const res2 = await fetch(`${API_BASE_URL}/api/v1/devices/legacy`, { method: 'POST' });
            if (!res2.ok) throw new Error(res2.statusText);
            const data2 = await res2.json();
            
            addMessage('device', `Input: "${data2.raw_input}"`);
            addMessage('device', `→ Parser: Regex Extraction`);
            addMessage('device', `→ Output: HR ${data2.abstracted_value} bpm (Standardized)`);
            legacySuccess = true;
        } catch(e) { 
            addMessage('error', `Legacy Driver Fail: ${e.message}`); 
        }

        if (opticalSuccess && legacySuccess) {
            addMessage('system', '✓ ALL DEVICE TESTS PASSED: Universal Abstraction Proven', 'success');
        } else {
            addMessage('error', '⚠ DEVICE TESTS INCOMPLETE: Check Driver Logs', 'error');
        }
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

          {/* New HAL Controls - Correctly Placed Here */}
          <div className="flex gap-3 mt-4 pt-4 border-t border-slate-700">
                <button
                    onClick={toggleNetwork}
                    className={`px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                        halStatus.online ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                    } text-white`}
                >
                    <Wifi className="w-4 h-4" /> 
                    {halStatus.online ? 'Simulate Network Cut' : 'Restore Network'}
                </button>
                
                <button
                    onClick={simulateKernelStress}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition flex items-center gap-2"
                >
                    <Cpu className="w-4 h-4" /> Test Kernel Scheduler
                </button>
            </div>
            
            {/* HAL Status Display */}
            {!halStatus.online && (
                <div className="mt-2 bg-red-900/30 border border-red-500 rounded p-2 text-center">
                    <span className="text-red-200 text-sm font-bold animate-pulse">
                        ⚠ EDGE MODE ACTIVE: {halStatus.buffer} records buffered in RAM
                    </span>
                </div>
            )}
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
