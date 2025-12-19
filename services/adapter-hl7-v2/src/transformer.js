const { v4: uuidv4 } = require('uuid');

/**
 * THE HL7 EXPERT
 * Parses raw pipe-delimited HL7 v2.x messages and converts them
 * into a valid FHIR R4 Transaction Bundle.
 */

// Helper: Parse HL7 Date (YYYYMMDDHHMM) to ISO (YYYY-MM-DDThh:mm:ss)
const parseDate = (hl7Date) => {
    if (!hl7Date || hl7Date.length < 8) return new Date().toISOString();
    const y = hl7Date.substring(0, 4);
    const m = hl7Date.substring(4, 6);
    const d = hl7Date.substring(6, 8);
    return `${y}-${m}-${d}`;
};

const transform = (rawMessage) => {
    const segments = rawMessage.split('\n').map(s => s.trim()).filter(s => s);
    const data = {};
    
    // 1. EXTRACT SEGMENTS
    segments.forEach(seg => {
        const fields = seg.split('|');
        data[fields[0]] = fields;
    });

    const bundleId = uuidv4();
    const patientId = uuidv4();
    const resources = [];

    // 2. HEADER (MSH) - Extract Provenance
    const msh = data['MSH'];
    const msgType = msh ? msh[8] : 'UNKNOWN'; // ADT^A01 or ORU^R01
    const sourceSystem = msh ? msh[2] : 'LEGACY';

    // 3. PATIENT (PID) -> FHIR Patient
    if (data['PID']) {
        const pid = data['PID'];
        const nameParts = (pid[5] || '').split('^');
        
        const patient = {
            resourceType: "Patient",
            id: patientId,
            identifier: [
                { 
                    use: "official", 
                    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR" }] },
                    system: `http://${sourceSystem}/mrn`,
                    value: pid[3] // MRN
                }
            ],
            name: [{
                family: nameParts[0] || "Unknown",
                given: [nameParts[1] || "Unknown"]
            }],
            gender: (pid[8] || 'unknown').toLowerCase() === 'f' ? 'female' : 'male',
            birthDate: parseDate(pid[7]),
            meta: {
                source: `urn:hl7v2:${sourceSystem}`,
                tag: [{ system: "http://openhealthos.org/tag", code: "legacy-data", display: "Legacy Import" }]
            }
        };
        
        resources.push({
            resource: patient,
            request: { method: "PUT", url: `Patient/${patientId}` }
        });
    }

    // 4. VISIT (PV1) -> FHIR Encounter
    if (data['PV1']) {
        const pv1 = data['PV1'];
        const encounterId = uuidv4();
        
        const encounter = {
            resourceType: "Encounter",
            id: encounterId,
            status: "finished",
            class: {
                system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                code: pv1[2] || "IMP", // I=Inpatient, O=Outpatient
                display: pv1[2] === 'I' ? "Inpatient" : "Ambulatory"
            },
            subject: { reference: `Patient/${patientId}` },
            location: [{
                location: { display: pv1[3] } // Assigned Patient Location
            }]
        };

        resources.push({
            resource: encounter,
            request: { method: "POST", url: "Encounter" }
        });
    }

    // 5. OBSERVATIONS (OBX) -> FHIR Observation (Looping for multiple)
    // Note: In a real parser we'd iterate the lines, but for this 'Lite' expert we look for OBX lines
    segments.forEach(seg => {
        if (seg.startsWith('OBX')) {
            const obx = seg.split('|');
            const obsId = uuidv4();
            
            // Raw Mapping (Before Semantic Layer Normalization)
            // We purposefully leave the code system vague so the Semantic Layer has work to do later!
            const observation = {
                resourceType: "Observation",
                id: obsId,
                status: "final",
                code: {
                    text: obx[3].split('^')[1] || obx[3], // "Heart Rate" or "Glu"
                    coding: [{
                        system: "urn:legacy-local-codes",
                        code: obx[3].split('^')[0], // Local Code
                        display: obx[3].split('^')[1]
                    }]
                },
                subject: { reference: `Patient/${patientId}` },
                valueQuantity: {
                    value: parseFloat(obx[5]),
                    unit: obx[6],
                    system: "http://unitsofmeasure.org"
                },
                effectiveDateTime: new Date().toISOString()
            };

            resources.push({
                resource: observation,
                request: { method: "POST", url: "Observation" }
            });
        }
    });

    // 6. WRAP IN BUNDLE
    return {
        resourceType: "Bundle",
        id: bundleId,
        type: "transaction",
        timestamp: new Date().toISOString(),
        entry: resources
    };
};

module.exports = { transform };
