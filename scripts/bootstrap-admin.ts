import "dotenv/config";
import argon2 from "argon2";
import { createDatabase } from "../src/lib/db";
import { encryptSecret } from "../src/lib/cryptography";
import { z } from "zod";
const db = createDatabase();
async function main() {
  const input = z
    .object({
      BOOTSTRAP_USERNAME: z.string().regex(/^[a-z0-9_]{3,32}$/),
      BOOTSTRAP_PASSWORD: z.string().min(16).max(128),
      BOOTSTRAP_TOTP_SECRET: z.string().regex(/^[A-Z2-7]{32,}$/),
    })
    .parse(process.env);
  const passwordHash = await argon2.hash(input.BOOTSTRAP_PASSWORD, {
    type: argon2.argon2id,
  });
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74215801)`;
    if (await tx.adminAccount.count())
      throw new Error("Bootstrap ya ejecutado. No se crea otro SUPER_ADMIN.");
    await tx.adminAccount.create({
      data: {
        username: input.BOOTSTRAP_USERNAME,
        passwordHash,
        role: "SUPER_ADMIN",
        totpEncrypted: encryptSecret(input.BOOTSTRAP_TOTP_SECRET),
      },
    });
  });
  console.log(
    "SUPER_ADMIN creado con MFA obligatorio. Eliminá las variables BOOTSTRAP_* del entorno.",
  );
}
main()
  .catch(() => {
    console.error(
      "Bootstrap rechazado: revisá las variables, MFA y la base de datos.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
