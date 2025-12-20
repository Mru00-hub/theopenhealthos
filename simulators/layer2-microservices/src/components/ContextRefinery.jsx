import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Database, GitMerge, Shield, Server, UserCheck, Microscope, FileImage, Cpu, FileText } from 'lucide-react';
import _ from 'lodash';

// --- CONFIGURATION ---
const BASE_URL = "https://didactic-broccoli-wrx56qq7467jc579j"; // Replace if your Codespace ID changes

const API = {
  // === LAYER 4a: INGESTION ADAPTERS ===
  ADAPTER_HL7:       `${BASE_URL}-3001.app.github.dev/ingest`,
  ADAPTER_GENOMICS:  `${BASE_URL}-3002.app.github.dev/ingest`,
  ADAPTER_PATHOLOGY: `${BASE_URL}-3003.app.github.dev/ingest`,
  ADAPTER_SDOH:      `${BASE_URL}-3004.app.github.dev/ingest`,
  ADAPTER_RESEARCH:  `${BASE_URL}-3005.app.github.dev/ingest`,
  ADAPTER_DICOM:     `${BASE_URL}-3006.app.github.dev/ingest`,

  // === LAYER 4b: SEMANTIC FABRIC ===
  ALIGNER:           `${BASE_URL}-3015.app.github.dev/align`,

  // === LAYER 4c: CANONICAL MAPPER ===
  CANONICAL:         `${BASE_URL}-3016.app.github.dev/convert`,
  
  // === LAYER 5: GOVERNANCE ===
  PCRM:              `${BASE_URL}-3020.app.github.dev/check-access`,
  RCF:               `${BASE_URL}-3021.app.github.dev/check-consent`,
  SAS:               `${BASE_URL}-3022.app.github.dev/audit`,
  
  // === LAYER 6: CONTEXT AWARENESS ===
  CONTEXT_ENGINE:    `${BASE_URL}-4000.app.github.dev/context`
};

// --- RAW INPUTS (Real Data formats for your Transformers) ---
const RAW_SOURCES = {
  // 1. HL7: Must be a multi-segment string so 'transform' finds PID and OBX
  HL7: `MSH|^~\\&|HOS|Lab|EHR|Main|20251220|123|ORU^R01|MSG001|P|2.3
PID|||1001||Doe^John||19800101|M
PV1||I|ICU^^Bed1
OBX|1|NM|8867-4^Heart Rate||82|bpm||||F`,

  // 2. GENOMICS: Raw VCF String (Text)
  GENOMICS: `##fileformat=VCFv4.2
#CHROM POS ID REF ALT QUAL FILTER INFO
chr17 41245466 . G A . . gene=BRCA1`,

  // 3. PATHOLOGY: JSON Metadata
  PATHOLOGY: { 
    slideId: "SLIDE-2025-001", 
    stain: "H&E", 
    bodySite: "Breast",
    magnification: 40 
  },

  // 4. SDOH: JSON Survey
  SDOH: { 
    housing_status: "unstable", 
    food_security: "insecure", 
    transportation: "none" 
  },

  // 5. RESEARCH: JSON Subject Data
  // Note: Matches your Research Adapter 'transformSubject' expectation
  RESEARCH: { 
    protocol_id: "ONCO-2025-001", 
    status: "enrolled", 
    arm_group: "Experimental" 
  },

  // 6. DICOM: JSON Tags
  DICOM: { 
    patientId: "1001", 
    modality: "MR", 
    studyDescription: "Brain MRI - T1", 
    instanceCount: 150 
  }
};

