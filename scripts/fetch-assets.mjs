// Prépare les fichiers nécessaires hors-ligne : runtime WASM de MediaPipe + modèles IA.
import { cpSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = join(root, 'src', 'vendor');
mkdirSync(join(vendor, 'wasm'), { recursive: true });
mkdirSync(join(vendor, 'models'), { recursive: true });

const tv = join(root, 'node_modules', '@mediapipe', 'tasks-vision');
cpSync(join(tv, 'vision_bundle.mjs'), join(vendor, 'vision_bundle.mjs'));
cpSync(join(tv, 'wasm'), join(vendor, 'wasm'), { recursive: true });

// Polices (OFL) embarquées : écriture scolaire pour les titres, sans-serif très lisible pour l'interface.
mkdirSync(join(vendor, 'fonts'), { recursive: true });
const fonts = {
  'playwrite-fr-moderne-latin-300-normal.woff2': join(root, 'node_modules', '@fontsource', 'playwrite-fr-moderne', 'files'),
  'playwrite-fr-moderne-latin-400-normal.woff2': join(root, 'node_modules', '@fontsource', 'playwrite-fr-moderne', 'files'),
  'atkinson-hyperlegible-next-latin-wght-normal.woff2': join(root, 'node_modules', '@fontsource-variable', 'atkinson-hyperlegible-next', 'files'),
};
for (const [file, dir] of Object.entries(fonts)) cpSync(join(dir, file), join(vendor, 'fonts', file));

const models = {
  'face_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  'efficientdet_lite2.tflite':
    'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite',
};

for (const [name, url] of Object.entries(models)) {
  const dest = join(vendor, 'models', name);
  if (existsSync(dest)) continue;
  console.log('Téléchargement', name);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}
console.log('Assets prêts.');
