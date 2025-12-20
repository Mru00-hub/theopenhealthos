import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Database, GitMerge, Shield, FileText, Server, ArrowRight } from 'lucide-react';
import _ from 'lodash';

// --- CONFIGURATION ---
// These point to your running Docker containers (via localhost)
const API = {
  HL7_ADAPTER:      `${BASE_URL}-3001.app.github.dev/ingest`,
  GENOMICS_ADAPTER: `${BASE_URL}-3002.app.github.dev/ingest`,
  ADAPTER_SDOH:  `${BASE_URL}-3004.app.github.dev/ingest`,
  
  ALIGNER:          `${BASE_URL}-3015.app.github.dev/align`,
  CANONICAL:        `${BASE_URL}-3016.app.github.dev/convert`,
  CONTEXT_ENGINE:   `${BASE_URL}-4000.app.github.dev/context`
};

// --- MOCK RAW DATA (To inject when Adapters are toggled) ---
const MOCK_DATA = {
  HL7: {
    resourceType: "Observation",
    id: "obs-hl7-001",
    status: "final",
    code: { text: "Pulse" }, // Non-standard code
    valueQuantity: { value: 82, unit: "bpm" },
    effectiveDateTime: new Date().toISOString()
  },
  GENOMICS: {
    resourceType: "MolecularSequence",
    id: "seq-001",
    type: "dna",
    // Raw, un-enriched variant
    variant: [{ observedAllele: "BRCA1:c.68_69delAG" }] 
  },
  SDOH: {
    resourceType: "Observation",
    id: "sdoh-001",
    code: { text: "Housing" },
    valueString: "unstable"
  }
};

