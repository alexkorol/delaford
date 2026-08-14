import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const wizardSource = 'Z:/Code/WIZARD/tools/geometric_skilltree/assets/tree-data.js';
const output = path.join(projectRoot, 'src/core/passives/verdigris-authored-tree-data.js');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(wizardSource, 'utf8'), context, { filename: wizardSource });

if (!context.TREE_DATA || typeof context.TREE_DATA !== 'object') {
  throw new Error(`TREE_DATA was not published by ${wizardSource}`);
}

const banner = `// Generated from ${wizardSource} by tools/port-wizard-tree-data.mjs.\n`
  + '// Do not hand-edit; update the WIZARD authored data and rerun the port.\n';
fs.writeFileSync(output, `${banner}export default ${JSON.stringify(context.TREE_DATA, null, 2)};\n`);

console.log(`Ported ${Object.keys(context.TREE_DATA.seats || {}).length} authored seats to ${output}`);
