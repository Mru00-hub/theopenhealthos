const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.text({ type: '*/*' })); // Accept raw text

// --- REAL VCF PARSER LOGIC ---
const parseVCF = (rawVcf) => {
    if (!rawVcf || typeof rawVcf !== 'string') {
        throw new Error("Input must be a raw VCF string");
    }

    // 1. Split lines and filter out empty ones
    const lines = rawVcf.split('\n').filter(line => line.trim().length > 0);
    
    // 2. Ignore Meta-data (##) and Headers (#)
    const dataLines = lines.filter(line => !line.startsWith('#'));

    if (dataLines.length === 0) {
        throw new Error("Invalid VCF: No data variants found.");
    }

    // 3. Parse the first variant found (Standard VCF 4.2 format)
    // Columns: CHROM(0) POS(1) ID(2) REF(3) ALT(4) QUAL(5) FILTER(6) INFO(7)
    const columns = dataLines[0].trim().split(/\s+/); // Split by tab or space

    if (columns.length < 5) {
        throw new Error(`Invalid VCF Data Line: Expected at least 5 columns (CHROM POS ID REF ALT), found ${columns.length}`);
    }

    return {
        chromosome: columns[0],      // e.g. "chr17"
        position: parseInt(columns[1]), // e.g. 41245466
        ref: columns[3],             // e.g. "G"
        alt: columns[4],             // e.g. "A"
        info: columns[7] || ""       // e.g. "gene=BRCA1"
    };
};

app.get('/health', (req, res) => res.json({ status: 'online' }));

app.post('/ingest', (req, res) => {
    console.log(`[Genomics] Receiving Data Stream...`);
    
    try {
        // 1. EXTRACT RAW INPUT
        // Support both direct text body (from our React App) and JSON wrapped (Postman)
        let rawInput = req.body;
        if (typeof req.body === 'object' && req.body.content) {
            rawInput = req.body.content;
        }

        // 2. PARSE (This will Throw Error if input is bad)
        const vcfData = parseVCF(rawInput);
        console.log(`   -> Parsed Variant: ${vcfData.chromosome} at ${vcfData.position} (${vcfData.ref} > ${vcfData.alt})`);

        // 3. TRANSFORM TO FHIR (MolecularSequence)
        // We strictly use the parsed data. No defaults.
        const fhirResource = {
            resourceType: "MolecularSequence",
            id: `seq-${Date.now()}`,
            type: "dna",
            coordinateSystem: 0, // 0-based
            referenceSeq: {
                chromosome: {
                    coding: [{ system: "http://terminology.hl7.org/CodeSystem/chromosome-human", code: vcfData.chromosome }]
                },
                windowStart: vcfData.position,
                windowEnd: vcfData.position + 1
            },
            variant: [{
                start: vcfData.position,
                end: vcfData.position + 1,
                observedAllele: vcfData.alt,
                referenceAllele: vcfData.ref,
                cigar: "1M" // Simple substitution
            }],
            meta: {
                tag: [
                    { system: "http://vcf-info", code: vcfData.info }
                ]
            }
        };
        
        res.json(fhirResource);

    } catch (error) {
        console.error(`[Genomics] ❌ Parse Error: ${error.message}`);
        res.status(400).json({
            resourceType: "OperationOutcome",
            issue: [{
                severity: "error",
                code: "invalid",
                diagnostics: error.message
            }]
        });
    }
});

app.listen(PORT, () => console.log(`🧬 Genomics Adapter (Real VCF Parser) on ${PORT}`));

