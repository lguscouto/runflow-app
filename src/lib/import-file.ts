import { parseGpx } from "./parsers/gpx";
import { parseFit } from "./parsers/fit";
import { saveActivity } from "./activities";

export async function importWorkoutFile(file: File): Promise<string> {
  const fileName = file.name;
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "gpx" || fileName.toLowerCase().endsWith(".gpx")) {
    const text = await file.text();
    const parsed = parseGpx(text, fileName);
    return saveActivity(parsed, "gpx", fileName);
  }

  if (ext === "fit" || fileName.toLowerCase().endsWith(".fit")) {
    const buffer = await file.arrayBuffer();
    const parsed = await parseFit(buffer, fileName);
    return saveActivity(parsed, "fit", fileName);
  }

  throw new Error("Formato não suportado. Use .gpx ou .fit");
}
