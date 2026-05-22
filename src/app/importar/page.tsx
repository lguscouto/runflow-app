"use client";

import { ImportForm } from "@/components/ImportForm";
import { useI18n } from "@/lib/i18n";
import { ExternalLink, Info } from "lucide-react";

export default function ImportPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-2">{t("import.page_title")}</h1>
        <p className="text-[var(--muted)]">
          {t("import.subtitle")}
        </p>
      </div>

      <ImportForm />

      <section className="stat-card space-y-3 border-amber-500/30 bg-amber-500/5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Info size={20} className="text-amber-400 shrink-0" />
          {t("import.why_no_sync_title")}
        </h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          {t("import.why_no_sync_desc1_1")}
          <strong className="text-[var(--text)]">{t("import.why_no_sync_desc1_strong")}</strong>
          {t("import.why_no_sync_desc1_2")}
          <a
            href="https://dev.huami.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            dev.huami.com
          </a>
          {t("import.why_no_sync_desc1_3")}
        </p>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          {t("import.why_no_sync_desc2_1")}
          <strong className="text-[var(--text)]">{t("import.why_no_sync_desc2_strong")}</strong>
          {t("import.why_no_sync_desc2_2")}
        </p>
      </section>

      <section className="stat-card space-y-4">
        <h2 className="text-lg font-semibold">{t("import.how_to_export_title")}</h2>
        <ol className="list-decimal list-inside space-y-3 text-[var(--muted)] text-sm leading-relaxed">
          <li>
            {t("import.how_to_export_step1_1")}
            <strong className="text-[var(--text)]">{t("import.how_to_export_step1_strong")}</strong>
            {t("import.how_to_export_step1_2")}
          </li>
          <li>
            {t("import.how_to_export_step2_1")}
            <a
              href="https://github.com/rolandsz/Mi-Fit-and-Zepp-workout-exporter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] inline-flex items-center gap-1 hover:underline"
            >
              Mi-Fit-and-Zepp-workout-exporter
              <ExternalLink size={12} />
            </a>
            {t("import.how_to_export_step2_or")}
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
            {t("import.how_to_export_step3_1")}
            <code className="text-[var(--text)]">apptoken</code>
            {t("import.how_to_export_step3_2")}
            <a
              href="https://user.huami.com/privacy2/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              user.huami.com
            </a>
            {t("import.how_to_export_step3_3")}
          </li>
          <li>
            {t("import.how_to_export_step4_1")}
            <strong className="text-[var(--text)]">{t("import.how_to_export_step4_strong")}</strong>
            {t("import.how_to_export_step4_2")}
          </li>
          <li>
            {t("import.how_to_export_step5_1")}
            <code className="text-[var(--text)]">.gpx</code>
            {t("import.how_to_export_step5_or")}
            <code className="text-[var(--text)]">.fit</code>
            {t("import.how_to_export_step5_2")}
          </li>
        </ol>
        <p className="text-xs text-[var(--muted)] border-t border-[var(--border)] pt-4">
          {t("import.gdpr_warning")}
        </p>
      </section>
    </div>
  );
}

