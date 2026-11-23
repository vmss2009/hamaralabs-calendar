import type { Prisma } from "@prisma/client";

// Users are public unless they've explicitly opted out via metadata.isPublic.
export function isUserPublic(metadata: Prisma.JsonValue | null | undefined): boolean {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).isPublic;
    if (typeof value === "boolean") return value;
  }
  return true;
}
