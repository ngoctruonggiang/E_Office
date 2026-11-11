/**
 * Domain representation of a user. Mirrors the Prisma `User` model but is kept
 * separate so the rest of the app does not depend on Prisma's generated types
 * directly (and so `passwordHash` can be stripped before crossing boundaries).
 */
export class UserEntity {
  id!: string;
  email!: string;
  passwordHash!: string;
  displayName!: string | null;
  role!: string;
  isActive!: boolean;
  signatureName!: string | null;
  signatureImage!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
