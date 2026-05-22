"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteActivity } from "@/lib/activities";

export function DeleteActivityButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Excluir este treino permanentemente?")) return;
    setLoading(true);
    await deleteActivity(id);
    router.push("/atividades/");
  }

  return (
    <button
      type="button"
      className="btn-ghost text-red-400 hover:text-red-300"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 size={16} />
      {loading ? "Excluindo..." : "Excluir"}
    </button>
  );
}
