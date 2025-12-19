const { v4: uuidv4 } = require('uuid');

/**
 * THE GENOMICS EXPERT
 * Parses VCF (Variant Call Format) data lines and converts them
 * into FHIR R4 MolecularSequence and Observation resources.
 */

const transform = (rawVcf, patientReference = "Patient/1001") => {
    const lines = rawVcf.split('\n');
    const resources = [];
    const bundleId = uuidv4();

    // 1. HEADER METADATA EXTRACTION
    // We scan for ## metadata to add to the resource narrative
    const metadata = lines.filter(l => l.startsWith('##')).join('\n');
    
    // 2. VARIANT PARSING
    // Skip headers (#) and empty lines
    const variants = lines.filter(l => !l.startsWith('#') && l.trim().length > 0);

    variants.forEach(line => {
        const fields = line.split('\t');
        if (fields.length < 5) return; // Malformed line

        // VCF Columns: #CHROM POS ID REF ALT QUAL FILTER INFO
        const chrom = fields[0];
        const pos = parseInt(fields[1]);
        const ref = fields[3];
        const alt = fields[4];
        const info = fields[7] || "";

        // GENERATE UUIDs
        const seqId = uuidv4();
        const obsId = uuidv4();

        // --- RESOURCE A: MolecularSequence (The Raw Science) ---
        // This holds the coordinate system and exact base pair change
        const molSeq = {
            resourceType: "MolecularSequence",
            id: seqId,
            type: "dna",
            coordinateSystem: 0,
            patient: { reference: patientReference },
            referenceSeq: {
                chromosome: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/chromosome-human",
                        code: chrom,
                        display: `Chromosome ${chrom}`
                    }]
                },
                windowStart: pos,
                windowEnd: pos + ref.length,
                strand: "watson"
            },
            variant: [{
                start: pos,
                end: pos + ref.length,
                observedAllele: alt,
                referenceAllele: ref,
                cigar: `${ref.length}M` // Simplified CIGAR string
            }],
            meta: {
                tag: [{ system: "http://openhealthos.org/tag", code: "raw-genomics", display: "VCF Import" }]
            }
        };

        // --- RESOURCE B: Observation (The Clinical Consequence) ---
        // This is what the CDSS or Semantic Layer will pick up
        // We use a temporary code here; the Semantic Layer will map it to SNOMED later.
        const observation = {
            resourceType: "Observation",
            id: obsId,
            status: "final",
            category: [{
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/observation-category",
                    code: "laboratory",
                    display: "Laboratory"
                }]
            }],
            code: {
                text: "Genetic Variant Finding",
                coding: [{
                    system: "http://loinc.org",
                    code: "69548-6",
                    display: "Genetic variant [Presence] in Blood or Tissue"
                }]
            },
            subject: { reference: patientReference },
            // Link back to the raw sequence for provenance
            derivedFrom: [{ reference: `MolecularSequence/${seqId}` }],
            valueCodeableConcept: {
                text: `Variant detected at ${chrom}:${pos} (${ref}->${alt})`,
                // In a real VCF, the 'INFO' column often contains clinical significance (CLINSIG)
                coding: [{
                    system: "urn:vcf:info",
                    code: `${chrom}-${pos}-${alt}`,
                    display: `Variant ${chrom}:${pos}${ref}>${alt}`
                }]
            },
            component: [
                {
                    code: { text: "Genomic Coordinate" },
                    valueString: `chr${chrom}:${pos}`
                },
                {
                    code: { text: "Reference Allele" },
                    valueString: ref
                },
                {
                    code: { text: "Alternate Allele" },
                    valueString: alt
                }
            ],
            effectiveDateTime: new Date().toISOString()
        };

        // Add both to our list
        resources.push({
            resource: molSeq,
            request: { method: "POST", url: "MolecularSequence" }
        });
        resources.push({
            resource: observation,
            request: { method: "POST", url: "Observation" }
        });
    });

    // 3. WRAP IN BUNDLE
    return {
        resourceType: "Bundle",
        id: bundleId,
        type: "transaction",
        timestamp: new Date().toISOString(),
        entry: resources
    };
};

module.exports = { transform };
