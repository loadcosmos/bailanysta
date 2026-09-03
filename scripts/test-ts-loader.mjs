import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  const lastSegment = specifier.split('/').at(-1) ?? '';
  if (specifier.startsWith('.') && !specifier.endsWith('/') && !lastSegment.includes('.')) {
    const tsUrl = new URL(`${specifier}.ts`, context.parentURL);
    if (fs.existsSync(fileURLToPath(tsUrl))) {
      return nextResolve(tsUrl.href, context);
    }
  }
  if (specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
    const jsUrl = new URL(specifier, context.parentURL);
    const tsUrl = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
    if (!fs.existsSync(fileURLToPath(jsUrl)) && fs.existsSync(fileURLToPath(tsUrl))) {
      return nextResolve(tsUrl.href, context);
    }
  }
  return nextResolve(specifier, context);
}
