const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8082;
const FHIR_URL = process.env.FHIR_SERVER_URL || 'http://fhir-server:8080/fhir';

app.use(express.json());

// --- PHYSICS ENGINE ---
// Calculates SpO2 from raw light absorption ratios (Beer-Lambert Law approximation)
function calculateSpO2(redLight, irLight) {
    // R = (AC_red/DC_red) / (AC_ir/DC_ir). Simplified for simulation:
    const ratio = redLight / irLight;
    // Standard calibration curve approximation: SpO2 = 110 - 25 * R
    let spo2 = 110 - (25 * ratio);
    return Math.min(Math.max(Math.round(spo2), 80), 100); // Clamp between 80-100%
}

// --- FHIR CONVERTER UTILITY ---
async function publishToFHIR(type, value, unit, code) {
    const observation = {
      resourceType: "Observation",
      status: "final",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
      code: { coding: [{ system: "http://loinc.org", code: code, display: type }] },
      subject: { reference: "Patient/1000" },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: { value: value, unit: unit, system: "http://unitsofmeasure.org", code: unit },
      device: { display: "OpenHealthOS-Device-Abstraction-Layer" }
    };

    await axios.post(`${FHIR_URL}/Observation`, observation, {
      headers: { 'Content-Type': 'application/fhir+json' }
    });
    return observation;
}

app.get('/health', (req, res) => res.json({ status: 'healthy', abstraction_drivers: ['physics-optical', 'legacy-serial', 'iomt-json'] }));

// DRIVER 1: RAW OPTICAL SENSOR (Physics Abstraction)
// Input: { "red_voltage": 1.2, "ir_voltage": 2.4 } -> Needs Physics Math
app.post('/stream/driver/optical', async (req, res) => {
    try {
        const { red_voltage, ir_voltage } = req.body;
        console.log(`[Driver:Optical] Processing raw signal: R=${red_voltage}v, IR=${ir_voltage}v`);
        
        // 1. Abstraction: Convert Physics to Physiology
        const calculatedSpO2 = calculateSpO2(red_voltage, ir_voltage);
        
        // 2. Standardization: Convert Physiology to FHIR
        await publishToFHIR("Oxygen Saturation", calculatedSpO2, "%", "2708-6");

        res.json({ 
            driver: 'optical-physics-engine',
            raw_input: { red: red_voltage, ir: ir_voltage },
            abstracted_value: calculatedSpO2,
            status: 'normalized'
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DRIVER 2: LEGACY SERIAL MONITOR (Protocol Abstraction)
// Input: "HEAD|ID:999|HR:078|END" -> Needs String Parsing
app.post('/stream/driver/legacy', async (req, res) => {
    try {
        const rawString = req.body.serial_string; // e.g., "HEAD|HR:078|BP:120"
        console.log(`[Driver:Legacy] Parsing propriety string: ${rawString}`);
        
        // 1. Abstraction: Parse proprietary format
        const hrMatch = rawString.match(/HR:(\d+)/);
        if (!hrMatch) throw new Error("Invalid Serial Format");
        
        const heartRate = parseInt(hrMatch[1], 10);

        // 2. Standardization: Convert to FHIR
        await publishToFHIR("Heart Rate", heartRate, "/min", "8867-4");

        res.json({
            driver: 'legacy-serial-parser',
            raw_input: rawString,
            abstracted_value: heartRate,
            status: 'normalized'
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`Device Abstraction Layer Active on ${PORT}`));

