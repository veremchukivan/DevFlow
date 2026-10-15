import { env } from "../../config/env.js";
import { deleteExpiredSessions } from "./auth.repository.js";

const millisecondsPerHour = 60 * 60 * 1_000;

export async function purgeExpiredSessions(now = new Date()) {
  const deletedSessions = await deleteExpiredSessions(now);
  return deletedSessions.length;
}

export function scheduleSessionCleanup() {
  const interval = setInterval(() => {
    void purgeExpiredSessions()
      .then((deletedCount) => {
        if (deletedCount > 0) {
          console.log(`Removed ${deletedCount} expired session(s)`);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to remove expired sessions", error);
      });
  }, env.SESSION_CLEANUP_INTERVAL_HOURS * millisecondsPerHour);

  interval.unref();

  return () => clearInterval(interval);
}
