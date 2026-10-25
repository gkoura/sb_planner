"use server";

import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const MAX_ENGINEERS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateEngineerState = {
  error?: string;
  success?: string;
};

export async function createEngineer(
  _previousState: CreateEngineerState,
  formData: FormData,
): Promise<CreateEngineerState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2 || name.length > 100) {
    return { error: "Enter a name between 2 and 100 characters." };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (password.length < 8 || password.length > 128) {
    return { error: "Use a password between 8 and 128 characters." };
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.$transaction(async (transaction) => {
      const [existingUser, engineerCount] = await Promise.all([
        transaction.user.findUnique({ where: { email } }),
        transaction.user.count({ where: { role: "ENGINEER" } }),
      ]);

      if (existingUser) {
        throw new Error("An account with this email already exists.");
      }

      if (engineerCount >= MAX_ENGINEERS) {
        throw new Error("The team already has the maximum of 10 engineers.");
      }

      const now = new Date();
      const userId = crypto.randomUUID();

      await transaction.user.create({
        data: {
          id: userId,
          name,
          email,
          emailVerified: true,
          role: "ENGINEER",
          createdAt: now,
          updatedAt: now,
          accounts: {
            create: {
              id: crypto.randomUUID(),
              accountId: userId,
              providerId: "credential",
              password: passwordHash,
              createdAt: now,
              updatedAt: now,
            },
          },
        },
      });
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create the engineer account. Try again.",
    };
  }

  revalidatePath("/admin/users");
  return { success: `${name} can now sign in.` };
}