const ContextRefinery = () => {
  // --- STATE ---
  const [switches, setSwitches] = useState({
    source_hl7: false,
    source_genomics: false,
    source_sdoh: false,
    layer_aligner: false,
    layer_governance: false,
    layer_research: false
  });

  const [displayData, setDisplayData] = useState(null); // What Zone C shows
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- LOGGING HELPER ---
  const addLog = (msg) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 5));

  // --- THE "ENGINE" ---
  // Re-calculates Zone C whenever a switch is toggled
  useEffect(() => {
    processPipeline();
  }, [switches]);

  const processPipeline = async () => {
    setLoading(true);
    let bundle = { resourceType: "Bundle", entry: [] };

    try {
      // PHASE 1: INGESTION (Zone A)
      // In a real app, this would fetch from the Adapters. 
      // Here we simulate the Adapter 'Push' by adding data if the switch is ON.
      
      if (switches.source_hl7) {
        bundle.entry.push({ resource: MOCK_DATA.HL7 });
      }
      if (switches.source_genomics) {
        bundle.entry.push({ resource: MOCK_DATA.GENOMICS });
      }
      if (switches.source_sdoh) {
        bundle.entry.push({ resource: MOCK_DATA.SDOH });
      }

      // PHASE 2: SEMANTIC ALIGNMENT (Zone B)
      if (switches.layer_aligner && bundle.entry.length > 0) {
        try {
          // CALL REAL BACKEND MICROSERVICE
          const res = await axios.post(API.ALIGNER, bundle);
          bundle = res.data; 
          addLog("✅ Semantic Aligner: Normalized codes & merged duplicates.");
        } catch (e) {
          addLog("❌ Aligner Service Offline (Check Docker).");
        }
      }

      // PHASE 3: RESEARCH TRANSFORMATION (Zone B -> C)
      if (switches.layer_research && bundle.entry.length > 0) {
        try {
          // CALL REAL BACKEND MICROSERVICE
          const res = await axios.post(API.CANONICAL, bundle);
          setDisplayData({ type: 'OMOP', content: res.data });
          addLog("✅ Canonical Mapper: Converted FHIR to OMOP CDM.");
          setLoading(false);
          return; // Exit, showing Table View
        } catch (e) {
          addLog("❌ Mapper Service Offline.");
        }
      }

      // DEFAULT OUTPUT (FHIR View)
      setDisplayData({ type: 'FHIR', content: bundle });

    } catch (error) {
      console.error(error);
      addLog("⚠️ Pipeline Error");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key) => setSwitches(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <header className="mb-8 border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
          Clinical Context Refinery
        </h1>
        <p className="text-slate-400 mt-2">
          Layer 4/5/6 Simulator: Compose your data pipeline dynamically.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6 h-[80vh]">
        
        {/* ================= ZONE A: INGESTION MATRIX ================= */}
        <div className="col-span-3 bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col shadow-lg">
          <div className="flex items-center gap-2 mb-6 text-teal-400">
            <Server size={20} />
            <h2 className="font-bold uppercase tracking-wider text-sm">Zone A: Ingestion Sources</h2>
          </div>
          
          <div className="space-y-4 flex-1">
            <Blade 
              label="Legacy HL7 Feed" 
              desc="ADT/ORU Messages" 
              active={switches.source_hl7} 
              onClick={() => toggle('source_hl7')} 
            />
            <Blade 
              label="Genomics Sequencer" 
              desc="VCF Variant Files" 
              active={switches.source_genomics} 
              onClick={() => toggle('source_genomics')} 
            />
            <Blade 
              label="Patient App (SDOH)" 
              desc="Social Survey JSON" 
              active={switches.source_sdoh} 
              onClick={() => toggle('source_sdoh')} 
            />
          </div>

          <div className="mt-4 p-3 bg-slate-900 rounded text-xs text-slate-500 font-mono">
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>

        {/* ================= ZONE B: SEMANTIC FABRIC ================= */}
        <div className="col-span-3 bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6 text-indigo-400">
            <GitMerge size={20} />
            <h2 className="font-bold uppercase tracking-wider text-sm">Zone B: Semantics</h2>
          </div>

          {/* Visualization of the Pipes */}
          <div className="absolute top-20 right-[-20px] z-0 opacity-20">
             <Activity size={200} />
          </div>

          <div className="space-y-6 z-10">
            <div className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${switches.layer_aligner ? 'border-indigo-500 bg-indigo-900/20' : 'border-slate-600 grayscale opacity-50'}`}
                 onClick={() => toggle('layer_aligner')}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-indigo-300">Semantic Aligner</span>
                <div className={`w-3 h-3 rounded-full ${switches.layer_aligner ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              </div>
              <p className="text-xs text-slate-400">
                Orchestrates SNOMED & LOINC services to normalize and de-duplicate raw data.
              </p>
            </div>

            <div className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${switches.layer_research ? 'border-purple-500 bg-purple-900/20' : 'border-slate-600 grayscale opacity-50'}`}
                 onClick={() => toggle('layer_research')}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-purple-300">Canonical Mapper</span>
                <div className={`w-3 h-3 rounded-full ${switches.layer_research ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              </div>
              <p className="text-xs text-slate-400">
                Transforms clinical FHIR data into OMOP CDM tables for research.
              </p>
            </div>
          </div>
        </div>

        {/* ================= ZONE C: GOLDEN RECORD ================= */}
        <div className="col-span-6 bg-slate-800 rounded-xl p-0 border border-slate-700 flex flex-col shadow-lg overflow-hidden">
          <div className="bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2 text-emerald-400">
              <Database size={20} />
              <h2 className="font-bold uppercase tracking-wider text-sm">Zone C: The Golden Record</h2>
            </div>
            <div className="flex gap-2 text-xs">
              <span className={`px-2 py-1 rounded ${displayData?.type === 'FHIR' ? 'bg-blue-600' : 'bg-slate-700'}`}>Clinical View</span>
              <span className={`px-2 py-1 rounded ${displayData?.type === 'OMOP' ? 'bg-purple-600' : 'bg-slate-700'}`}>Research View</span>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-auto bg-slate-800/50">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-500 animate-pulse">Processing Pipeline...</div>
            ) : !displayData || (displayData.content.entry?.length === 0 && !displayData.content.cdm) ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Shield size={48} className="mb-4 opacity-20" />
                <p>No Active Data Stream.</p>
                <p className="text-sm">Activate adapters in Zone A to begin.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* 1. CLINICAL CARD VIEW */}
                {displayData.type === 'FHIR' && (
                  <div className="grid grid-cols-2 gap-4">
                    {displayData.content.entry?.map((e, i) => (
                      <ClinicalCard key={i} resource={e.resource} aligned={switches.layer_aligner} />
                    ))}
                  </div>
                )}

                {/* 2. RESEARCH TABLE VIEW */}
                {displayData.type === 'OMOP' && (
                  <ResearchTable data={displayData.content.cdm} />
                )}

                {/* 3. DEBUG JSON */}
                <div className="mt-8 pt-4 border-t border-slate-700">
                  <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Raw Output Payload</h3>
                  <pre className="bg-black/40 p-4 rounded text-xs text-green-400 overflow-x-auto font-mono">
                    {JSON.stringify(displayData.content, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const Blade = ({ label, desc, active, onClick }) => (
  <div onClick={onClick} 
       className={`relative p-4 rounded border cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]
       ${active ? 'bg-teal-900/30 border-teal-500' : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'}`}>
    <div className="flex justify-between items-center">
      <h3 className={`font-bold ${active ? 'text-teal-300' : 'text-slate-400'}`}>{label}</h3>
      <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${active ? 'bg-teal-500' : 'bg-slate-600'}`}>
        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${active ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </div>
    <p className="text-xs text-slate-500 mt-1">{desc}</p>
    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-l" />}
  </div>
);

const ClinicalCard = ({ resource, aligned }) => {
  const isEnriched = resource.code?.coding?.length > 0 || resource.meta?.tag?.some(t => t.code === 'aligned');
  
  return (
    <div className={`p-4 rounded border bg-slate-800 ${isEnriched ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'border-slate-600'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold uppercase text-slate-400">{resource.resourceType}</span>
        {isEnriched && <span className="bg-green-900/50 text-green-400 text-[10px] px-1.5 py-0.5 rounded border border-green-700">ENRICHED</span>}
      </div>
      
      <div className="text-lg font-medium text-slate-200">
        {resource.code?.text || resource.type || "Unknown Data"}
      </div>

      {resource.valueQuantity && (
        <div className="text-2xl font-bold text-white mt-1">
          {resource.valueQuantity.value} <span className="text-sm font-normal text-slate-400">{resource.valueQuantity.unit}</span>
        </div>
      )}

      {resource.variant && (
        <div className="text-sm text-red-300 mt-1 flex items-center gap-2">
          <Activity size={14} />
          {resource.variant[0].observedAllele}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500 font-mono">
        ID: {resource.id.slice(0,8)}...
        <br/>
        {isEnriched ? (
          <span className="text-green-500">
             Code: {resource.code?.coding?.[0]?.code || 'LOINC/SNOMED'}
          </span>
        ) : (
           <span className="text-orange-500">Unstandardized Raw Data</span>
        )}
      </div>
    </div>
  );
};

const ResearchTable = ({ data }) => (
  <div className="bg-slate-900 rounded border border-slate-700 overflow-hidden">
    <div className="bg-purple-900/20 p-2 text-xs font-bold text-purple-300 border-b border-purple-900/30">
      OMOP CDM PREVIEW (SQL Ready)
    </div>
    <table className="w-full text-left text-xs text-slate-300">
      <thead className="bg-slate-800 text-slate-500">
        <tr>
          <th className="p-2">Table</th>
          <th className="p-2">Concept ID</th>
          <th className="p-2">Value</th>
          <th className="p-2">Source</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {data.PERSON?.map((p, i) => (
          <tr key={`p-${i}`}>
            <td className="p-2 font-mono text-purple-400">PERSON</td>
            <td className="p-2">{p.gender_concept_id}</td>
            <td className="p-2">ID: {p.person_id}</td>
            <td className="p-2 text-slate-600">Patient Index</td>
          </tr>
        ))}
         {data.MEASUREMENT?.map((m, i) => (
          <tr key={`m-${i}`}>
            <td className="p-2 font-mono text-blue-400">MEASUREMENT</td>
            <td className="p-2">{m.measurement_concept_id || "0 (Unmapped)"}</td>
            <td className="p-2">{m.value_as_number} {m.unit_source_value}</td>
            <td className="p-2 text-slate-600">{m.measurement_source_value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ContextRefinery;
