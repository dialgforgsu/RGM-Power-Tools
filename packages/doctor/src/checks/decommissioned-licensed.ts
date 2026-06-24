import type { Check, Finding } from '../types.js';

/** Statuses that mean a server is no longer in active service. */
const RETIRED = new Set(['Decommissioned', 'Stopped']);

/**
 * Servers that are decommissioned or stopped yet still hold a Monitor license.
 * Each one is a license you've paid for and aren't using — reclaim them.
 */
export const decommissionedLicensed: Check = {
  id: 'decommissioned-licensed',
  title: 'Decommissioned servers still consuming licenses',
  description:
    'Stopped/decommissioned servers that still hold a license — wasted spend ' +
    'that can be reclaimed.',
  severity: 'error',
  run(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const server of snapshot.serverStatuses) {
      if (RETIRED.has(server.status) && server.consumesLicense) {
        findings.push({
          checkId: this.id,
          severity: this.severity,
          title: `${server.status} server still consuming a license`,
          subject: server.name,
          detail:
            'Remove this server from Monitor (or stop licensing it) to free ' +
            'the license.',
        });
      }
    }
    return findings;
  },
};
