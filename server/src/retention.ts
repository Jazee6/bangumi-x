import { eq, inArray, lt, notExists } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import {
  broadcastSnapshot,
  miniAccountLinkRequest,
  progress,
  session,
  verification,
} from "./db/schema";

import type { D1Database } from "@cloudflare/workers-types";

const RETENTION_GRACE_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH_SIZE = 500;
// Each deleted snapshot costs two written rows; a small hourly batch keeps the daily cost low.
const BROADCAST_PURGE_BATCH_SIZE = 100;

/**
 * Removes credentials and account-link requests that expired more than a day ago. Each table is
 * purged in bounded batches so one maintenance run never turns into a large D1 write.
 * Merge audits are kept. Broadcast snapshots of subjects nobody tracks in progress are purged the
 * same way, since only progress reads them from D1 (ADR 0014).
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
    db.delete(broadcastSnapshot).where(
      inArray(
        broadcastSnapshot.subjectId,
        db
          .select({ subjectId: broadcastSnapshot.subjectId })
          .from(broadcastSnapshot)
          .where(
            notExists(
              db
                .select({ subjectId: progress.subjectId })
                .from(progress)
                .where(eq(progress.subjectId, broadcastSnapshot.subjectId)),
            ),
          )
          .limit(BROADCAST_PURGE_BATCH_SIZE),
      ),
    ),
  ]);
}
