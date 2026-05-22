"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, User, Info, Target, Trophy } from "lucide-react";
import {
  getUserProfile,
  refreshEstimatedCalories,
  saveUserProfile,
} from "@/lib/profile";
import type { UserProfile } from "@/lib/types";

export function ProfilePageClient() {
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [weeklyDistanceKm, setWeeklyDistanceKm] = useState("");
  const [weeklyWorkouts, setWeeklyWorkouts] = useState("");
  const [prMinPaceDistanceKm, setPrMinPaceDistanceKm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = await getUserProfile();
    if (p) {
      setAge(p.age != null ? String(p.age) : "");
      setHeightCm(p.heightCm != null ? String(p.heightCm) : "");
      setWeightKg(p.weightKg != null ? String(p.weightKg) : "");
      setBodyFatPercent(
        p.bodyFatPercent != null ? String(p.bodyFatPercent) : ""
      );
      setWeeklyDistanceKm(
        p.weeklyDistanceKm != null ? String(p.weeklyDistanceKm) : ""
      );
      setWeeklyWorkouts(
        p.weeklyWorkouts != null ? String(p.weeklyWorkouts) : ""
      );
      setPrMinPaceDistanceKm(
        p.prMinPaceDistanceKm != null ? String(p.prMinPaceDistanceKm) : ""
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsed = {
      age: age ? parseInt(age, 10) : undefined,
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
      weightKg: weightKg ? parseFloat(weightKg) : undefined,
      bodyFatPercent: bodyFatPercent ? parseFloat(bodyFatPercent) : undefined,
      weeklyDistanceKm: weeklyDistanceKm
        ? parseFloat(weeklyDistanceKm)
        : undefined,
      weeklyWorkouts: weeklyWorkouts ? parseInt(weeklyWorkouts, 10) : undefined,
      prMinPaceDistanceKm: prMinPaceDistanceKm
        ? parseFloat(prMinPaceDistanceKm)
        : undefined,
    };

    if (parsed.age != null && (parsed.age < 10 || parsed.age > 120)) {
      setMessage({ type: "err", text: "Idade deve estar entre 10 e 120." });
      return;
    }
    if (
      parsed.heightCm != null &&
      (parsed.heightCm < 100 || parsed.heightCm > 250)
    ) {
      setMessage({
        type: "err",
        text: "Altura deve estar entre 100 e 250 cm.",
      });
      return;
    }
    if (
      parsed.weightKg != null &&
      (parsed.weightKg < 30 || parsed.weightKg > 300)
    ) {
      setMessage({
        type: "err",
        text: "Peso deve estar entre 30 e 300 kg.",
      });
      return;
    }
    if (
      parsed.bodyFatPercent != null &&
      (parsed.bodyFatPercent < 3 || parsed.bodyFatPercent > 70)
    ) {
      setMessage({
        type: "err",
        text: "% de gordura deve estar entre 3 e 70.",
      });
      return;
    }
    if (
      parsed.weeklyDistanceKm != null &&
      (parsed.weeklyDistanceKm <= 0 || parsed.weeklyDistanceKm > 500)
    ) {
      setMessage({
        type: "err",
        text: "Meta de distância: entre 1 e 500 km por semana.",
      });
      return;
    }
    if (
      parsed.weeklyWorkouts != null &&
      (parsed.weeklyWorkouts < 1 || parsed.weeklyWorkouts > 14)
    ) {
      setMessage({
        type: "err",
        text: "Meta de treinos: entre 1 e 14 por semana.",
      });
      return;
    }
    if (
      parsed.prMinPaceDistanceKm != null &&
      (parsed.prMinPaceDistanceKm < 1 || parsed.prMinPaceDistanceKm > 100)
    ) {
      setMessage({
        type: "err",
        text: "Distância mínima para recorde de ritmo: entre 1 e 100 km.",
      });
      return;
    }

    setSaving(true);
    try {
      await saveUserProfile(parsed);
      const count = parsed.weightKg
        ? await refreshEstimatedCalories()
        : 0;
      setMessage({
        type: "ok",
        text:
          count > 0
            ? `Perfil salvo. Calorias estimadas em ${count} treino(s).`
            : "Perfil salvo com sucesso.",
      });
    } catch {
      setMessage({ type: "err", text: "Erro ao salvar perfil." });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-8 max-w-lg">
      <Link
        href="/"
        className="text-sm text-[var(--muted)] hover:text-[var(--text)] inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>

      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center">
          <User size={24} className="text-[var(--accent)]" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Seu perfil</h1>
          <p className="text-[var(--muted)] text-sm">
            Calorias, metas semanais e dados corporais
          </p>
        </div>
      </div>

      <section className="stat-card space-y-3 border-[var(--border)]">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Info size={16} className="text-[var(--accent)]" />
          Como calculamos
        </h2>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Usamos a fórmula MET (equivalente metabólico) com seu peso — ou massa
          magra, se informar o % de gordura —, duração, tipo de atividade e
          ritmo médio. Altura e idade ficam registradas para evoluções futuras.
          Se o treino já trouxer calorias do relógio (FIT), esse valor é
          mantido.
        </p>
      </section>

      {loading ? (
        <p className="text-[var(--muted)]">Carregando...</p>
      ) : (
        <form onSubmit={handleSubmit} className="stat-card space-y-5">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">
              Idade (anos)
            </label>
            <input
              type="number"
              min={10}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="profile-input"
              placeholder="Ex.: 32"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">
              Altura (cm)
            </label>
            <input
              type="number"
              min={100}
              max={250}
              step={1}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="profile-input"
              placeholder="Ex.: 175"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">
              Peso (kg)
            </label>
            <input
              type="number"
              min={30}
              max={300}
              step={0.1}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="profile-input"
              placeholder="Ex.: 72.5 (calorias)"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">
              Gordura corporal (%)
            </label>
            <input
              type="number"
              min={3}
              max={70}
              step={0.1}
              value={bodyFatPercent}
              onChange={(e) => setBodyFatPercent(e.target.value)}
              className="profile-input"
              placeholder="Ex.: 18 (opcional)"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              Opcional. Melhora a estimativa usando massa magra.
            </p>
          </div>

          <div className="border-t border-[var(--border)] pt-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Target size={16} className="text-[var(--accent)]" />
              Metas da semana
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Semana de segunda a domingo. Progresso na tela inicial.
            </p>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1.5">
                Distância por semana (km)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                step={0.5}
                value={weeklyDistanceKm}
                onChange={(e) => setWeeklyDistanceKm(e.target.value)}
                className="profile-input"
                placeholder="Ex.: 20"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1.5">
                Treinos por semana
              </label>
              <input
                type="number"
                min={1}
                max={14}
                value={weeklyWorkouts}
                onChange={(e) => setWeeklyWorkouts(e.target.value)}
                className="profile-input"
                placeholder="Ex.: 3"
              />
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Trophy size={16} className="text-[var(--accent)]" />
              Recordes Pessoais
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Configurações para determinação dos seus recordes pessoais.
            </p>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1.5">
                Distância mínima para recorde de ritmo (km)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                step={0.1}
                value={prMinPaceDistanceKm}
                onChange={(e) => setPrMinPaceDistanceKm(e.target.value)}
                className="profile-input"
                placeholder="Padrão: 5"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </form>
      )}

      {message && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
            message.type === "ok"
              ? "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {message.type === "ok" && (
            <CheckCircle size={18} className="shrink-0 mt-0.5" />
          )}
          <p>{message.text}</p>
        </div>
      )}
    </div>
  );
}
