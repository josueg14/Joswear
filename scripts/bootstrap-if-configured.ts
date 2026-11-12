import "dotenv/config";
import argon2 from "argon2";
import { z } from "zod";
import { createDatabase } from "../src/lib/db";
import { encryptSecret } from "../src/lib/cryptography";

const fields = [
  "BOOTSTRAP_USERNAME",
  "BOOTSTRAP_PASSWORD",
  "BOOTSTRAP_TOTP_SECRET",
] as const;

async function main() {
  const present = fields.filter((field) => Boolean(process.env[field]));
  if (present.length === 0) {
    console.log("Bootstrap de propietario omitido: no configurado.");
    return;
  }
  if (present.length !== fields.length) {
    throw new Error("Faltan variables de bootstrap.");
  }

  const input = z
    .object({
      BOOTSTRAP_USERNAME: z.string().regex(/^[a-z0-9_]{3,32}$/),
      BOOTSTRAP_PASSWORD: z.string().min(16).max(128),
      BOOTSTRAP_TOTP_SECRET: z.string().regex(/^[A-Z2-7]{32,}$/),
    })
    .parse(process.env);
  const db = createDatabase();

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74215801)`;
      if (await tx.adminAccount.count()) {
        console.log("Bootstrap omitido: ya existe una cuenta de administrador.");
        return;
      }

      const passwordHash = await argon2.hash(input.BOOTSTRAP_PASSWORD, {
        type: argon2.argon2id,
      });
      await tx.adminAccount.create({
        data: {
          username: input.BOOTSTRAP_USERNAME,
          passwordHash,
          role: "SUPER_ADMIN",
          totpEncrypted: encryptSecret(input.BOOTSTRAP_TOTP_SECRET),
        },
      });
      console.log("Cuenta SUPER_ADMIN inicial creada con MFA obligatorio.");
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  console.error("Bootstrap rechazado: revisa variables, MFA y conexión a la base.");
  process.exitCode = 1;
});
