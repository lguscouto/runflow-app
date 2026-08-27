"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteActivity } from "@/lib/activities";
import { useI18n } from "@/lib/i18n";

export function DeleteActivityButton({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(t("detail.confirm_delete"))) return;
    setLoading(true);
    await deleteActivity(id);
    router.push("/atividades/");
  }

  return (
    <button
      type="button"
      className="btn-ghost text-[var(--color-status-danger)] hover:text-[var(--color-status-danger)]"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 size={16} />
      {loading ? t("detail.deleting") : t("detail.delete_btn")}
    </button>
  );
}
