import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const name = process.env.INITIAL_ADMIN_NAME?.trim();
const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!name || !email || !password) {
    throw new Error(
        "Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and INITIAL_ADMIN_PASSWORD before seeding an administrator.",
    );
}

if (!databaseUrl) {
    throw new Error(
        "Set DATABASE_URL to the PostgreSQL database before seeding.",
    );
}

if (password.length < 8 || password.length > 128) {
    throw new Error(
        "INITIAL_ADMIN_PASSWORD must be between 8 and 128 characters.",
    );
}

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
});

try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
        await prisma.user.update({
            where: { id: existingUser.id },
            data: { role: "ADMIN", updatedAt: new Date() },
        });
        console.log(
            `Promoted ${email} to ADMIN. Its password was not changed.`,
        );
    } else {
        const now = new Date();
        const userId = crypto.randomUUID();

        await prisma.user.create({
            data: {
                id: userId,
                name,
                email,
                emailVerified: true,
                role: "ADMIN",
                createdAt: now,
                updatedAt: now,
                accounts: {
                    create: {
                        id: crypto.randomUUID(),
                        accountId: userId,
                        providerId: "credential",
                        password: await hashPassword(password),
                        createdAt: now,
                        updatedAt: now,
                    },
                },
            },
        });
        console.log(`Created administrator ${email}.`);
    }
} finally {
    await prisma.$disconnect();
}