const ContextRefinery = () => {
  const [switches, setSwitches] = useState({
    // Zone A
    source_hl7: false,
    source_genomics: false,
    source_pathology: false,
    source_sdoh: false,
    source_research: false,
    source_dicom: false,
    // Zone B
    layer_aligner: false,
    layer_pcrm: false,
    layer_rcf: false,
    layer_sas: false,
    layer_canonical: false,
    layer_context: false
  });

  const [role, setRole] = useState('CLINICIAN'); 
  const [displayData, setDisplayData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null); 

  const addLog = (msg) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 5));

  useEffect(() => {
    processPipeline();
  }, [switches, role]);

  const processPipeline = async () => {
    setLoading(true);
    let bundle = { resourceType: "Bundle", entry: [] };

    try {
            // 1. INGESTION (Zone A) - REAL NETWORK CALLS
      // We send RAW data to the adapters. They must return FHIR.
      const ingestionPromises = [];

      if (switches.source_hl7) {
        ingestionPromises.push(
          axios.post(API.ADAPTER_HL7, RAW_SOURCES.HL7, { headers: { 'Content-Type': 'text/plain' } })
            .then(res => ({ type: 'HL7', resource: res.data }))
            .catch(e => { addLog("❌ HL7 Adapter Offline"); return null; })
        );
      }
      if (switches.source_genomics) {
        ingestionPromises.push(
          axios.post(API.ADAPTER_GENOMICS, RAW_SOURCES.GENOMICS, { headers: { 'Content-Type': 'text/plain' } })
            .then(res => ({ type: 'Genomics', resource: res.data }))
            .catch(e => { addLog("❌ Genomics Adapter Offline"); return null; })
        );
      }
      if (switches.source_pathology) {
        ingestionPromises.push(
          axios.post(API.ADAPTER_PATHOLOGY, RAW_SOURCES.PATHOLOGY)
            .then(res => ({ type: 'Pathology', resource: res.data }))
            .catch(e => { addLog("❌ Pathology Adapter Offline"); return null; })
        );
      }
      if (switches.source_sdoh) {
        ingestionPromises.push(
          axios.post(API.ADAPTER_SDOH, RAW_SOURCES.SDOH)
            .then(res => ({ type: 'SDOH', resource: res.data }))
            .catch(e => { addLog("❌ SDOH Adapter Offline"); return null; })
        );
      }
      if (switches.source_research) {
        ingestionPromises.push(
          axios.post(`${API.ADAPTER_RESEARCH}/subject`, RAW_SOURCES.RESEARCH) 
            .then(res => ({ type: 'Research', resource: res.data }))
            .catch(e => { addLog("❌ Research Adapter Offline"); return null; })
        );
      }
      if (switches.source_dicom) {
        ingestionPromises.push(
          axios.post(API.ADAPTER_DICOM, RAW_SOURCES.DICOM)
            .then(res => ({ type: 'DICOM', resource: res.data }))
            .catch(e => { addLog("❌ DICOM Adapter Offline"); return null; })
        );
      }

      // Wait for all adapters to respond
      const results = await Promise.all(ingestionPromises);
      
      // Only add successfully fetched resources to the bundle
      results.forEach(res => {
        if (res && res.resource) {
           const data = res.resource;
           
           // If the adapter returned a Bundle, extract its contents
           if (data.resourceType === 'Bundle' && data.entry) {
               data.entry.forEach(e => {
                   // Push the INNER resource, not the wrapper
                   if (e.resource) bundle.entry.push({ resource: e.resource });
               });
           } else {
               // It's already a single resource (Genomics/DICOM)
               bundle.entry.push({ resource: data });
           }
        }
      });
      
      if (bundle.entry.length === 0) {
        // If no adapters responded (or all switches off)
        setDisplayData(null);
        setLoading(false);
        return;
      }

      // 2. SEMANTIC ALIGNER
      if (switches.layer_aligner) {
        try {
          const res = await axios.post(API.ALIGNER, bundle);
          bundle = res.data;
          addLog("✅ Aligner: Standardized Codes (LOINC/SNOMED).");
        } catch (e) {
          addLog("❌ Aligner Offline (Port 3015).");
        }
      }

      // 3. GOVERNANCE TRIAD (Layer 5)
      
      // A. PCRM (Policy)
      if (switches.layer_pcrm) {
        try {
            await axios.post(API.PCRM, { role, resource: 'Bundle' });
            if (role === 'RESEARCHER') {
                addLog("🛡️ PCRM: Enforcing 'Least Privilege' (Redacting PII)...");
                bundle.entry = bundle.entry.map(e => {
                    if (e.resource.resourceType === 'MolecularSequence') {
                        e.resource.variant = [{ observedAllele: "REDACTED_POLICY_101" }];
                    }
                    return e;
                });
            }
        } catch(e) { addLog("⚠️ PCRM Service Unreachable"); }
      }

      // B. RCF (Consent)
      if (switches.layer_rcf && role === 'RESEARCHER') {
        try {
            const consentRes = await axios.post(API.RCF, { patientId: '1001', studyId: 'RES-001' });
            if (consentRes.data.consented === false) {
                addLog("⛔ RCF: Patient OPTED OUT of Research. Blocking Data.");
                setDisplayData({ type: 'BLOCKED', reason: "Consent Revoked (RCF)" });
                setLoading(false);
                return;
            } else {
                addLog("✅ RCF: Research Consent Verified.");
            }
        } catch(e) { addLog("⚠️ RCF Service Unreachable"); }
      }

      // C. SAS (Audit)
      if (switches.layer_sas) {
        axios.post(API.SAS, { 
            timestamp: new Date(), 
            user: role, 
            action: 'VIEW_PIPELINE', 
            records: bundle.entry.length 
        }).then(() => addLog("ea SAS: Immutable Audit Log Written."));
      }

      // 4. OUTPUT BRANCH
      if (switches.layer_canonical) {
        try {
          // REAL NETWORK CALL: If Port 3016 is down, this throws.
          const res = await axios.post(API.CANONICAL, bundle);
          
          setDisplayData({ type: 'OMOP', content: res.data.cdm }); 
          addLog("✅ Canonical: Generated OMOP Tables.");
        } catch (e) {
          addLog("❌ CRTICAL: Mapper Service Offline (Port 3016).");
          // FORCE ERROR UI: Prove that we need the backend
          setDisplayData({ 
              type: 'ERROR', 
              message: "Connection Failed: Canonical Mapper (Port 3016) is unreachable. Cannot generate OMOP CDM." 
          });
          setLoading(false);
          return; // Stop the pipeline. Do not fall back to FHIR.
        }
      } else if (switches.layer_context) {
        try {
          // ✅ UPDATED: Pass Headers for Role-Based Redaction
          const res = await axios.get(`${API.CONTEXT_ENGINE}/1001`, {
             headers: { 'X-User-Role': role }
          });
          
          setDisplayData({ type: 'CONTEXT', content: res.data, liveData: bundle });
          addLog("👑 Context Engine: Golden Record Built.");
        } catch (e) {
           addLog("❌ Context Engine Offline (Port 4000).");
        }
      } else {
        setDisplayData({ type: 'FHIR', content: bundle });
      }

    } catch (error) {
      console.error(error);
      addLog("⚠️ Pipeline Error");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key) => {
    setSwitches(prev => ({ ...prev, [key]: !prev[key] }));
    // If turning ON a source, select it for viewing
    if (key.startsWith('source_')) {
        const sourceName = key.replace('source_', '').toUpperCase();
        setSelectedSource(sourceName);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <header className="mb-6 border-b border-slate-700 pb-4 flex justify-between items-end">
        <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            OpenHealthOS: Context Refinery
            </h1>
            <p className="text-slate-400 text-sm mt-1">
            Multi-Modal Data Orchestration (Layers 4-6)
            </p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded border border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold px-2">User Role:</span>
            <button onClick={() => setRole('CLINICIAN')} className={`px-2 py-1 rounded text-xs font-bold ${role === 'CLINICIAN' ? 'bg-blue-600' : 'text-slate-500'}`}>Clinician</button>
            <button onClick={() => setRole('RESEARCHER')} className={`px-2 py-1 rounded text-xs font-bold ${role === 'RESEARCHER' ? 'bg-purple-600' : 'text-slate-500'}`}>Researcher</button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6 h-[85vh]">
        
        {/* ================= ZONE A: INGESTION ================= */}
        <div className="col-span-3 bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col shadow-lg">
          <div className="flex items-center gap-2 mb-3 text-teal-400">
            <Server size={18} />
            <h2 className="font-bold uppercase tracking-wider text-xs">Zone A: Ingestion</h2>
          </div>
          
          {/* 1. ADAPTER SWITCHES (Takes remaining height) */}
          <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-[100px]">
            {['HL7','GENOMICS','PATHOLOGY','DICOM','SDOH','RESEARCH'].map(type => (
                 <Blade key={type} label={type} active={switches[`source_${type.toLowerCase()}`]} onClick={() => toggle(`source_${type.toLowerCase()}`)} />
            ))}
          </div>

          {/* 2. RAW PAYLOAD INSPECTOR (Fixed Height) */}
          <div className="mt-3 pt-2 border-t border-slate-700 flex flex-col h-36">
             <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {selectedSource ? `Payload: ${selectedSource}` : 'Payload Inspector'}
                </span>
             </div>
             <div className="flex-1 bg-black/40 rounded p-2 overflow-auto font-mono text-[9px] border border-slate-700/50">
                {selectedSource ? (
                    <div className="text-orange-300 whitespace-pre-wrap break-all">
                        {typeof RAW_SOURCES[selectedSource] === 'object' 
                            ? JSON.stringify(RAW_SOURCES[selectedSource], null, 2) 
                            : RAW_SOURCES[selectedSource]}
                    </div>
                ) : (
                    <div className="text-slate-600 italic mt-1">Select a source to inspect data structure...</div>
                )}
             </div>
          </div>

          {/* 3. SYSTEM LOGS (Fixed Height) */}
          <div className="mt-3 pt-2 border-t border-slate-700 flex flex-col h-32">
            <div className="mb-1 flex items-center gap-2">
                <Activity size={10} className="text-slate-500"/>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Live Logs</span>
            </div>
            <div className="flex-1 bg-black/40 rounded p-2 overflow-auto font-mono text-[9px] border border-slate-700/50 text-slate-500 space-y-1">
                {logs.length === 0 && <span className="opacity-30">System Ready...</span>}
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        </div>

        {/* ================= ZONE B ================= */}
        <div className="col-span-3 bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col shadow-lg">
          <div className="flex items-center gap-2 mb-4 text-indigo-400">
            <GitMerge size={18} />
            <h2 className="font-bold uppercase tracking-wider text-xs">Zone B: Pipeline</h2>
          </div>
          <div className="space-y-3">
            <PipelineStage label="Semantic Aligner" desc="Normalize (LOINC/SNOMED)" active={switches.layer_aligner} color="indigo" onClick={() => toggle('layer_aligner')} />
            <div className="space-y-1 my-3 pl-2 border-l-2 border-slate-700">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Layer 5: Governance</p>
                <PipelineStage label="PCRM (Policy)" desc="Role-Based Access" active={switches.layer_pcrm} color="red" icon={<Shield size={14} />} onClick={() => toggle('layer_pcrm')} />
                <PipelineStage label="RCF (Consent)" desc="Check Opt-In Status" active={switches.layer_rcf} color="orange" icon={<UserCheck size={14} />} onClick={() => toggle('layer_rcf')} />
                <PipelineStage label="SAS (Audit)" desc="Log Access Event" active={switches.layer_sas} color="blue" icon={<FileText size={14} />} onClick={() => toggle('layer_sas')} />
            </div>
            <div className="my-2 border-t border-slate-700/50" />
            <PipelineStage label="Canonical Mapper" desc="Output: OMOP CDM" active={switches.layer_canonical} color="purple" disabled={switches.layer_context} onClick={() => toggle('layer_canonical')} />
            <PipelineStage label="Context Engine" desc="Output: Golden Record" active={switches.layer_context} color="emerald" disabled={switches.layer_canonical} onClick={() => toggle('layer_context')} />
          </div>
        </div>

        {/* ================= ZONE C ================= */}
        <div className="col-span-6 bg-slate-800 rounded-xl p-0 border border-slate-700 flex flex-col shadow-lg overflow-hidden">
          <div className="bg-slate-900 p-3 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2 text-emerald-400">
              <Database size={18} />
              <h2 className="font-bold uppercase tracking-wider text-xs">Zone C: Output</h2>
            </div>
            {displayData?.type && <span className="text-[10px] px-2 py-0.5 bg-blue-900 text-blue-300 rounded font-bold">{displayData.type} VIEW</span>}
          </div>
          <div className="flex-1 p-4 overflow-auto bg-slate-800/50">
            {!displayData ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600">
                <Activity size={32} className="mb-2 opacity-50" />
                <p className="text-xs">System Idle</p>
              </div>
            ) : (
              <>
                {displayData.type === 'FHIR' && <FhirView bundle={displayData.content} />}
                {displayData.type === 'OMOP' && <ResearchTable data={displayData.content} />}
                {displayData.type === 'CONTEXT' && <ContextView profile={displayData.content} liveData={displayData.liveData} />}
                {displayData.type === 'BLOCKED' && (
                    <div className="flex flex-col items-center justify-center h-full text-red-500">
                        <Shield size={48} className="mb-4" />
                        <h3 className="font-bold">Access Denied</h3>
                        <p className="text-sm">{displayData.reason}</p>
                    </div>
                )}
                
                {displayData.type !== 'OMOP' && displayData.type !== 'BLOCKED' && (
                    <div className="mt-6 pt-4 border-t border-slate-700">
                    <pre className="bg-black/30 p-3 rounded text-[10px] text-green-500/80 overflow-x-auto font-mono max-h-32">
                        {JSON.stringify(displayData.content, null, 2)}
                    </pre>
                    </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const Blade = ({ label, desc, active, onClick }) => (
  <div onClick={onClick} className={`relative p-3 rounded border cursor-pointer transition-all hover:bg-slate-750 flex justify-between items-center ${active ? 'bg-teal-900/20 border-teal-500/50' : 'bg-slate-800 border-slate-700'}`}>
    <div>
        <h3 className={`font-bold text-xs ${active ? 'text-teal-400' : 'text-slate-400'}`}>{label}</h3>
        <p className="text-[10px] text-slate-500">{desc}</p>
    </div>
    <div className={`w-2 h-2 rounded-full ${active ? 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]' : 'bg-slate-600'}`} />
  </div>
);

const PipelineStage = ({ label, desc, active, color, onClick, disabled, icon }) => {
    const colors = { indigo: 'border-indigo-500 text-indigo-300 bg-indigo-900/10', purple: 'border-purple-500 text-purple-300 bg-purple-900/10', emerald: 'border-emerald-500 text-emerald-300 bg-emerald-900/10', red: 'border-red-500 text-red-300 bg-red-900/10', orange: 'border-orange-500 text-orange-300 bg-orange-900/10', blue: 'border-blue-500 text-blue-300 bg-blue-900/10' };
    return (
        <div onClick={!disabled ? onClick : null} className={`p-3 rounded border cursor-pointer flex justify-between items-center transition-all ${disabled ? 'opacity-30' : active ? colors[color] : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
            <div>
                <div className="flex items-center gap-2"><span className="font-bold text-xs">{label}</span>{icon}</div>
                <p className="text-[10px] opacity-70">{desc}</p>
            </div>
            {active && <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
        </div>
    );
};

const FhirView = ({ bundle }) => (
    <div className="grid grid-cols-2 gap-3">
        {bundle.entry?.map((e, i) => <ClinicalCard key={i} resource={e.resource} />)}
    </div>
);

const ClinicalCard = ({ resource }) => {
  const isEnriched = resource.meta?.tag?.some(t => t.code === 'aligned');
  const isRedacted = resource.variant?.[0]?.observedAllele === 'REDACTED_POLICY_101' || resource.description === '[REDACTED STUDY]' || resource.actualArm === 'REDACTED';
  
  const typeIcons = { 
      Observation: Activity, 
      MolecularSequence: Cpu, 
      ImagingStudy: resource.modality?.[0]?.code === 'SM' ? Microscope : FileImage, 
      ResearchSubject: FileText,
      Specimen: Microscope, 
      QuestionnaireResponse: FileText,
      Patient: UserCheck, 
      Encounter: Database
  };
  const Icon = typeIcons[resource.resourceType] || Database;

  // SMART DISPLAY LOGIC
  const getDisplayText = (res) => {
      // 1. Patient
      if (res.resourceType === 'Patient' && res.name?.length > 0) {
          const n = res.name[0];
          return `${n.given?.join(' ')} ${n.family}`;
      }

      // 2. Encounter
      if (res.resourceType === 'Encounter' && res.class) return `${res.class.display} Visit`;

      // 3. Observations (Vitals & SDOH)
      if (res.code?.text) return res.code.text;
      if (res.code?.coding?.[0]?.display) return res.code.coding[0].display;

      // 4. Imaging (MRI & Pathology)
      if (res.description) return res.description;
      // FIX: Pathology description is often deep in the series
      if (res.series?.[0]?.description) return res.series[0].description;
      
      // 5. Pathology (Specimen)
      if (res.type) {
          if (typeof res.type === 'string') return res.type;
          if (res.type.text) return res.type.text;
          if (res.type.coding?.[0]?.display) return res.type.coding[0].display;
      }
      
      // 6. Research
      if (res.study?.display) return res.study.display;

      // 7. Survey Response (Questionnaire)
      if (res.resourceType === 'QuestionnaireResponse') return "Patient Survey Response";
      
      return "Unknown Data";
  };

  return (
    <div className={`p-3 rounded border bg-slate-800 relative ${isEnriched ? 'border-green-500/40' : 'border-slate-700'} ${isRedacted ? 'border-red-500/40 opacity-70' : ''}`}>
      <div className="flex items-center gap-2 mb-2 text-slate-500">
        <Icon size={14} />
        <span className="text-[10px] font-bold uppercase">{resource.resourceType}</span>
      </div>
      
      <div className="text-sm font-medium text-slate-200 truncate" title={getDisplayText(resource)}>
        {getDisplayText(resource)}
      </div>
      
      {/* Vitals */}
      {resource.valueQuantity && <div className="text-lg font-bold text-white mt-1">{resource.valueQuantity.value} <span className="text-xs font-normal text-slate-400">{resource.valueQuantity.unit}</span></div>}
      
      {/* SDOH Values */}
      {resource.valueCodeableConcept && <div className="mt-1 text-xs text-orange-300">{resource.valueCodeableConcept.coding[0].display}</div>}
      {resource.valueBoolean !== undefined && <div className="mt-1 text-xs text-orange-300">{resource.valueBoolean ? "True" : "False"}</div>}

      {/* Patient Specifics */}
      {resource.resourceType === 'Patient' && <div className="mt-1 text-xs text-slate-400">{resource.gender}, DOB: {resource.birthDate}</div>}

      {/* Encounter Specifics */}
      {resource.resourceType === 'Encounter' && resource.location && <div className="mt-1 text-xs text-slate-400">Loc: {resource.location[0].location.display}</div>}

      {/* Genomics */}
      {resource.variant && <div className="mt-2 text-[10px] font-mono text-red-300 bg-black/20 p-1 rounded">{resource.variant[0].observedAllele}</div>}
      
      {/* Imaging Stats */}
      {resource.numberOfInstances && <div className="mt-2 text-[10px] text-slate-400 bg-slate-700/50 p-1 rounded inline-block">{resource.numberOfInstances} Instances ({resource.modality?.[0]?.code})</div>}

      {/* Research Stats */}
      {resource.resourceType === 'ResearchSubject' && <div className="mt-2 text-[10px] text-purple-300 bg-purple-900/20 p-1 rounded inline-block">Arm: {resource.actualArm}</div>}
      
      {/* Pathology / Specimen Stats */}
      {resource.resourceType === 'Specimen' && resource.collection?.bodySite && (
          <div className="mt-2 text-[10px] text-pink-300 bg-pink-900/20 p-1 rounded inline-block">Site: {resource.collection.bodySite.text}</div>
      )}

      {isEnriched && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]" />}
    </div>
  );
};

const ResearchTable = ({ data }) => (
    <div className="bg-slate-900 rounded border border-slate-700 overflow-hidden text-[10px]">
      <table className="w-full text-left text-slate-300">
        <thead className="bg-slate-800 text-slate-500 font-bold uppercase">
          <tr><th className="p-2">Domain</th><th className="p-2">Concept ID</th><th className="p-2">Value</th><th className="p-2">Source</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {/* ... Existing MEASUREMENT, OBSERVATION, NOTE maps ... */}
          
          {data.MEASUREMENT?.map((m, i) => <tr key={`m${i}`}><td className="p-2 text-blue-400">MEASUREMENT</td><td className="p-2 font-mono">{m.measurement_concept_id}</td><td className="p-2">{m.value_as_number} {m.unit_source_value}</td><td className="p-2 text-slate-500">{m.measurement_source_value}</td></tr>)}
          {data.OBSERVATION?.map((o, i) => <tr key={`o${i}`}><td className="p-2 text-green-400">OBSERVATION</td><td className="p-2 font-mono">{o.observation_concept_id}</td><td className="p-2">{o.value_as_string}</td><td className="p-2 text-slate-500">{o.observation_source_value}</td></tr>)}
          {data.NOTE?.map((n, i) => <tr key={`n${i}`}><td className="p-2 text-pink-400">NOTE (NLP)</td><td className="p-2 font-mono text-slate-600">44814645</td><td className="p-2 italic text-slate-400">{n.note_text}</td><td className="p-2 text-slate-500">{n.note_title}</td></tr>)}

          {/* ✅ NEW: PROCEDURE TABLE (Imaging) */}
          {data.PROCEDURE_OCCURRENCE?.map((p, i) => (
            <tr key={`p${i}`}>
              <td className="p-2 text-orange-400">PROCEDURE</td>
              <td className="p-2 font-mono">{p.procedure_concept_id}</td>
              <td className="p-2">{p.modifier_source_value}</td>
              <td className="p-2 text-slate-500">{p.procedure_source_value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

// ✅ UPDATED CONTEXT VIEW (Visualizes Redaction)
const ContextView = ({ profile }) => (
    <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
            <StatBox label="Acuity" value={`${profile.clinical_status?.acuity_score || 0}/10`} color="emerald" />
            <StatBox label="Problems" value={profile.active_problems?.length || 0} color="blue" />
            <StatBox label="Care Gaps" value={profile.care_gaps?.length || 0} color="purple" />
        </div>

        <div className="p-4 rounded border border-slate-700 bg-slate-800 shadow-lg">
            <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase flex items-center gap-2">
                <UserCheck size={14} /> Golden Record (Layer 6)
            </h3>
            
            <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                    <div>
                        <span className="text-slate-500 text-xs uppercase font-bold">Patient Identity</span>
                        <div className="text-white font-bold text-lg">{profile.patient?.name}</div>
                        <div className="text-slate-400 text-xs">MRN: {profile.patient?.mrn}</div>
                    </div>
                    <div>
                        <span className="text-slate-500 text-xs uppercase font-bold">Active Problems</span>
                        <ul className="mt-1 space-y-1">
                            {profile.active_problems?.map((p, i) => (
                                <li key={i} className="text-blue-300 bg-blue-900/20 px-2 py-1 rounded text-xs border border-blue-500/30">{p}</li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <span className="text-slate-500 text-xs uppercase font-bold">Medications</span>
                        <ul className="mt-1 space-y-1">
                            {profile.current_meds?.map((m, i) => (
                                <li key={i} className="text-slate-300 bg-slate-700/50 px-2 py-1 rounded text-xs border border-slate-600">{m}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <span className="text-slate-500 text-xs uppercase font-bold">Genomics & Risk</span>
                        {profile.genomics?.status === 'RESTRICTED' ? (
                            <div className="text-red-400 bg-red-900/20 px-2 py-1 rounded text-xs border border-red-500/30 font-mono">[REDACTED BY GOVERNANCE]</div>
                        ) : (
                            <ul className="mt-1 space-y-1">
                                {profile.genomics?.risk_markers?.map((r, i) => (
                                    <li key={i} className="text-pink-300 bg-pink-900/20 px-2 py-1 rounded text-xs border border-pink-500/30 flex items-center gap-2"><Activity size={10} /> {r}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div>
                        <span className="text-slate-500 text-xs uppercase font-bold">SDOH Factors</span>
                        {profile.sdoh?.status === 'RESTRICTED' ? (
                             <div className="text-red-400 bg-red-900/20 px-2 py-1 rounded text-xs border border-red-500/30 font-mono">[REDACTED]</div>
                        ) : (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {profile.sdoh?.factors?.map((f, i) => (
                                    <span key={i} className="text-emerald-300 bg-emerald-900/20 px-2 py-0.5 rounded text-[10px] border border-emerald-500/30">{f}</span>
                                ))}
                            </div>
                        )}
                    </div>
                    {profile.care_gaps?.length > 0 && (
                        <div>
                             <span className="text-slate-500 text-xs uppercase font-bold">Care Gaps</span>
                             <div className="mt-1 p-2 bg-purple-900/20 border border-purple-500/40 rounded">
                                <div className="text-purple-300 font-bold text-xs">CRITICAL ACTION</div>
                                <div className="text-purple-200 text-xs mt-1">{profile.care_gaps[0].message}</div>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
);

const StatBox = ({ label, value, color }) => {
    const colors = { emerald: 'text-emerald-400 bg-emerald-900/20 border-emerald-500/30', blue: 'text-blue-400 bg-blue-900/20 border-blue-500/30', purple: 'text-purple-400 bg-purple-900/20 border-purple-500/30' };
    return (
        <div className={`p-3 rounded border ${colors[color]}`}>
            <div className="text-[10px] uppercase font-bold opacity-80">{label}</div>
            <div className="text-2xl font-bold text-white">{value}</div>
        </div>
    );
};

export default ContextRefinery;

