import type { Provider } from '../types.js';
import { github } from './github.js';
import { gitlab } from './gitlab.js';
import { generic } from './generic.js';

/** All supported webhook providers, keyed by name (the URL path segment). */
export const PROVIDERS: Record<string, Provider> = {
  github,
  gitlab,
  generic,
};

export function providerByName(name: string): Provider | undefined {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, name)
    ? PROVIDERS[name]
    : undefined;
}

export { github, gitlab, generic };
