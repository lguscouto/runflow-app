import { ImportForm } from "@/components/ImportForm";
import { ExternalLink, Info } from "lucide-react";

export default function ImportPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-2">Importar treinos</h1>
        <p className="text-[var(--muted)]">
          Suporte a arquivos GPX e FIT — os formatos usados ao exportar do
          Amazfit/Zepp.
        </p>
      </div>

      <ImportForm />

      <section className="stat-card space-y-3 border-amber-500/30 bg-amber-500/5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Info size={20} className="text-amber-400 shrink-0" />
          Por que não sincroniza direto com a Zepp?
        </h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          A nuvem Zepp/Huami é <strong className="text-[var(--text)]">proprietária</strong>.
          Não há API pública estável para apps independentes. A API oficial (
          <a
            href="https://dev.huami.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            dev.huami.com
          </a>
          ) exige parceria empresarial; os endpoints usados por exportadores
          open source são não documentados e podem parar de funcionar a qualquer
          momento.
        </p>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          O RunFlow importa <strong className="text-[var(--text)]">arquivos GPX ou FIT</strong> —
          o método recomendado e confiável. Seus dados continuam apenas no seu
          computador.
        </p>
      </section>

      <section className="stat-card space-y-4">
        <h2 className="text-lg font-semibold">Como exportar do Amazfit</h2>
        <ol className="list-decimal list-inside space-y-3 text-[var(--muted)] text-sm leading-relaxed">
          <li>
            Instale o app <strong className="text-[var(--text)]">Zepp</strong> no
            celular e sincronize o relógio Amazfit.
          </li>
          <li>
            Use uma ferramenta open source para baixar seus treinos em GPX ou FIT,
            por exemplo{" "}
            <a
              href="https://github.com/rolandsz/Mi-Fit-and-Zepp-workout-exporter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] inline-flex items-center gap-1 hover:underline"
            >
              Mi-Fit-and-Zepp-workout-exporter
              <ExternalLink size={12} />
            </a>{" "}
            ou{" "}
            <a
              href="https://github.com/H3llK33p3r/zepp-fit-extractor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] inline-flex items-center gap-1 hover:underline"
            >
              zepp-fit-extractor
              <ExternalLink size={12} />
            </a>
            .
          </li>
          <li>
            Para essas ferramentas, obtenha o <code className="text-[var(--text)]">apptoken</code> na
            página de privacidade/GDPR (
            <a
              href="https://user.huami.com/privacy2/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              user.huami.com
            </a>
            , F12 → Rede) — veja a documentação de cada projeto.
          </li>
          <li>
            Alternativa: exporte <strong className="text-[var(--text)]">um treino por vez</strong> em
            GPX pelo próprio app Zepp (manual).
          </li>
          <li>
            Envie os arquivos <code className="text-[var(--text)]">.gpx</code> ou{" "}
            <code className="text-[var(--text)]">.fit</code> na área acima.
          </li>
        </ol>
        <p className="text-xs text-[var(--muted)] border-t border-[var(--border)] pt-4">
          A exportação GDPR da Huami geralmente não inclui atividades com GPS. Por
          isso ferramentas da comunidade ou export manual são necessárias.
        </p>
      </section>
    </div>
  );
}
