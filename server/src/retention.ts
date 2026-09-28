import { inArray, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { miniAccountLinkRequest, session, verification } from "./db/schema";

import type { D1Database } from "@cloudflare/workers-types";

const RETENTION_GRACE_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH_SIZE = 500;

/**
 * Removes credentials and account-link requests that expired more than a day ago. Each table is
 * purged in bounded batches so one maintenance run never turns into a large D1 write.
 * Merge audits are kept.
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
  ]);
}
