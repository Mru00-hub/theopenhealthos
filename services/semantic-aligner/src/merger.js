const _ = require('lodash');

/**
 * MERGE STRATEGY
 * Detects duplicates across different source systems and fuses them.
 * * Logic:
 * 1. Group by Patient.
 * 2. Group by "Semantic Meaning" (Resource Type + Code).
 * 3. Group by "Time Window" (occurred within 1 minute of each other).
 */
const deduplicate = (resources) => {
    // We only de-dupe Observations for this simulation
    const others = resources.filter(r => r.resourceType !== 'Observation');
    const observations = resources.filter(r => r.resourceType === 'Observation');

    // Group by Patient + Code (Standardized)
    // We rely on the fact that 'orchestrator.js' has already added the LOINC code
    const groups = _.groupBy(observations, (obs) => {
        const patient = obs.subject?.reference || 'unknown';
        const code = obs.code?.coding?.find(c => c.system === 'http://loinc.org')?.code || 'uncoded';
        return `${patient}|${code}`;
    });

    const mergedObservations = [];

    Object.values(groups).forEach(group => {
        // If 'uncoded', we can't safely merge, so keep all
        if (group[0].code?.coding?.find(c => c.system === 'http://loinc.org')?.code === undefined) {
            mergedObservations.push(...group);
            return;
        }

        // Sort by time
        const sorted = _.sortBy(group, 'effectiveDateTime');
        
        // Simple Time-Window Merge (1 minute)
        // In a real OS, this would be a sliding window algorithm
        const uniqueInWindow = [];
        let current = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i];
            const timeDiff = new Date(next.effectiveDateTime) - new Date(current.effectiveDateTime);
            
            if (timeDiff < 60000) { // Less than 60 seconds diff
                // MERGE DETECTED!
                console.log(`[Merger] Fusing duplicate observations: ${current.id} + ${next.id}`);
                
                // Logic: Keep the one with higher precision, or default to latest
                // Here we simply merge provenance to show sources
                current.meta = current.meta || {};
                current.meta.tag = [...(current.meta.tag || []), { 
                    system: "http://openhealthos.org/merge", 
                    code: "merged", 
                    display: `Merged with ${next.meta?.source || 'secondary-source'}` 
                }];
                // Discard 'next'
            } else {
                uniqueInWindow.push(current);
                current = next;
            }
        }
        uniqueInWindow.push(current);
        mergedObservations.push(...uniqueInWindow);
    });

    return [...others, ...mergedObservations];
};

module.exports = { deduplicate };
