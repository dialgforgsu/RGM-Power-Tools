import { renderCheckList } from '../output.js';
import type { CliIO } from '../io.js';

/** List the available checks. No network calls. */
export async function runList(io: CliIO): Promise<number> {
  renderCheckList(io.out);
  return 0;
}
