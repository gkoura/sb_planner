"use server";

import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import { parseOptionalPhoneNumber } from "@/lib/phone-number";
import { prisma } from "@/lib/prisma";

const MAX_ENGINEERS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateEngineerState = {
  error?: string;
  success?: string;
};

export type ChangeUserRoleState = {
  error?: string;
  success?: string;
};

export async function changeUserRole(
  _previousState: ChangeUserRoleState,
  formData: FormData,
): Promise<ChangeUserRoleState> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!userId || userId.length > 200 || !["ADMIN", "ENGINEER"].includes(role)) {
    return { error: "Choose a valid team member and role." };
  }
  if (userId === session.user.id) {
    return { error: "Ask another admin to change your admin access." };
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true },
      });
      if (!target) return { error: "That account no longer exists." };
      if (target.role === role)
        return { success: `${target.name} already has that access.` };

      if (target.role === "ADMIN" && role === "ENGINEER") {
        const adminCount = await transaction.user.count({
          where: { role: "ADMIN" },
        });
        if (adminCount <= 1)
          return {
            error:
              "Promote another team member before removing the last admin.",
          };
      }

      await transaction.user.update({
        where: { id: target.id },
        data: { role },
      });
      return {
        success:
          role === "ADMIN"
            ? `${target.name} is now an admin and can manage schedules and team access.`
            : `${target.name} is now an engineer.`,
      };
    });

    if (result.error) return result;
    revalidatePath("/");
    revalidatePath("/admin/users");
    return result;
  } catch {
    return { error: "Unable to update team access. Try again." };
  }
}

export async function createEngineer(
  _previousState: CreateEngineerState,
  formData: FormData,
): Promise<CreateEngineerState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const { phoneNumber, valid: validPhone } = parseOptionalPhoneNumber(
    String(formData.get("phoneNumber") ?? ""),
  );

  if (name.length < 2 || name.length > 100) {
    return { error: "Enter a name between 2 and 100 characters." };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (password.length < 8 || password.length > 128) {
    return { error: "Use a password between 8 and 128 characters." };
  }

  if (!validPhone) {
    return {
      error:
        "Enter an international number, including the country code (for example, +306912345678).",
    };
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
          phoneNumber,
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
