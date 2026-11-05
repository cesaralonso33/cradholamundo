import { readSheet } from "read-excel-file/node";

export async function readExcelRows(file: any): Promise<any[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of file.file) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  const rows = await readSheet(buffer);
  if (!rows.length) return [];

  const headers = rows[0].map((value) => String(value ?? "").trim());
  const result: Record<string, any>[] = [];

  for (const row of rows.slice(1)) {
    if (!row.some((value) => value !== null && value !== undefined && String(value).trim() !== "")) continue;
    const record: Record<string, any> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = row[index] ?? "";
    });
    if (Object.keys(record).length) result.push(record);
  }

  return result;
}
