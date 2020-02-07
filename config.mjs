import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

export default JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'config.json'), 'utf8'));
