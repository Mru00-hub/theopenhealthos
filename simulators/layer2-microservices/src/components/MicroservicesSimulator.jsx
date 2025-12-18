import React, { useState, useEffect } from 'react';
import { 
  Activity, Database, Shield, Cpu, Wifi, HardDrive, 
  AlertCircle, CheckCircle, Boxes, Zap, Server, Terminal 
} from 'lucide-react';

// Use localhost for local Docker testing
const API_BASE_URL = 'http://localhost:8000';

const MicroservicesSimulator = () => {
  // --- STATE MANAGEMENT ---
  const [activeServices, setActiveServices] = useState({
    fhir: false, device: false, ml: false, security: false, 
    cdss: false, registry: false, validation: false, llm: false
  });
  
  const [messages, setMessages] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [securityStatus, setSecurityStatus] = useState('idle');
  const [isSystemHealthy, setIsSystemHealthy] = useState(false);
  const [halStatus, setHalStatus] = useState({ online: true, buffer: 0 });
  const [modelRegistry, setModelRegistry] = useState([]);
  const [selectedModel, setSelectedModel] = useState('sepsis-detector');

  // Helper for delays
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Logger
  const addMessage = (service, text, type = 'info') => {
    const msg = {
      id: Date.now() + Math.random(),
      service, text, type,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, msg].slice(-20)); // Increased log buffer
  };

  // --- 1. MODEL REGISTRY SYNC (Plugin Ecosystem) ---
  useEffect(() => {
    if (activeServices.ml) {
      fetch(`${API_BASE_URL}/api/v1/ml/models`)
        .then(r => r.json())
        .then(data => setModelRegistry(Object.entries(data).map(([name, meta]) => ({ name, ...meta }))))
        .catch(() => console.warn("Registry sync pending..."));
    }
  }, [activeServices.ml, messages.length]);

  // --- 2. SYSTEM HANDSHAKE (Infrastructure) ---
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
        cdss: healthData.services.cdss,
        registry: true, validation: true, llm: true
      });

      setIsSystemHealthy(true);
      addMessage('system', '✓ Connection established: Distributed HOS Cluster Online', 'success');
      addMessage('fhir', `✓ CDR Endpoint: ${healthData.endpoints.fhir}`, 'success');
    } catch (error) {
      addMessage('error', `Connection Failed: ${error.message}`, 'error');
      setIsSystemHealthy(false);
    }
  };

  const stopAllServices = () => {
    setActiveServices({ 
      fhir: false, device: false, ml: false, security: false, 
      cdss: false, registry: false, validation: false, llm: false 
    });
    setMessages([]);
    setPatientData(null);
    setSecurityStatus('idle');
    setIsSystemHealthy(false);
    addMessage('system', 'Disconnected from OS Kernel', 'warning');
  };

  // --- 3. PATIENT ADMISSION (Drift Detection + XAI) ---
  const simulatePatientAdmission = async () => {
    if (!activeServices.fhir) return addMessage('error', 'FHIR service unreachable', 'error');
    
    setSecurityStatus('checking');
    addMessage('security', 'Requesting JWT authorization from Security Service...');
    
    try {
      await delay(500); 
      setSecurityStatus('approved');
      addMessage('security', '✓ Access Granted (Token Issued)', 'success');

      // Randomize to test Drift Logic
      const isDriftTest = Math.random() > 0.8;
      const simAge = isDriftTest ? 95 : 65;
      const simBP = isDriftTest ? '185/110' : '145/92';

      addMessage('api-gateway', 'POST /api/v1/patients (Writing to HPS Stack)...');
      const response = await fetch(`${API_BASE_URL}/api/v1/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: [{ family: "Doe", given: ["John"] }], gender: "male", birthDate: isDriftTest ? "1930-01-01" : "1960-01-01" })
      });
      const newPatient = await response.json();
      
      setPatientData({ id: newPatient.id, name: 'John Doe', age: simAge, condition: 'Hypertension', vitals: { heartRate: 88, bloodPressure: simBP } });
      addMessage('fhir', `✓ Resource Created: Patient/${newPatient.id.substring(0,8)}...`, 'success');

      if (activeServices.cdss) {
        addMessage('cdss', 'Invoking Integrated CDSS Evaluation...');
        const cdssRes = await fetch(`${API_BASE_URL}/api/v1/cdss/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                patientId: newPatient.id, 
                requestedModelVersion: 'readmission-v1',
                patientData: { age: simAge, condition: 'Hypertension', vitals: { bloodPressure: simBP } }
            })
        });
        const advice = await cdssRes.json();
        
        if (advice.status === 'critical') {
            addMessage('ml', `🤖 AI Alert: Model detected Data Drift!`, 'warning');
            addMessage('cdss', `🛑 Risk Mitigation: ${advice.recommendation}`, 'error');
        } else {
            addMessage('ml', `🤖 AI Inference (${advice.source.ml_model}): ${advice.recommendation}`, 'success');
            advice.explainability.contributors.forEach(c => addMessage('ml', `   • XAI: ${c.feature} impact ${c.impact} (${c.reason})`));
        }
      }
    } catch (error) { addMessage('error', `Workflow Failed: ${error.message}`, 'error'); }
  };

  // --- 4. DEVICE STREAMING (WebSocket + REST Drivers Physics) ---
  const simulateDeviceStream = async () => {
    if (!activeServices.device) return addMessage('error', 'Device Gateway Offline', 'error');

    // Phase 1: WebSocket
    addMessage('device', 'Phase 1: High-Speed IoMT Stream (WebSocket)...');
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/live/stream';
    let socket;

    try {
        socket = new WebSocket(wsUrl);
        socket.onopen = () => addMessage('device', '✓ Secure Tunnel Established (WSS)');
        
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'stream_frame') {
                setHalStatus({ online: data.hal.network, buffer: data.hal.bufferSize });
                if (Math.random() > 0.8) addMessage('device', `⚡ Live: HR ${data.vitals.hr} | SpO2 ${data.vitals.spo2}%`);
            } else if (data.type === 'hal_event') {
                addMessage('warning', '[HAL] Network Down. Buffering at Edge.', 'warning');
            } else if (data.type === 'db_sync_event') {
                addMessage('fhir', '✓ Edge Buffer Flushed to FHIR', 'success');
            }
        };

        // Transition to Phase 2 after 5 seconds
        setTimeout(async () => {
            socket.close();
            addMessage('device', 'Phase 1 Complete. Switching to REST Driver Tests...');
            await runRestDrivers();
        }, 5000);

    } catch (e) { addMessage('error', 'WebSocket Failure'); }

    // Phase 2 & 3: Physics Drivers (From Original Code)
    const runRestDrivers = async () => {
        await delay(500);
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
        } catch(e) { addMessage('error', `Optical Driver Fail: ${e.message}`); }

        await delay(1000);

        addMessage('device', 'Phase 3: Legacy Equipment (Serial/Text)...');
        try {
            const res2 = await fetch(`${API_BASE_URL}/api/v1/devices/legacy`, { method: 'POST' });
            if (!res2.ok) throw new Error(res2.statusText);
            const data2 = await res2.json();
            
            addMessage('device', `Input: "${data2.raw_input}"`);
            addMessage('device', `→ Parser: Regex Extraction`);
            addMessage('device', `→ Output: HR ${data2.abstracted_value} bpm (Standardized)`);
            legacySuccess = true;
        } catch(e) { addMessage('error', `Legacy Driver Fail: ${e.message}`); }

        if (opticalSuccess && legacySuccess) {
            addMessage('system', '✓ ALL DEVICE TESTS PASSED: Universal Abstraction Proven', 'success');
        }
    };
  };

  // --- 5. MLOps LIFECYCLE ---
  const simulateMLTraining = async () => {
    addMessage('ml', `Initiating MLOps Pipeline for: ${selectedModel}...`);
    try {
        // Send the USER SELECTED model to the backend
        const response = await fetch(`${API_BASE_URL}/api/v1/ml/train`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelType: selectedModel })
        });
        const data = await response.json();
        
        addMessage('ml', `✓ Training complete: ${selectedModel} (GPU Cluster)`, 'success');
        addMessage('registry', `✓ Registered Plugin: ${data.validation_report.model_id}`);
        
        if (data.validation_report.approved) {
             addMessage('validation', `✓ Safety Gate PASSED. ${selectedModel} is live.`);
        } else {
             addMessage('validation', `X Safety Gate REJECTED. ${selectedModel} blocked.`, 'error');
        }
    } catch (e) { addMessage('error', 'Pipeline Failed'); }
  };

  // --- 6. A/B MODEL COMPARISON ---
  const compareModelVersions = async () => {
    if (!patientData) return addMessage('error', 'Need patient context for A/B Test', 'warning');
    addMessage('cdss', 'Running A/B Test: readmission-v1 vs sepsis-v2...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/cdss/compare-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientData: patientData, versions: ['readmission-v1', 'sepsis-v2'] })
      });
      const data = await response.json();
      addMessage('cdss', `v1: ${data.comparison[0].recommendation} (Risk: ${data.comparison[0].risk_score}%)`, 'info');
      addMessage('cdss', `v2: ${data.comparison[1].recommendation} (Risk: ${data.comparison[1].risk_score}%)`, 'warning');
    } catch (e) { addMessage('error', 'Comparison Failed'); }
  };

  // --- 7. AGENTIC AI WORKFLOW ---
  const runAgenticWorkflow = async () => {
    if (!isSystemHealthy) return;
    addMessage('agent', '🤖 Agentic Orchestrator: Multi-step clinical workflow initiated');
    addMessage('agent', 'Step 1: Gathering context from HPS (FHIR/DICOM/HL7)...');
    await delay(800);
    addMessage('agent', 'Step 2: Risk assessment via Distributed ML Registry...');
    await delay(600);
    addMessage('agent', 'Step 3: GenAI reasoning for autonomous care plan...');
    await delay(700);
    addMessage('cdss', 'Step 4: CDSS executing recommendations', 'success');
    addMessage('agent', '✓ Autonomous workflow complete: CDR updated', 'success');
  };

  // --- 8. HAL & KERNEL CONTROLS ---
  const toggleNetwork = async () => {
    const newStatus = !halStatus.online;
    try {
        await fetch(`${API_BASE_URL}/api/v1/hal/network`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ status: newStatus }) 
        });
        setHalStatus(prev => ({ ...prev, online: newStatus }));
        addMessage('system', `[HAL] Network Link ${newStatus ? 'RESTORED' : 'SEVERED'}`, 'warning');
    } catch (e) { addMessage('error', 'HAL Toggle Failed'); }
  };

  const simulateKernelStress = async () => {
    addMessage('system', 'Starting Kernel Scheduler Priority Test...', 'info');
    // Low Priority
    fetch(`${API_BASE_URL}/api/v1/kernel/scheduler`, { 
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ taskType: 'Log_Backup', priority: 'NORMAL' }) 
    }).then(r => r.json()).then(d => addMessage('system', `[Kernel] Log Backup finished (${d.latency_ms}ms)`, 'info'));

    await delay(100); 
    addMessage('ml', '⚠ INJECTING CRITICAL SEPSIS ALERT', 'error');
    
    // High Priority
    fetch(`${API_BASE_URL}/api/v1/kernel/scheduler`, { 
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ taskType: 'Sepsis_Alert', priority: 'CRITICAL' }) 
    }).then(r => r.json()).then(d => addMessage('cdss', `[Kernel] CRITICAL TASK PREEMPTED OTHERS (${d.latency_ms}ms)`, 'success'));
  };

  // --- RENDER ---
  return (
    <div className="w-full h-screen bg-slate-900 p-6 overflow-auto text-white">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2 tracking-tight">TheOpenHealthOS Kernel</h1>
          <div className={`inline-block px-3 py-1 rounded text-xs font-bold ${isSystemHealthy ? 'bg-green-600' : 'bg-red-600'}`}>
            SYSTEM {isSystemHealthy ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>

        {/* Top Grid: Infrastructure */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* 1. Core Cluster Control */}
          <div className="bg-slate-800 p-4 rounded-lg border border-blue-500/30">
            <h3 className="text-blue-400 text-xs font-bold mb-3 flex items-center gap-2 uppercase tracking-widest"><Activity size={16}/> Core Cluster</h3>
            <button onClick={startAllServices} className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold mb-2 transition text-sm">Connect Cluster</button>
            <button onClick={stopAllServices} className="w-full py-2 bg-slate-700 hover:bg-red-900 rounded text-[10px] transition">Disconnect</button>
            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between text-[10px] uppercase text-slate-500">
                <span>Security</span>
                <span className={securityStatus === 'approved' ? 'text-green-400' : 'text-yellow-500'}>{securityStatus}</span>
            </div>
          </div>

          {/* 2. Platform Registry List */}
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 overflow-y-auto h-40">
            <h3 className="text-slate-400 text-[10px] font-bold mb-2 uppercase tracking-widest flex items-center gap-2"><Server size={14}/> Platform Registry</h3>
            {modelRegistry.length > 0 ? modelRegistry.map(m => (
              <div key={m.name} className="flex justify-between text-[9px] py-1 border-b border-slate-700/50">
                <span className="text-slate-300">{m.name}</span>
                <span className={`px-1 rounded ${m.status === 'production' ? 'text-green-400' : 'text-yellow-400'}`}>{m.status}</span>
              </div>
            )) : <div className="text-slate-600 text-[10px] italic py-4">Registry empty (Connect first)...</div>}
          </div>
          
          {/* 3. Microservices Status */}
          <div className="col-span-2 bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="text-slate-400 text-[10px] font-bold mb-3 uppercase tracking-widest">Microservices Mesh</h3>
            <div className="grid grid-cols-4 gap-3">
              {['fhir', 'registry', 'validation', 'llm'].map(s => (
                <div key={s} className={`p-2 rounded border ${activeServices[s] ? 'border-green-500 bg-green-900/20' : 'border-slate-700 bg-slate-900/50'}`}>
                  <div className="flex justify-between items-center capitalize">
                    <span className="text-[10px] font-bold">{s}</span>
                    {activeServices[s] ? <CheckCircle size={12} className="text-green-400"/> : <AlertCircle size={12} className="text-slate-500"/>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Grid: Orchestration Engine */}
        <div className="bg-slate-800 p-6 rounded-lg border border-purple-500/40 shadow-xl mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-purple-400"><Cpu/> Orchestration Engine</h2>
            {!halStatus.online && <div className="text-orange-400 animate-pulse text-xs font-mono border border-orange-500 px-2 py-1 rounded">⚠ HAL EDGE MODE: {halStatus.buffer} Buffered</div>}
          </div>
          
          <div className="grid grid-cols-5 gap-4">
            <button onClick={simulatePatientAdmission} disabled={!isSystemHealthy} className="px-4 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold flex flex-col items-center gap-2 transition disabled:opacity-30">
              <Database size={24}/> <span className="text-[10px] uppercase">Admission</span>
            </button>
            <button onClick={simulateDeviceStream} disabled={!isSystemHealthy} className="px-4 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold flex flex-col items-center gap-2 transition disabled:opacity-30">
              <Wifi size={24}/> <span className="text-[10px] uppercase">IoMT (HAL)</span>
            </button>
            <div className="flex flex-col gap-1">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!isSystemHealthy}
                className="bg-slate-900 border border-purple-500/50 text-[10px] rounded px-2 py-1 text-center outline-none focus:border-purple-400"
              >
                <option value="sepsis-detector">Sepsis (LSTM)</option>
                <option value="diabetes-risk">Diabetes (XGB)</option>
                <option value="chest-xray-v2">Pneumonia (CNN)</option>
                <option value="readmission-v2">Readmit v2 (RF)</option>
              </select>
              <button onClick={simulateMLTraining} disabled={!isSystemHealthy} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-bold flex flex-col items-center gap-1 transition disabled:opacity-30 flex-1">
                <Cpu size={20}/> <span className="text-[10px] uppercase">Train Plugin</span>
              </button>
            </div>
            <button onClick={compareModelVersions} disabled={!patientData} className="px-4 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold flex flex-col items-center gap-2 transition disabled:opacity-30">
              <Boxes size={24}/> <span className="text-[10px] uppercase">A/B Compare</span>
            </button>
            <button onClick={runAgenticWorkflow} disabled={!isSystemHealthy} className="px-4 py-4 bg-pink-600 hover:bg-pink-500 rounded-lg font-bold flex flex-col items-center gap-2 transition disabled:opacity-30 border-2 border-pink-400/50">
              <Zap size={24}/> <span className="text-[10px] uppercase font-black">Agentic AI</span>
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 flex gap-4">
            <button onClick={toggleNetwork} className={`flex-1 py-2 rounded font-bold text-xs transition ${halStatus.online ? 'border border-red-500 text-red-400 hover:bg-red-900/20' : 'bg-green-600 text-white'}`}>
                {halStatus.online ? 'Sever Network Link (Simulate Outage)' : 'Restore Network Connection'}
            </button>
            <button onClick={simulateKernelStress} disabled={!isSystemHealthy} className="flex-1 py-2 border border-blue-500 text-blue-400 hover:bg-blue-900/20 rounded font-bold text-xs transition">
                Execute Kernel Scheduler Stress Test (QoS)
            </button>
          </div>
        </div>

        {/* Bottom Grid: Logs & Context */}
        <div className="grid grid-cols-3 gap-6 h-96">
          {/* Logs */}
          <div className="col-span-2 bg-black rounded-lg border border-slate-700 p-4 font-mono text-[10px] overflow-hidden flex flex-col">
            <div className="text-slate-500 mb-2 border-b border-slate-800 pb-1 flex justify-between items-center">
                <span className="flex items-center gap-2"><Terminal size={12}/> KERNEL SYSTEM LOGS</span>
                <span className="text-xs">FHIR R4 / Docker v24.0</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {messages.map(m => (
                <div key={m.id} className="flex gap-2">
                  <span className="text-slate-600 min-w-[60px]">[{m.timestamp}]</span>
                  <span className={`font-bold uppercase min-w-[70px] ${m.type === 'error' ? 'text-red-500' : m.type === 'success' ? 'text-green-500' : 'text-yellow-500'}`}>{m.service}:</span>
                  <span className="text-slate-200">{m.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Context */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-hidden">
            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><Shield size={14}/> Active CDR Context</h3>
            {patientData ? (
              <div className="space-y-4">
                <div className="p-3 bg-slate-900 rounded border-l-4 border-blue-500">
                  <div className="text-[10px] text-slate-500 uppercase">Patient Profile</div>
                  <div className="font-bold text-lg">{patientData.name}</div>
                  <div className="text-xs text-slate-400">Age: {patientData.age} | BP: {patientData.vitals.bloodPressure}</div>
                </div>
                <div className="text-[9px] text-green-500 font-mono bg-black p-3 rounded border border-green-900/50">
                    <div className="text-slate-500 mb-2">// RAW FHIR JSON</div>
                    {`{`}
                    <div className="pl-4">"resourceType": "Patient",</div>
                    <div className="pl-4">"id": "${patientData.id.substring(0,8)}...",</div>
                    <div className="pl-4">"risk_eval": "drift_check_complete"</div>
                    {`}`}
                </div>
              </div>
            ) : (
              <div className="text-slate-500 italic text-[10px] text-center py-24 border-2 border-dashed border-slate-700 rounded-lg">
                Waiting for Admission...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MicroservicesSimulator;
