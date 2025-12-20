const { v4: uuidv4 } = require('uuid');

/**
 * GENOMICS TRANSFORMER
 * Parses raw VCF (Variant Call Format) or HGVS strings into FHIR.
 */
const transform = (rawData, patientRef) => {
    if (!rawData || typeof rawData !== 'string') {
        throw new Error("Invalid input: VCF data must be a string");
    }

    const sequenceId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // DETECT FORMAT
    // 1. Simple HGVS (e.g., "BRCA1:c.68_69delAG")
    if (rawData.includes(':') && !rawData.includes('\t')) {
        const [gene, variant] = rawData.split(':');
        return createFhir(patientRef, sequenceId, gene, variant, rawData);
    }

    // 2. Standard VCF (Tab separated: CHROM POS ID REF ALT ...)
    const columns = rawData.split('\t');
    if (columns.length >= 5) {
        const variantDisplay = `${columns[0]}:${columns[1]} ${columns[3]}>${columns[4]}`; // chr:pos ref>alt
        return createFhir(patientRef, sequenceId, "Unknown Gene (VCF)", variantDisplay, rawData);
    }

    // Fallback error
    throw new Error("Unknown Genomics Format. Expected VCF (tab-separated) or HGVS (Gene:Variant).");
};

const createFhir = (patientRef, id, gene, variant, raw) => {
    return {
        resourceType: "MolecularSequence",
        id: id,
        type: "dna",
        patient: { reference: patientRef },
        coordinateSystem: 0,
        
        // The Variant Details
        variant: [{
            start: 0, // Placeholder if no precise coord
            end: 0,
            observedAllele: variant,
            cigar: "M" // Match
        }],

        // Metadata / Tagging
        repository: [{
            type: "other",
            name: "HOS-Genomics-Lab",
            datasetId: "VCF-Upload-001"
        }],
        
        // Quality & Reference
        quality: [{
            standardSequence: {
                coding: [{ system: "http://www.ncbi.nlm.nih.gov/nuccore", code: "NC_000001.10" }]
            },
            score: 99 // High confidence simulation
        }],

        // Tag the Gene for the Semantic Layer
        meta: {
            tag: [
                { system: "http://openhealthos.org/genomics/gene", code: gene, display: gene },
                { system: "http://openhealthos.org/genomics/raw", display: raw }
            ]
        },
        text: {
            status: "generated",
            div: `<div xmlns="http://www.w3.org/1999/xhtml">Detected ${variant} in ${gene}</div>`
        }
    };
};

module.exports = { transform };

