"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getUserProfile, saveUserProfile } from "@/lib/profile";
import { registerAndroidBackHandler } from "@/lib/android-back";
import { ChevronRight, ChevronLeft, Check, Languages, User, Scale, Target } from "lucide-react";

export function consumeOnboardingBack({
  show,
  step,
  onClose,
  onPrevious,
}: {
  show: boolean;
  step: number;
  onClose: () => void;
  onPrevious: () => void;
}): boolean {
  if (!show) return false;
  if (step > 1) {
    onPrevious();
  } else {
    onClose();
  }
  return true;
}

export function OnboardingWizard() {
  const { t, language, changeLanguage } = useI18n();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Step 1: Language & Name
  const [name, setName] = useState("");
  
  // Step 2: Physical metrics
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");

  // Step 3: Weekly Goals
  const [weeklyDistanceKm, setWeeklyDistanceKm] = useState("");
  const [weeklyWorkouts, setWeeklyWorkouts] = useState("");

  // Form error states
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function checkOnboarded() {
      try {
        const profile = await getUserProfile();
        // If profile doesn't exist, or doesn't have name, or onboarded is false, show wizard
        if (!profile || !profile.onboarded || !profile.name) {
          setShow(true);
          if (profile) {
            setName(profile.name || "");
            setAge(profile.age ? String(profile.age) : "");
            setHeightCm(profile.heightCm ? String(profile.heightCm) : "");
            setWeightKg(profile.weightKg ? String(profile.weightKg) : "");
            setBodyFatPercent(profile.bodyFatPercent ? String(profile.bodyFatPercent) : "");
            setWeeklyDistanceKm(profile.weeklyDistanceKm ? String(profile.weeklyDistanceKm) : "");
            setWeeklyWorkouts(profile.weeklyWorkouts ? String(profile.weeklyWorkouts) : "");
          }
        }
      } catch (err) {
        console.error("Error reading profile for onboarding:", err);
      } finally {
        setLoading(false);
      }
    }
    checkOnboarded();
  }, []);

  const backHandlerRef = useRef<() => boolean>(() => false);
  backHandlerRef.current = () =>
      consumeOnboardingBack({
        show,
        step,
        onClose: () => setShow(false),
        onPrevious: () => {
          setErrorMsg("");
          setStep((currentStep) => Math.max(1, currentStep - 1));
        },
      });

  useEffect(() => registerAndroidBackHandler(() => backHandlerRef.current()), []);

  if (loading || !show) return null;

  const validateStep = (): boolean => {
    setErrorMsg("");

    if (step === 1) {
      if (!name.trim()) {
        setErrorMsg(t("wizard.name_required"));
        return false;
      }
      if (name.trim().length < 2) {
        setErrorMsg(t("profile.val_name"));
        return false;
      }
    } else if (step === 2) {
      if (age) {
        const a = parseInt(age, 10);
        if (isNaN(a) || a < 10 || a > 120) {
          setErrorMsg(t("profile.val_age"));
          return false;
        }
      }
      if (heightCm) {
        const h = parseFloat(heightCm);
        if (isNaN(h) || h < 100 || h > 250) {
          setErrorMsg(t("profile.val_height"));
          return false;
        }
      }
      if (weightKg) {
        const w = parseFloat(weightKg);
        if (isNaN(w) || w < 30 || w > 300) {
          setErrorMsg(t("profile.val_weight"));
          return false;
        }
      }
      if (bodyFatPercent) {
        const bf = parseFloat(bodyFatPercent);
        if (isNaN(bf) || bf < 3 || bf > 70) {
          setErrorMsg(t("profile.val_body_fat"));
          return false;
        }
      }
    } else if (step === 3) {
      if (weeklyDistanceKm) {
        const d = parseFloat(weeklyDistanceKm);
        if (isNaN(d) || d <= 0 || d > 500) {
          setErrorMsg(t("profile.val_weekly_distance"));
          return false;
        }
      }
      if (weeklyWorkouts) {
        const w = parseInt(weeklyWorkouts, 10);
        if (isNaN(w) || w < 1 || w > 14) {
          setErrorMsg(t("profile.val_weekly_workouts"));
          return false;
        }
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setErrorMsg("");
    setStep((s) => s - 1);
  };

  const handleFinish = async () => {
    if (!validateStep()) return;

    try {
      const currentProfile = await getUserProfile();
      
      const payload = {
        ...currentProfile,
        name: name.trim(),
        age: age ? parseInt(age, 10) : undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        bodyFatPercent: bodyFatPercent ? parseFloat(bodyFatPercent) : undefined,
        weeklyDistanceKm: weeklyDistanceKm ? parseFloat(weeklyDistanceKm) : undefined,
        weeklyWorkouts: weeklyWorkouts ? parseInt(weeklyWorkouts, 10) : undefined,
        language: language,
        onboarded: true,
      };

      await saveUserProfile(payload);
      setShow(false);
      
      // Perform a full reload to synchronize IndexedDB state across all components/pages.
      window.location.reload();
    } catch (err) {
      console.error("Failed to complete onboarding wizard:", err);
      setErrorMsg(t("profile.save_error"));
    }
  };

  const stepsCount = 3;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col relative overflow-hidden">
        
        {/* Decorative ambient background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Wizard Header */}
        <div className="mb-6 relative">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold tracking-wider uppercase text-[var(--accent)]">
              {t("wizard.step_title", { current: step, total: stepsCount })}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-8 h-1.5 rounded-full transition-all duration-300 ${
                    s === step
                      ? "bg-[var(--accent)] w-12"
                      : s < step
                      ? "bg-[var(--accent)]/50"
                      : "bg-[var(--border)]"
                  }`}
                />
              ))}
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">
            {step === 1 && t("wizard.step1_title")}
            {step === 2 && t("wizard.step2_title")}
            {step === 3 && t("wizard.step3_title")}
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            {step === 1 && t("wizard.step1_desc")}
            {step === 2 && t("wizard.step2_desc")}
            {step === 3 && t("wizard.step3_desc")}
          </p>
        </div>

        {/* Wizard Step Content */}
        <div className="flex-1 min-h-[220px] flex flex-col justify-center py-2 relative">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg border border-[var(--color-status-danger)]/30 bg-[var(--color-status-danger)]/10 text-[var(--color-status-danger)] text-xs">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              {/* Language Selector */}
              <div>
                <span id="onboarding-language-label" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2 flex items-center gap-1.5">
                  <Languages size={14} className="text-[var(--accent)]" />
                  {t("profile.language")}
                </span>
                <div role="group" aria-labelledby="onboarding-language-label" className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={language === "pt"}
                    onClick={() => changeLanguage("pt")}
                    className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                      language === "pt"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)] font-semibold shadow-md"
                        : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--muted)]"
                    }`}
                  >
                    🇧🇷 {t("profile.lang_pt")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={language === "en"}
                    onClick={() => changeLanguage("en")}
                    className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                      language === "en"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)] font-semibold shadow-md"
                        : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--muted)]"
                    }`}
                  >
                    🇺🇸 {t("profile.lang_en")}
                  </button>
                </div>
              </div>

              {/* Name Input */}
              <div>
                <label htmlFor="onboarding-name" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2 flex items-center gap-1.5">
                  <User size={14} className="text-[var(--accent)]" />
                  {t("wizard.name_label")}
                </label>
                <input
                  id="onboarding-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("wizard.name_placeholder")}
                  className="profile-input bg-[var(--bg)] border-[var(--border)] rounded-xl py-3 px-4 text-base focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  required
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="onboarding-age" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    {t("profile.age")}
                  </label>
                  <input
                    id="onboarding-age"
                    type="number"
                    min={10}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder={t("profile.age_placeholder")}
                    className="profile-input bg-[var(--bg)] border-[var(--border)] rounded-xl py-2 px-3 text-sm focus:border-[var(--accent)] outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-height" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    {t("profile.height")}
                  </label>
                  <input
                    id="onboarding-height"
                    type="number"
                    min={100}
                    max={250}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder={t("profile.height_placeholder")}
                    className="profile-input bg-[var(--bg)] border-[var(--border)] rounded-xl py-2 px-3 text-sm focus:border-[var(--accent)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="onboarding-weight" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5 flex items-center gap-1">
                    <Scale size={13} className="text-[var(--accent)]" />
                    {t("profile.weight")}
                  </label>
                  <input
                    id="onboarding-weight"
                    type="number"
                    min={30}
                    max={300}
                    step={0.1}
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder={t("profile.weight_placeholder")}
                    className="profile-input bg-[var(--bg)] border-[var(--border)] rounded-xl py-2 px-3 text-sm focus:border-[var(--accent)] outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-body-fat" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    {t("profile.body_fat")}
                  </label>
                  <input
                    id="onboarding-body-fat"
                    type="number"
                    min={3}
                    max={70}
                    step={0.1}
                    value={bodyFatPercent}
                    onChange={(e) => setBodyFatPercent(e.target.value)}
                    placeholder={t("profile.body_fat_placeholder")}
                    className="profile-input bg-[var(--bg)] border-[var(--border)] rounded-xl py-2 px-3 text-sm focus:border-[var(--accent)] outline-none"
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--muted)] italic mt-1 leading-relaxed">
                * {t("profile.body_fat_sub")}
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="onboarding-weekly-distance" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5 flex items-center gap-1.5">
                  <Target size={14} className="text-[var(--accent)]" />
                  {t("profile.weekly_distance")}
                </label>
                <input
                  id="onboarding-weekly-distance"
                  type="number"
                  min={1}
                  max={500}
                  step={0.5}
                  value={weeklyDistanceKm}
                  onChange={(e) => setWeeklyDistanceKm(e.target.value)}
                  placeholder={t("profile.weekly_distance_placeholder")}
                  className="profile-input bg-[var(--bg)] border-[var(--border)] rounded-xl py-3 px-4 focus:border-[var(--accent)] outline-none"
                />
              </div>

              <div>
                <label htmlFor="onboarding-weekly-workouts" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5 flex items-center gap-1.5">
                  {t("profile.weekly_workouts")}
                </label>
                <input
                  id="onboarding-weekly-workouts"
                  type="number"
                  min={1}
                  max={14}
                  value={weeklyWorkouts}
                  onChange={(e) => setWeeklyWorkouts(e.target.value)}
                  placeholder={t("profile.weekly_workouts_placeholder")}
                  className="profile-input bg-[var(--bg)] border-[var(--border)] rounded-xl py-3 px-4 focus:border-[var(--accent)] outline-none"
                />
              </div>
              <p className="text-xs text-[var(--muted)] italic mt-1 leading-relaxed">
                {t("profile.weekly_goals_sub")}
              </p>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="mt-8 pt-4 border-t border-[var(--border)] flex justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="btn-ghost flex items-center gap-1.5 py-2.5 px-4 rounded-xl text-sm"
            >
              <ChevronLeft size={16} />
              {t("common.back")}
            </button>
          ) : (
            <div /> // Spacer
          )}

          {step < stepsCount ? (
            <button
              type="button"
              onClick={handleNext}
              className="btn-primary flex items-center gap-1.5 py-2.5 px-5 rounded-xl text-sm shadow-lg shadow-[var(--accent)]/15"
            >
              {t("wizard.btn_next")}
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="btn-primary flex items-center gap-1.5 py-2.5 px-5 rounded-xl text-sm shadow-lg shadow-[var(--accent)]/20 bg-emerald-600 hover:bg-emerald-500 border-none text-black font-semibold"
            >
              <Check size={16} />
              {t("wizard.btn_finish")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
