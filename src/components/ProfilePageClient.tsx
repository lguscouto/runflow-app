"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, User, Info, Target, Trophy, Settings } from "lucide-react";
import {
  getUserProfile,
  refreshEstimatedCalories,
  saveUserProfile,
} from "@/lib/profile";
import type { UserProfile } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export function ProfilePageClient() {
  const { t, changeLanguage } = useI18n();
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [weeklyDistanceKm, setWeeklyDistanceKm] = useState("");
  const [weeklyWorkouts, setWeeklyWorkouts] = useState("");
  const [prMinPaceDistanceKm, setPrMinPaceDistanceKm] = useState("");
  const [langSelect, setLangSelect] = useState<"pt" | "en">("pt");
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
      setLangSelect(p.language || "pt");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLangChange = async (val: "pt" | "en") => {
    setLangSelect(val);
    await changeLanguage(val);
  };

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
      language: langSelect,
    };

    if (parsed.age != null && (parsed.age < 10 || parsed.age > 120)) {
      setMessage({ type: "err", text: t("profile.val_age") });
      return;
    }
    if (
      parsed.heightCm != null &&
      (parsed.heightCm < 100 || parsed.heightCm > 250)
    ) {
      setMessage({
        type: "err",
        text: t("profile.val_height"),
      });
      return;
    }
    if (
      parsed.weightKg != null &&
      (parsed.weightKg < 30 || parsed.weightKg > 300)
    ) {
      setMessage({
        type: "err",
        text: t("profile.val_weight"),
      });
      return;
    }
    if (
      parsed.bodyFatPercent != null &&
      (parsed.bodyFatPercent < 3 || parsed.bodyFatPercent > 70)
    ) {
      setMessage({
        type: "err",
        text: t("profile.val_body_fat"),
      });
      return;
    }
    if (
      parsed.weeklyDistanceKm != null &&
      (parsed.weeklyDistanceKm <= 0 || parsed.weeklyDistanceKm > 500)
    ) {
      setMessage({
        type: "err",
        text: t("profile.val_weekly_distance"),
      });
      return;
    }
    if (
      parsed.weeklyWorkouts != null &&
      (parsed.weeklyWorkouts < 1 || parsed.weeklyWorkouts > 14)
    ) {
      setMessage({
        type: "err",
        text: t("profile.val_weekly_workouts"),
      });
      return;
    }
    if (
      parsed.prMinPaceDistanceKm != null &&
      (parsed.prMinPaceDistanceKm < 1 || parsed.prMinPaceDistanceKm > 100)
    ) {
      setMessage({
        type: "err",
        text: t("profile.val_min_pace"),
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
            ? t("profile.save_success_kcal", { count })
            : t("profile.save_success"),
      });
    } catch {
      setMessage({ type: "err", text: t("profile.save_error") });
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
        {t("common.back")}
      </Link>

      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center">
          <User size={24} className="text-[var(--accent)]" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
          <p className="text-[var(--muted)] text-sm">
            {t("profile.subtitle")}
          </p>
        </div>
      </div>

      <section className="stat-card space-y-3 border-[var(--border)]">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Info size={16} className="text-[var(--accent)]" />
          {t("profile.how_we_calculate_title")}
        </h2>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t("profile.how_we_calculate_text")}
        </p>
      </section>

      {loading ? (
        <p className="text-[var(--muted)]">{t("common.loading")}</p>
      ) : (
        <form onSubmit={handleSubmit} className="stat-card space-y-5">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">
              {t("profile.age")}
            </label>
            <input
              type="number"
              min={10}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="profile-input"
              placeholder={t("profile.age_placeholder")}
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">
              {t("profile.height")}
            </label>
            <input
              type="number"
              min={100}
              max={250}
              step={1}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="profile-input"
              placeholder={t("profile.height_placeholder")}
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">
              {t("profile.weight")}
            </label>
            <input
              type="number"
              min={30}
              max={300}
              step={0.1}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="profile-input"
              placeholder={t("profile.weight_placeholder")}
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">
              {t("profile.body_fat")}
            </label>
            <input
              type="number"
              min={3}
              max={70}
              step={0.1}
              value={bodyFatPercent}
              onChange={(e) => setBodyFatPercent(e.target.value)}
              className="profile-input"
              placeholder={t("profile.body_fat_placeholder")}
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              {t("profile.body_fat_sub")}
            </p>
          </div>

          <div className="border-t border-[var(--border)] pt-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Target size={16} className="text-[var(--accent)]" />
              {t("profile.weekly_goals")}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {t("profile.weekly_goals_sub")}
            </p>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1.5">
                {t("profile.weekly_distance")}
              </label>
              <input
                type="number"
                min={1}
                max={500}
                step={0.5}
                value={weeklyDistanceKm}
                onChange={(e) => setWeeklyDistanceKm(e.target.value)}
                className="profile-input"
                placeholder={t("profile.weekly_distance_placeholder")}
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1.5">
                {t("profile.weekly_workouts")}
              </label>
              <input
                type="number"
                min={1}
                max={14}
                value={weeklyWorkouts}
                onChange={(e) => setWeeklyWorkouts(e.target.value)}
                className="profile-input"
                placeholder={t("profile.weekly_workouts_placeholder")}
              />
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Trophy size={16} className="text-[var(--accent)]" />
              {t("profile.personal_records")}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {t("profile.personal_records_sub")}
            </p>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1.5">
                {t("profile.min_pace_distance")}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                step={0.1}
                value={prMinPaceDistanceKm}
                onChange={(e) => setPrMinPaceDistanceKm(e.target.value)}
                className="profile-input"
                placeholder={t("profile.min_pace_distance_placeholder")}
              />
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Settings size={16} className="text-[var(--accent)]" />
              {t("profile.preferences")}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {t("profile.preferences_sub")}
            </p>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1.5">
                {t("profile.language")}
              </label>
              <select
                value={langSelect}
                onChange={(e) => handleLangChange(e.target.value as "pt" | "en")}
                className="profile-input bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
              >
                <option value="pt">{t("profile.lang_pt")}</option>
                <option value="en">{t("profile.lang_en")}</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={saving}
          >
            {saving ? t("common.saving") : t("profile.save_btn")}
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
