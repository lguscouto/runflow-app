import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export async function shareOrDownloadFile(
  content: string,
  filename: string,
  mimeType = "application/gpx+xml"
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const safeName = filename.replace(/[/\\?%*:|"<>]/g, "-");
    await Filesystem.writeFile({
      path: safeName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    const { uri } = await Filesystem.getUri({
      path: safeName,
      directory: Directory.Cache,
    });

    await Share.share({
      title: "Exportar treino RunFlow",
      text: filename,
      url: uri,
      dialogTitle: "Compartilhar GPX",
    });
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
