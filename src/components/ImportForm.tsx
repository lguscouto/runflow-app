"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { importWorkoutFile } from "@/lib/import-file";

export function ImportForm() {
  const router = useRouter();
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
          text: "Selecione arquivos .gpx ou .fit exportados do Amazfit/Zepp.",
        });
        return;
      }

      setLoading(true);
      setMessage(null);

      let lastId: string | null = null;
      const errors: string[] = [];

      for (const file of valid) {
        try {
          lastId = await importWorkoutFile(file);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro ao importar";
          errors.push(`${file.name}: ${msg}`);
        }
      }

      setLoading(false);

      if (errors.length > 0) {
        setMessage({ type: "err", text: errors.join(" · ") });
      } else {
        setMessage({
          type: "ok",
          text: `${valid.length} treino(s) importado(s) com sucesso!`,
        });
        if (valid.length === 1 && lastId) {
          setTimeout(
            () => router.push(`/atividades/ver/?id=${lastId}`),
            800
          );
        } else {
          setTimeout(() => router.push("/atividades/"), 800);
        }
      }
    },
    [router]
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
          Arraste arquivos GPX ou FIT aqui
        </p>
        <p className="text-[var(--muted)] text-sm mb-4 max-w-md mx-auto">
          Exporte seus treinos do relógio Amazfit com o app Zepp ou ferramentas
          open source (veja o guia abaixo) e importe aqui.
        </p>
        <label className="btn-primary cursor-pointer">
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <FileUp size={18} />
              Escolher arquivos
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
