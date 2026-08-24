// Single Prisma client for the whole app. All DB access goes through the ORM —
// no hand-written SQL anywhere. Swap the DB in schema.prisma; this never changes.
import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient();
