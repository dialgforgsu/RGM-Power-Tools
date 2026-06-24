import type {
  LicenseSummary,
  MonitorClient,
  ServerStatus,
} from '@rgm-power-tools/core';

export interface CostData {
  servers: ServerStatus[];
  license: LicenseSummary;
}

/** Fetch the per-server statuses and license summary the cost audit needs. */
export async function gatherCostData(client: MonitorClient): Promise<CostData> {
  const [servers, license] = await Promise.all([
    client.getServerStatuses(),
    client.getLicenseSummary(),
  ]);
  return { servers, license };
}
