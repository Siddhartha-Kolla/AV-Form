// Erzeugt einen neuen Hauptschlüssel für APP_ENCRYPTION_KEYS (Format "<id>:<base64>").
// Aufruf: npm run keygen [id]
import { randomBytes } from "node:crypto";

const id = Number(process.argv[2] ?? 1);
if (!Number.isInteger(id) || id < 1 || id > 255) {
  console.error("Die Schlüssel-ID muss eine ganze Zahl von 1 bis 255 sein.");
  process.exit(1);
}
console.log(`APP_ENCRYPTION_KEYS=${id}:${randomBytes(32).toString("base64")}`);
