import { readFile, writeFile } from "node:fs/promises";
export async function readfileFrompath(filePath: string, p0?: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    throw err;
  }
}
export async function writeFileToPath(filePath: string, data: string, p0?: string): Promise<void>{
  try {
    await writeFile(filePath, data, "utf-8");
  } catch (err) {
    console.error(`Error writing file ${filePath}:`, err);
    throw err;
  }
}