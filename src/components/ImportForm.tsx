"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { importWorkoutFiles } from "@/lib/import-file";
import { useI18n } from "@/lib/i18n";

export function ImportForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      const valid = list.filter((f) => /\.(gpx|fit)$/i.test(f.name));

      if (valid.length === 0) {
        setMessage({
          type: "err",
          text: t("import.val_files"),
        });
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const result = await importWorkoutFiles(valid);
        setLoading(false);

        if (result.merged) {
          setMessage({
            type: "ok",
            text: t("import.success_merged"),
          });
        } else {
          setMessage({
            type: "ok",
            text: t("import.success", { count: result.count }),
          });
        }

        if (result.lastId) {
          setTimeout(
            () => router.push(`/atividades/ver/?id=${result.lastId}`),
            800
          );
        } else {
          setTimeout(() => router.push("/atividades/"), 800);
        }
      } catch (err) {
        setLoading(false);
        const msg = err instanceof Error ? err.message : t("common.error");
        setMessage({
          type: "err",
          text: msg,
        });
      }
    },
    [router, t]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) {
        upload(e.dataTransfer.files);
      }
    },
    [upload]
  );

  return (
    <div className="space-y-6">
      <div
        className={`drop-zone ${dragging ? "active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <FileUp className="mx-auto mb-4 text-[var(--accent)]" size={48} />
        <p className="text-lg font-medium mb-2">
          {t("import.drag_gpx_fit")}
        </p>
        <p className="text-[var(--muted)] text-sm mb-4 max-w-md mx-auto">
          {t("import.guide")}
        </p>
        <label className="btn-primary cursor-pointer">
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {t("import.importing")}
            </>
          ) : (
            <>
              <FileUp size={18} />
              {t("import.choose_files")}
            </>
          )}
          <input
            type="file"
            accept=".gpx,.fit,application/gpx+xml,application/octet-stream"
            multiple
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
            }}
          />
        </label>
      </div>

      {message && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            message.type === "ok"
              ? "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {message.type === "ok" ? (
            <CheckCircle size={20} className="shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{message.text}</p>
        </div>
      )}
    </div>
  );
}
