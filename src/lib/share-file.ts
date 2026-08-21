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

export async function shareOrDownloadImage(
  dataUrl: string,
  filename: string
): Promise<void> {
  const safeName = filename.replace(/[/\\?%*:|"<>]/g, "-");

  if (Capacitor.isNativePlatform()) {
    // Extract raw base64 data
    const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

    await Filesystem.writeFile({
      path: safeName,
      data: base64Data,
      directory: Directory.Cache,
    });

    const { uri } = await Filesystem.getUri({
      path: safeName,
      directory: Directory.Cache,
    });

    await Share.share({
      title: "RunFlow Activity Card",
      text: filename,
      url: uri,
      dialogTitle: "Compartilhar Treino",
    });
    return;
  }

  // Web fallback with Web Share API if supported for files
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], safeName, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "RunFlow Activity Card",
        text: filename,
      });
      return;
    }
  } catch {
    // Fallback to direct download
  }

  // Standard browser download
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = safeName;
  anchor.click();
}
