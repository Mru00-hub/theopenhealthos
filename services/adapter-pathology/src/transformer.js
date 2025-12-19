const { v4: uuidv4 } = require('uuid');

/**
 * PATHOLOGY EXPERT TRANSFORMER
 * Converts Whole Slide Image (WSI) scanner metadata into FHIR R4.
 * * Logic:
 * 1. Creates a Specimen resource (The physical tissue slide).
 * 2. Creates an ImagingStudy resource (The digital scan).
 * 3. Links them together via references.
 */

const transform = (metadata, patientRef) => {
    if (!patientRef) throw new Error("Patient reference is required");

    const resources = [];
    const studyId = uuidv4();
    const specimenId = uuidv4();
    const timestamp = new Date().toISOString();

    // ------------------------------------------
    // 1. SPECIMEN RESOURCE (The Physical Slide)
    // ------------------------------------------
    const specimen = {
        resourceType: "Specimen",
        id: specimenId,
        identifier: [{
            system: "http://hospital.org/specimen-id",
            value: metadata.slideId || "UNKNOWN-SLIDE"
        }],
        type: {
            coding: [{
                system: "http://snomed.info/sct",
                code: "122555007", 
                display: "Venous blood specimen" // Default fallback, usually would be 'Tissue specimen'
            }],
            text: "Biopsy Slide"
        },
        subject: { reference: patientRef },
        collection: {
            collectedDateTime: metadata.collectionDate || timestamp,
            bodySite: {
                text: metadata.bodySite || "Unspecified Body Site"
            }
        },
        note: [{ text: `Stain: ${metadata.stain || 'H&E'}` }]
    };
    
    // Add to transaction bundle
    resources.push({ 
        resource: specimen, 
        request: { method: "PUT", url: `Specimen/${specimenId}` } 
    });

    // ------------------------------------------
    // 2. IMAGING STUDY (The Digital WSI)
    // ------------------------------------------
    const imagingStudy = {
        resourceType: "ImagingStudy",
        id: studyId,
        status: "available",
        subject: { reference: patientRef },
        started: metadata.scanDate || timestamp,
        numberOfSeries: 1,
        numberOfInstances: metadata.layers || 1, // Pyramid layers in WSI
        
        // Link back to the physical specimen
        specimen: [{ reference: `Specimen/${specimenId}` }],
        
        // DICOM Modality: SM = Slide Microscopy
        modality: [{
            system: "http://dicom.nema.org/resources/ontology/DCM",
            code: "SM",
            display: "Slide Microscopy"
        }],
        
        series: [{
            uid: uuidv4(), // Series Instance UID
            number: 1,
            modality: { 
                system: "http://dicom.nema.org/resources/ontology/DCM", 
                code: "SM" 
            },
            description: `${metadata.magnification || '40'}x WSI Scan - ${metadata.stain || 'H&E'}`,
            instance: [{
                uid: uuidv4(), // SOP Instance UID
                sopClass: { 
                    system: "urn:ietf:rfc:3986", 
                    code: "urn:oid:1.2.840.10008.5.1.4.1.1.77.1.6", 
                    display: "VL Whole Slide Microscopy Image Storage" 
                },
                number: 1,
                title: "Pyramid Base Layer (Full Resolution)"
            }]
        }],
        
        meta: {
            tag: [
                { system: "http://openhealthos.org/tag", code: "digital-pathology", display: "WSI Ingestion" },
                { system: "http://openhealthos.org/source", code: metadata.scannerModel || "GenericScanner", display: "Scanner Device" }
            ]
        }
    };

    resources.push({ 
        resource: imagingStudy, 
        request: { method: "POST", url: "ImagingStudy" } 
    });

    // ------------------------------------------
    // 3. CREATE TRANSACTION BUNDLE
    // ------------------------------------------
    return {
        resourceType: "Bundle",
        id: uuidv4(),
        type: "transaction",
        timestamp: timestamp,
        entry: resources
    };
};

module.exports = { transform };
