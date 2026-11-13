import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CHEMIN = fileURLToPath(
  new URL('../../node_modules/@expo-google-fonts/arimo/700Bold/Arimo_700Bold.ttf', import.meta.url),
);

let cache: Uint8Array | undefined;

/** Police Arimo Bold, celle que le navigateur charge aussi. */
export function chargerPolice(): Uint8Array {
  cache ??= new Uint8Array(readFileSync(CHEMIN));
  return cache;
}
