/**
 * Seed a superadmin into `usuarioslab` (PostgreSQL). Run this once after
 * `prisma db push`, from an environment where DATABASE_URL is reachable:
 *
 *   npm run seed:admin
 *
 * Configure via env (optional):
 *   ADMIN_EMAIL     (default: admin@lab.local)
 *   ADMIN_PASSWORD  (default: a strong random password, printed once)
 */
import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definido.");

  const email = process.env.ADMIN_EMAIL ?? "admin@lab.local";
  const password =
    process.env.ADMIN_PASSWORD ??
    randomBytes(18).toString("base64").replace(/[+/=]/g, "").slice(0, 18);

  const adapter = new PrismaPg({ connectionString: url });
  const db = new PrismaClient({ adapter });

  const user = await db.usuariosLab.upsert({
    where: { email },
    create: {
      email,
      name: "Super Admin",
      passwordHash: hashPassword(password),
      role: "superadmin",
    },
    update: {
      passwordHash: hashPassword(password),
      role: "superadmin",
    },
  });

  console.log("\n✅ Superadmin listo en la tabla `usuarioslab`:");
  console.log("   id:       ", user.id);
  console.log("   email:    ", email);
  console.log("   password: ", password);
  console.log("   rol:      ", user.role);
  console.log("\nGuárdalo: la contraseña no se vuelve a mostrar.\n");

  await db.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error al crear el superadmin:", e);
  process.exit(1);
});
