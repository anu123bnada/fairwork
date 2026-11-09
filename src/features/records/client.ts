import { appRequest } from "@/features/authority/client";
import { recordDocument, recordList, recordSaved, type RecordDocument, type RecordKind, type RecordSummary } from "./schema";

// Browser-side calls to the personal-records API. Every answer is validated again before the screen uses it.
export async function listRecordsOf(kind: RecordKind): Promise<RecordSummary[]> {
  return recordList.parse(await appRequest(`/api/v1/records?kind=${kind}`)).items;
}
export async function readRecordById(id: string): Promise<RecordDocument> {
  return recordDocument.parse(await appRequest(`/api/v1/records?id=${id}`));
}
export async function saveRecordBody(body: Record<string, unknown>): Promise<{ id: string; revision: number }> {
  return recordSaved.parse(await appRequest("/api/v1/records", body));
}
export async function removeRecordById(id: string): Promise<void> { await appRequest("/api/v1/records/remove", { id }); }
