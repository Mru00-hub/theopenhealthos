import React, { useState, useEffect } from 'react';
import { Activity, Database, Shield, Cpu, Wifi, HardDrive, AlertCircle, CheckCircle, Clock } from 'lucide-react';

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

  // Start all services
  const startAllServices = () => {
    setActiveServices({
      fhir: true,
      device: true,
      ml: true,
      security: true,
      cdss: true
    });
    addMessage('system', 'All services started successfully');
  };

  // Stop all services
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
  };

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

  // Simulate patient admission flow
  const simulatePatientAdmission = async () => {
    if (!activeServices.fhir) {
      addMessage('error', 'FHIR service not running', 'error');
      return;
    }

    // Security check
    setSecurityStatus('checking');
    addMessage('security', 'Validating access permissions...');
    await delay(800);
    setSecurityStatus('approved');
    addMessage('security', 'Access granted - HIPAA compliant', 'success');
    
    // Generate patient data
    await delay(500);
    const patient = {
      id: 'PT-' + Math.floor(Math.random() * 10000),
      name: 'John Doe',
      age: 45,
      condition: 'Hypertension',
      vitals: {
        heartRate: 88,
        bloodPressure: '145/92',
        temperature: 98.6
      }
    };
    setPatientData(patient);
    addMessage('fhir', `Patient record created: ${patient.id}`, 'success');

    // Device data
    if (activeServices.device) {
      await delay(600);
      addMessage('device', `Vital signs received: HR ${patient.vitals.heartRate}, BP ${patient.vitals.bloodPressure}`);
    }

    // ML prediction
    if (activeServices.ml) {
      await delay(900);
      const prediction = {
        riskScore: Math.floor(Math.random() * 40) + 30,
        recommendation: 'Monitor blood pressure, consider medication adjustment'
      };
      setMlPrediction(prediction);
      addMessage('ml', `Risk analysis complete: ${prediction.riskScore}% cardiovascular risk`, 'warning');
    }

    // CDSS recommendation
    if (activeServices.cdss) {
      await delay(700);
      addMessage('cdss', 'Clinical decision support: Recommend ACE inhibitor dosage review', 'info');
    }
  };

  // Simulate device data stream
  const simulateDeviceStream = async () => {
    if (!activeServices.device) {
      addMessage('error', 'Device service not running', 'error');
      return;
    }

    addMessage('device', 'Starting continuous monitoring stream...');
    
    for (let i = 0; i < 3; i++) {
      await delay(1200);
      const hr = 75 + Math.floor(Math.random() * 20);
      const spo2 = 95 + Math.floor(Math.random() * 5);
      addMessage('device', `Real-time vitals: HR ${hr} bpm, SpO2 ${spo2}%`);
      
      if (activeServices.ml && hr > 90) {
        await delay(400);
        addMessage('ml', 'Alert: Elevated heart rate detected', 'warning');
      }
    }
  };

  // Simulate ML model training
  const simulateMLTraining = async () => {
    if (!activeServices.ml) {
      addMessage('error', 'ML service not running', 'error');
      return;
    }

    addMessage('ml', 'Starting model training pipeline...');
    await delay(1000);
    addMessage('ml', 'Loading training dataset (10,000 records)...');
    await delay(1500);
    addMessage('ml', 'Training XGBoost model for readmission prediction...');
    await delay(2000);
    addMessage('ml', 'Model validation: 89.2% accuracy, 0.85 AUC', 'success');
    await delay(800);
    addMessage('ml', 'Model deployed to production endpoint', 'success');
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Healthcare OS Microservices Simulator</h1>
          <p className="text-blue-200">Layer 2: Real-time Service Orchestration & Data Flow</p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-blue-500">
          <h2 className="text-xl font-semibold text-white mb-4">Service Control Panel</h2>
          <div className="flex gap-3 mb-4">
            <button
              onClick={startAllServices}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
            >
              Start All Services
            </button>
            <button
              onClick={stopAllServices}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
            >
              Stop All Services
            </button>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {Object.entries(activeServices).map(([key, active]) => (
              <div
                key={key}
                className={`p-3 rounded-lg border-2 transition ${
                  active 
                    ? 'bg-green-900 border-green-500' 
                    : 'bg-slate-700 border-slate-600'
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
                  {active ? 'Running' : 'Stopped'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Triggers */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-purple-500">
          <h2 className="text-xl font-semibold text-white mb-4">Workflow Simulations</h2>
          <div className="flex gap-3">
            <button
              onClick={simulatePatientAdmission}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              Patient Admission Flow
            </button>
            <button
              onClick={simulateDeviceStream}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
            >
              Device Data Stream
            </button>
            <button
              onClick={simulateMLTraining}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition"
            >
              ML Model Training
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Service Architecture */}
          <div className="col-span-2">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Service Architecture</h3>
              
              <div className="space-y-4">
                {/* Application Layer */}
                <div className="bg-blue-900 bg-opacity-30 rounded p-3 border border-blue-600">
                  <div className="text-blue-300 text-sm font-semibold mb-2">Application Layer</div>
                  <div className="flex gap-2">
                    <div className="bg-slate-700 px-3 py-1 rounded text-xs text-white">EMR/CDSS</div>
                    <div className="bg-slate-700 px-3 py-1 rounded text-xs text-white">Analytics</div>
                    <div className="bg-slate-700 px-3 py-1 rounded text-xs text-white">Device Apps</div>
                  </div>
                </div>

                {/* Core Services */}
                <div className="bg-purple-900 bg-opacity-30 rounded p-3 border border-purple-600">
                  <div className="text-purple-300 text-sm font-semibold mb-2">Core Services Layer</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-700 p-2 rounded">
                      <Database className="w-4 h-4 text-blue-400 mb-1" />
                      <div className="text-xs text-white">FHIR Server</div>
                      <div className="text-xs text-slate-400">Port: 8080</div>
                    </div>
                    <div className="bg-slate-700 p-2 rounded">
                      <Shield className="w-4 h-4 text-green-400 mb-1" />
                      <div className="text-xs text-white">Security</div>
                      <div className="text-xs text-slate-400">OAuth2/HIPAA</div>
                    </div>
                    <div className="bg-slate-700 p-2 rounded">
                      <Cpu className="w-4 h-4 text-orange-400 mb-1" />
                      <div className="text-xs text-white">ML Service</div>
                      <div className="text-xs text-slate-400">Port: 5000</div>
                    </div>
                  </div>
                </div>

                {/* Device Layer */}
                <div className="bg-green-900 bg-opacity-30 rounded p-3 border border-green-600">
                  <div className="text-green-300 text-sm font-semibold mb-2">Device Abstraction Layer</div>
                  <div className="flex gap-2">
                    <div className="bg-slate-700 px-3 py-1 rounded text-xs text-white">HL7 Gateway</div>
                    <div className="bg-slate-700 px-3 py-1 rounded text-xs text-white">DICOM Adapter</div>
                    <div className="bg-slate-700 px-3 py-1 rounded text-xs text-white">IoMT Bridge</div>
                  </div>
                </div>

                {/* Infrastructure */}
                <div className="bg-slate-900 bg-opacity-50 rounded p-3 border border-slate-500">
                  <div className="text-slate-300 text-sm font-semibold mb-2">Infrastructure</div>
                  <div className="flex gap-2">
                    <HardDrive className="w-4 h-4 text-slate-400" />
                    <Wifi className="w-4 h-4 text-slate-400" />
                    <Activity className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* System Logs */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-3">System Logs</h3>
              <div className="bg-black rounded p-3 h-64 overflow-y-auto font-mono text-xs">
                {messages.length === 0 ? (
                  <div className="text-slate-500">Waiting for activity...</div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className="mb-1">
                      <span className="text-slate-500">[{msg.timestamp}]</span>{' '}
                      <span className={
                        msg.type === 'error' ? 'text-red-400' :
                        msg.type === 'success' ? 'text-green-400' :
                        msg.type === 'warning' ? 'text-yellow-400' :
                        'text-blue-300'
                      }>
                        [{msg.service.toUpperCase()}]
                      </span>{' '}
                      <span className="text-white">{msg.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Live Data Panel */}
          <div className="space-y-6">
            {/* Security Status */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-3">Security Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Access Control</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    securityStatus === 'approved' ? 'bg-green-900 text-green-300' :
                    securityStatus === 'checking' ? 'bg-yellow-900 text-yellow-300' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {securityStatus === 'approved' ? 'Approved' :
                     securityStatus === 'checking' ? 'Checking...' :
                     'Idle'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">HIPAA Compliance</span>
                  <span className="px-2 py-1 rounded text-xs bg-green-900 text-green-300">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Audit Logging</span>
                  <span className="px-2 py-1 rounded text-xs bg-green-900 text-green-300">Enabled</span>
                </div>
              </div>
            </div>

            {/* Patient Data */}
            {patientData && (
              <div className="bg-slate-800 rounded-lg p-4 border border-blue-600">
                <h3 className="text-lg font-semibold text-white mb-3">Active Patient</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">ID:</span>
                    <span className="text-white font-mono">{patientData.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Name:</span>
                    <span className="text-white">{patientData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Age:</span>
                    <span className="text-white">{patientData.age}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Condition:</span>
                    <span className="text-white">{patientData.condition}</span>
                  </div>
                  <div className="border-t border-slate-600 pt-2 mt-2">
                    <div className="text-slate-400 text-xs mb-1">Vitals:</div>
                    <div className="text-white text-xs">HR: {patientData.vitals.heartRate}</div>
                    <div className="text-white text-xs">BP: {patientData.vitals.bloodPressure}</div>
                    <div className="text-white text-xs">Temp: {patientData.vitals.temperature}°F</div>
                  </div>
                </div>
              </div>
            )}

            {/* ML Predictions */}
            {mlPrediction && (
              <div className="bg-slate-800 rounded-lg p-4 border border-orange-600">
                <h3 className="text-lg font-semibold text-white mb-3">ML Analysis</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-slate-300 text-sm mb-1">Risk Score</div>
                    <div className="bg-slate-700 rounded-full h-4 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-yellow-500 to-orange-500 h-full transition-all duration-1000"
                        style={{ width: `${mlPrediction.riskScore}%` }}
                      />
                    </div>
                    <div className="text-orange-300 text-lg font-bold mt-1">{mlPrediction.riskScore}%</div>
                  </div>
                  <div>
                    <div className="text-slate-300 text-sm mb-1">Recommendation</div>
                    <div className="text-white text-xs">{mlPrediction.recommendation}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Service Stats */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-3">System Metrics</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">API Calls</span>
                  <span className="text-green-400">{messages.length * 3}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Avg Response</span>
                  <span className="text-blue-400">142ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Uptime</span>
                  <span className="text-white">99.8%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MicroservicesSimulator;
