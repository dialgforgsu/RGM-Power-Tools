import { readFileSync, existsSync } from 'node:fs';
import { parseDocument, LineCounter, stringify, type Document } from 'yaml';
import { ZodError } from 'zod';
import { configSchema, type ConfigFile } from './schema.js';
import {
  ConfigFileError,
  ConfigValidationError,
  type ValidationIssue,
} from './errors.js';

/**
 * Parse and validate YAML text into a {@link ConfigFile}. On failure throws a
 * {@link ConfigValidationError} whose issues carry source line numbers wherever
 * they can be located, so the CLI can point users at the exact problem.
 */
export function parseConfig(text: string): ConfigFile {
  const lineCounter = new LineCounter();
  let doc: Document.Parsed;
  try {
    doc = parseDocument(text, { lineCounter });
  } catch (cause) {
    throw new ConfigValidationError('The file is not valid YAML.', [
      { path: '(root)', message: String((cause as Error).message ?? cause) },
    ]);
  }

  if (doc.errors.length > 0) {
    const issues: ValidationIssue[] = doc.errors.map((e) => {
      const pos = e.pos ? lineCounter.linePos(e.pos[0]) : undefined;
      return {
        path: '(yaml)',
        message: e.message,
        line: pos?.line,
        column: pos?.col,
      };
    });
    throw new ConfigValidationError('The file is not valid YAML.', issues);
  }

  const data = doc.toJS();
  const result = configSchema.safeParse(data);
  if (!result.success) {
    throw new ConfigValidationError(
      'Config failed schema validation.',
      zodIssuesToValidationIssues(result.error, doc, lineCounter),
    );
  }
  return result.data;
}

/** Read and validate a config file from disk. */
export function readConfigFile(path: string): ConfigFile {
  if (!existsSync(path)) {
    throw new ConfigFileError(
      `Config file not found: ${path}. Run "monitor-config init" to create one.`,
    );
  }
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (cause) {
    throw new ConfigFileError(`Could not read ${path}.`, { cause });
  }
  return parseConfig(text);
}

function zodIssuesToValidationIssues(
  error: ZodError,
  doc: Document.Parsed,
  lineCounter: LineCounter,
): ValidationIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    let line: number | undefined;
    let column: number | undefined;
    try {
      const node = issue.path.length
        ? doc.getIn(issue.path, true)
        : doc.contents;
      const range = (node as { range?: [number, number, number] })?.range;
      if (range) {
        const pos = lineCounter.linePos(range[0]);
        line = pos.line;
        column = pos.col;
      }
    } catch {
      // Position lookup is best-effort; omit it if the path can't be resolved.
    }
    return { path, message: issue.message, line, column };
  });
}

/**
 * Serialize a config to YAML. Key order is preserved from the object as built,
 * so `export` (which constructs groups/alerts/servers in a fixed canonical
 * order) produces byte-identical output for unchanged state — stable diffs.
 */
export function serializeConfig(config: ConfigFile): string {
  return stringify(config, { lineWidth: 0 });
}
