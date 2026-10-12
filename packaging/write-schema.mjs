import { loadSchema } from '../web/server/schema.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
await writeFile(process.argv[2], JSON.stringify(await loadSchema(fileURLToPath(new URL('../danser-go', import.meta.url)))));
