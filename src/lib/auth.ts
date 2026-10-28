import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        // Accounts will be created by an administrator in M1.
        disableSignUp: true,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: "ENGINEER",
                input: false,
            },
            phoneNumber: {
                type: "string",
                required: false,
                input: false,
            },
        },
    },
});
