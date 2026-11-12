import "dotenv/config";
import { db } from "../src/lib/db";
const days = Number(process.env.SECURITY_RETENTION_DAYS);
if (!Number.isInteger(days) || days < 7 || days > 365)
  throw new Error(
    "Definí SECURITY_RETENTION_DAYS entre 7 y 365 según la política aprobada",
  );
const before = new Date(Date.now() - days * 86400_000);
const apply = process.argv.includes("--apply");
async function main() {
  const counts = {
    loginEvents: await db.loginEvent.count({
      where: { createdAt: { lt: before } },
    }),
    customerSessions: await db.customerSession.count({
      where: { expiresAt: { lt: new Date() } },
    }),
    adminSessionMetadata: await db.adminSession.count({
      where: {
        expiresAt: { lt: before },
        OR: [{ ip: { not: null } }, { userAgent: { not: null } }],
      },
    }),
  };
  if (apply)
    await db.$transaction(async (tx) => {
      await tx.loginEvent.deleteMany({ where: { createdAt: { lt: before } } });
      await tx.customerSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      await tx.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      await tx.emailVerificationToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      await tx.adminSession.updateMany({
        where: { expiresAt: { lt: before } },
        data: { ip: null, userAgent: null },
      });
      await tx.emailJob.updateMany({
        where: {
          createdAt: { lt: before },
          status: { in: ["SENT", "FAILED"] },
        },
        data: { payload: {}, to: "redacted@invalid" },
      });
    });
  console.log(
    JSON.stringify({ mode: apply ? "applied" : "dry-run", days, counts }),
  );
}
main()
  .catch(() => {
    console.error("No se pudo ejecutar la retención.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
