import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DemoReport } from "./types";

const root = path.join(process.cwd(), ".data", "demo-parser");

function safeSegment(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("Invalid report identifier.");
  return value;
}

function userDirectory(userId: string) {
  return path.join(root, safeSegment(userId));
}

export async function saveReport(userId: string, report: DemoReport) {
  const directory = userDirectory(userId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${safeSegment(report.id)}.json`), JSON.stringify(report), "utf8");
}

export async function readReport(userId: string, reportId: string) {
  try {
    return JSON.parse(await readFile(path.join(userDirectory(userId), `${safeSegment(reportId)}.json`), "utf8")) as DemoReport;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteReport(userId: string, reportId: string) {
  try {
    await unlink(path.join(userDirectory(userId), `${safeSegment(reportId)}.json`));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function listReports(userId: string) {
  let files: string[];
  try {
    files = await readdir(userDirectory(userId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const reports = await Promise.all(
    files.filter((file) => /^[a-zA-Z0-9_-]+\.json$/.test(file)).map(async (file) => {
      try {
        return JSON.parse(await readFile(path.join(userDirectory(userId), file), "utf8")) as DemoReport;
      } catch {
        return null;
      }
    }),
  );
  return reports.filter((report): report is DemoReport => Boolean(report)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
