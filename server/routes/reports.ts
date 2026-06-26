import { Hono } from "hono";
import { db } from "../db";
import { apiLimiter } from "../middleware/rate-limiter";

export function registerReportRoutes(app: Hono) {
  app.post("/api/reports", apiLimiter, async (c) => {
    try {
      const { ReporterID, ReportedUserID, Reason, Details } = await c.req.json();
      if (!ReporterID || !ReportedUserID || !Reason) {
        return c.json({ error: "Missing required fields: ReporterID, ReportedUserID, or Reason" }, 400);
      }

      const id = "report_" + Math.random().toString(36).substring(2, 11);
      const timestamp = new Date().toISOString();

      await db.execute({
        sql: "INSERT INTO user_reports (ID, ReporterID, ReportedUserID, Reason, Details, Timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        args: [id, ReporterID, ReportedUserID, Reason, Details || "", timestamp],
      });

      console.log(`[USER REPORT RECEIVED] Reporter: ${ReporterID} reported user: ${ReportedUserID} for ${Reason}. Details: ${Details}`);
      return c.json({ success: true, id }, 201);
    } catch (e: any) {
      console.error(e);
      return c.json({ error: e.message || "Internal server error" }, 500);
    }
  });
}
