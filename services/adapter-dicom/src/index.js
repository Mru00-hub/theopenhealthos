const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3005;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'adapter-dicom', 
        protocol: 'DICOMweb', 
        modality_support: ['MR', 'CT', 'US'] 
    });
});

/**
 * POST /ingest
 * Simulates receiving DICOM metadata (e.g. from a PACS webhook).
 * output: FHIR ImagingStudy
 */
app.post('/ingest', (req, res) => {
    console.log("☢️ DICOM Metadata Received");
    
    // Simulate raw DICOM tags input
    const dicomTags = req.body || {};
    const modality = dicomTags.modality || "MR"; // Default to MRI

    const fhirResource = {
        resourceType: "ImagingStudy",
        id: uuidv4(),
        status: "available",
        subject: {
            reference: `Patient/${dicomTags.patientId || "1001"}`
        },
        started: new Date().toISOString(),
        numberOfInstances: dicomTags.instanceCount || 120,
        description: dicomTags.studyDescription || "Brain MRI - T1 Weighted",
        series: [
            {
                uid: uuidv4(),
                number: 1,
                modality: {
                    system: "http://dicom.nema.org/resources/ontology/DCM",
                    code: modality,
                    display: getModalityName(modality)
                },
                description: "Axial T1",
                numberOfInstances: 60
            },
            {
                uid: uuidv4(),
                number: 2,
                modality: {
                    system: "http://dicom.nema.org/resources/ontology/DCM",
                    code: modality,
                    display: getModalityName(modality)
                },
                description: "Sagittal T2",
                numberOfInstances: 60
            }
        ]
    };

    res.json(fhirResource);
});

// Helper to map codes to names
const getModalityName = (code) => {
    const map = {
        'MR': 'Magnetic Resonance',
        'CT': 'Computed Tomography',
        'US': 'Ultrasound',
        'XR': 'X-Ray'
    };
    return map[code] || 'Unknown Modality';
};

app.listen(PORT, '0.0.0.0', () => {
    console.log(`☢️ DICOM Adapter listening on port ${PORT}`);
});
