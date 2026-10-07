import { and, eq, inArray, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { miniAccountLinkRequest, publicEntityDirectory, session, verification } from "./db/schema";

import type { D1Database } from "@cloudflare/workers-types";

const RETENTION_GRACE_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH_SIZE = 500;
// D1 bills one written row per deleted directory row, so a larger batch drains the backlog faster.
const DIRECTORY_PURGE_BATCH_SIZE = 1000;
// Relations no longer record pending entities; earlier rows are removed gradually.
const RETIRED_PENDING_TYPES = ["subject", "person", "character", "chapter"] as const;

/**
 * Removes credentials and account-link requests that expired more than a day ago. Each table is
 * purged in bounded batches so one maintenance run never turns into a large D1 write.
 * Merge audits are kept. Pending directory rows discovered through relations are purged the same way.
 */
export async function purgeExpiredRecords(database: D1Database, now: Date) {
  const db = drizzle(database);
  const cutoff = new Date(now.getTime() - RETENTION_GRACE_MS);
  await db.batch([
    db
      .delete(session)
      .where(
        inArray(
          session.id,
          db
            .select({ id: session.id })
            .from(session)
            .where(lt(session.expiresAt, cutoff))
            .limit(PURGE_BATCH_SIZE),
        ),
      ),
    db
      .delete(verification)
      .where(
        inArray(
          verification.id,
          db
            .select({ id: verification.id })
            .from(verification)
            .where(lt(verification.expiresAt, cutoff))
            .limit(PURGE_BATCH_SIZE),
        ),
      ),
    db
      .delete(miniAccountLinkRequest)
      .where(
        inArray(
          miniAccountLinkRequest.tokenHash,
          db
            .select({ tokenHash: miniAccountLinkRequest.tokenHash })
            .from(miniAccountLinkRequest)
            .where(lt(miniAccountLinkRequest.expiresAt, cutoff))
            .limit(PURGE_BATCH_SIZE),
        ),
      ),
    db.delete(publicEntityDirectory).where(
      inArray(
        publicEntityDirectory.id,
        db
          .select({ id: publicEntityDirectory.id })
          .from(publicEntityDirectory)
          .where(
            and(
              inArray(publicEntityDirectory.resourceType, [...RETIRED_PENDING_TYPES]),
              eq(publicEntityDirectory.indexStatus, "pending"),
              eq(publicEntityDirectory.discoverySource, "relation"),
            ),
          )
          .limit(DIRECTORY_PURGE_BATCH_SIZE),
      ),
    ),
  ]);
}
