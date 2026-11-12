import "dotenv/config";
import { processEmails } from "../src/modules/email/service";
import { db } from "../src/lib/db";
// One batch per invocation: use a scheduler or invoke repeatedly from a dedicated worker.
processEmails()
  .then((result) => console.log(JSON.stringify(result)))
  .catch(() => {
    console.error("Falló el lote de correo.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
