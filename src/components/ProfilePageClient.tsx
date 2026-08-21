"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  User,
  Info,
  Target,
  Trophy,
  Settings,
  Plus,
  Trash2,
  Archive,
  RotateCcw,
  Award,
  Database,
  RefreshCw,
  Heart,
  Zap,
  Headphones,
  PauseCircle,
} from "lucide-react";
import {
  getUserProfile,
  refreshEstimatedCalories,
  saveUserProfile,
} from "@/lib/profile";
import { calculateTanakaMaxHr } from "@/lib/hr-zones";
import type { UserProfile, Gear, ActivitySummary, VoiceCoachConfig, AutoPauseConfig } from "@/lib/types";
import { DEFAULT_VOICE_COACH_CONFIG } from "@/lib/voice-coach";
import { DEFAULT_AUTO_PAUSE_CONFIG } from "@/lib/auto-pause";
import { VoiceCoachModal } from "@/components/VoiceCoachModal";
import { AutoPauseModal } from "@/components/AutoPauseModal";
import { useI18n } from "@/lib/i18n";
import { listGearWithUsage, setDefaultGear, type GearWithUsage } from "@/lib/gear";
import { putGear, removeGear, getAllStoredActivities } from "@/lib/storage";
import { calculateAchievements, type Achievement } from "@/lib/achievements";
import { v4 as uuidv4 } from "uuid";
import { exportBackup, importBackup } from "@/lib/backup";
import { SyncPanel } from "@/components/SyncPanel";

export function ProfilePageClient() {
  const { t, language } = useI18n();

  // Tab State
  const [activeTab, setActiveTab] = useState<"profile" | "gear" | "achievements" | "backup" | "sync">("profile");

  // Profile Form States
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [weeklyDistanceKm, setWeeklyDistanceKm] = useState("");
  const [weeklyWorkouts, setWeeklyWorkouts] = useState("");
  const [prMinPaceDistanceKm, setPrMinPaceDistanceKm] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [langSelect, setLangSelect] = useState<"pt" | "en">("pt");
  const [voiceCoachConfig, setVoiceCoachConfig] = useState<VoiceCoachConfig>(DEFAULT_VOICE_COACH_CONFIG);
  const [isVoiceCoachModalOpen, setIsVoiceCoachModalOpen] = useState(false);
  const [autoPauseConfig, setAutoPauseConfig] = useState<AutoPauseConfig>(DEFAULT_AUTO_PAUSE_CONFIG);
  const [isAutoPauseModalOpen, setIsAutoPauseModalOpen] = useState(false);
  const { changeLanguage } = useI18n();

  // Common UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Gear States
  const [gears, setGears] = useState<GearWithUsage[]>([]);
  const [showAddGearForm, setShowAddGearForm] = useState(false);
  const [gearName, setGearName] = useState("");
  const [gearBrand, setGearBrand] = useState("");
  const [gearInitialDistanceKm, setGearInitialDistanceKm] = useState("");
  const [gearMaxDistanceKm, setGearMaxDistanceKm] = useState("");

  // Achievements States
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [profile, setProfile] = useState<UserProfile | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getUserProfile();
      setProfile(p || undefined);
      if (p) {
        setName(p.name || "");
        setAge(p.age != null ? String(p.age) : "");
        setHeightCm(p.heightCm != null ? String(p.heightCm) : "");
        setWeightKg(p.weightKg != null ? String(p.weightKg) : "");
        setBodyFatPercent(p.bodyFatPercent != null ? String(p.bodyFatPercent) : "");
        setWeeklyDistanceKm(p.weeklyDistanceKm != null ? String(p.weeklyDistanceKm) : "");
        setWeeklyWorkouts(p.weeklyWorkouts != null ? String(p.weeklyWorkouts) : "");
        setPrMinPaceDistanceKm(p.prMinPaceDistanceKm != null ? String(p.prMinPaceDistanceKm) : "");
        setMaxHr(p.maxHr != null ? String(p.maxHr) : "");
        setRestingHr(p.restingHr != null ? String(p.restingHr) : "");
        setLangSelect(p.language || "pt");
        if (p.voiceCoach) {
          setVoiceCoachConfig(p.voiceCoach);
        }
        if (p.autoPause) {
          setAutoPauseConfig(p.autoPause);
        }
      }

      // Load Gear and Activities
      const [gearList, acts] = await Promise.all([
        listGearWithUsage(),
        getAllStoredActivities(),
      ]);
      setGears(gearList);
      setActivities(acts);

      // Compute Achievements
      const achs = calculateAchievements(acts, p || undefined, p?.language || "pt");
      setAchievements(achs);
    } catch (err) {
      console.error("Failed to load profile resources:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshData = async () => {
    try {
      const p = await getUserProfile();
      setProfile(p || undefined);
      const [gearList, acts] = await Promise.all([
        listGearWithUsage(),
        getAllStoredActivities(),
      ]);
      setGears(gearList);
      setActivities(acts);
      const achs = calculateAchievements(acts, p || undefined, p?.language || "pt");
      setAchievements(achs);
    } catch (err) {
      console.error("Failed to refresh profile data:", err);
    }
  };

  const handleLangChange = async (val: "pt" | "en") => {
    setLangSelect(val);
    await changeLanguage(val);
    await refreshData();
  };

  const handleExportBackup = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      await exportBackup();
    } catch (err) {
      console.error("Backup export failed", err);
      setMessage({ type: "err", text: t("common.error") });
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmImport = window.confirm(t("backup.import_confirm"));
    if (!confirmImport) {
      e.target.value = "";
      return;
    }

    setActionLoading(true);
    setMessage(null);

    try {
      const text = await file.text();
      const res = await importBackup(text);
      
      setMessage({
        type: "ok",
        text: t("backup.import_success", {
          activities: res.activitiesCount,
          gear: res.gearCount,
        }),
      });

      await refreshData();
    } catch (err: any) {
      console.error("Backup import failed", err);
      if (err.message === "invalid_json" || err.message === "invalid_backup_format") {
        setMessage({ type: "err", text: t("backup.import_invalid") });
      } else {
        setMessage({ type: "err", text: t("backup.import_error") });
      }
    } finally {
      setActionLoading(false);
      e.target.value = "";
    }
  };

  const handleCalcTanaka = () => {
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 10 || ageNum > 120) {
      setMessage({ type: "err", text: t("profile.calc_tanaka_need_age") });
      return;
    }
    const calcMax = calculateTanakaMaxHr(ageNum);
    setMaxHr(String(calcMax));
    setMessage({ type: "ok", text: `${t("profile.max_hr")}: ${calcMax} bpm (${t("profile.calc_tanaka_btn")})` });
  };

  async function handleSubmitProfile(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const currentProfile = await getUserProfile();
    const parsed = {
      ...currentProfile,
      name: name.trim(),
      age: age ? parseInt(age, 10) : undefined,
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
      weightKg: weightKg ? parseFloat(weightKg) : undefined,
      bodyFatPercent: bodyFatPercent ? parseFloat(bodyFatPercent) : undefined,
      weeklyDistanceKm: weeklyDistanceKm ? parseFloat(weeklyDistanceKm) : undefined,
      weeklyWorkouts: weeklyWorkouts ? parseInt(weeklyWorkouts, 10) : undefined,
      prMinPaceDistanceKm: prMinPaceDistanceKm ? parseFloat(prMinPaceDistanceKm) : undefined,
      maxHr: maxHr ? parseInt(maxHr, 10) : undefined,
      restingHr: restingHr ? parseInt(restingHr, 10) : undefined,
      language: langSelect,
      voiceCoach: voiceCoachConfig,
      autoPause: autoPauseConfig,
    };

    if (!parsed.name || parsed.name.length < 2) {
      setMessage({ type: "err", text: t("profile.val_name") });
      return;
    }
    if (parsed.age != null && (parsed.age < 10 || parsed.age > 120)) {
      setMessage({ type: "err", text: t("profile.val_age") });
      return;
    }
    if (parsed.heightCm != null && (parsed.heightCm < 100 || parsed.heightCm > 250)) {
      setMessage({ type: "err", text: t("profile.val_height") });
      return;
    }
    if (parsed.weightKg != null && (parsed.weightKg < 30 || parsed.weightKg > 300)) {
      setMessage({ type: "err", text: t("profile.val_weight") });
      return;
    }
    if (parsed.bodyFatPercent != null && (parsed.bodyFatPercent < 3 || parsed.bodyFatPercent > 70)) {
      setMessage({ type: "err", text: t("profile.val_body_fat") });
      return;
    }
    if (parsed.weeklyDistanceKm != null && (parsed.weeklyDistanceKm <= 0 || parsed.weeklyDistanceKm > 500)) {
      setMessage({ type: "err", text: t("profile.val_weekly_distance") });
      return;
    }
    if (parsed.weeklyWorkouts != null && (parsed.weeklyWorkouts < 1 || parsed.weeklyWorkouts > 14)) {
      setMessage({ type: "err", text: t("profile.val_weekly_workouts") });
      return;
    }
    if (parsed.prMinPaceDistanceKm != null && (parsed.prMinPaceDistanceKm < 1 || parsed.prMinPaceDistanceKm > 100)) {
      setMessage({ type: "err", text: t("profile.val_min_pace") });
      return;
    }
    if (parsed.maxHr != null && (parsed.maxHr < 100 || parsed.maxHr > 240)) {
      setMessage({ type: "err", text: t("profile.val_max_hr") });
      return;
    }
    if (parsed.restingHr != null && (parsed.restingHr < 30 || parsed.restingHr > 120)) {
      setMessage({ type: "err", text: t("profile.val_resting_hr") });
      return;
    }

    setSaving(true);
    try {
      await saveUserProfile(parsed);
      const count = parsed.weightKg ? await refreshEstimatedCalories() : 0;
      setMessage({
        type: "ok",
        text: count > 0 ? t("profile.save_success_kcal", { count }) : t("profile.save_success"),
      });
      await refreshData();
    } catch {
      setMessage({ type: "err", text: t("profile.save_error") });
    }
    setSaving(false);
  }

  // Gear Handlers
  async function handleAddGear(e: React.FormEvent) {
    e.preventDefault();
    if (!gearName.trim()) return;

    const initialKm = parseFloat(gearInitialDistanceKm) || 0;
    const maxKm = parseFloat(gearMaxDistanceKm) || 800;

    const newGear: Gear = {
      id: uuidv4(),
      name: gearName.trim(),
      brand: gearBrand.trim() || undefined,
      initialDistanceM: initialKm * 1000,
      maxDistanceM: maxKm * 1000,
      status: "active",
      isDefault: gears.length === 0, // Auto-default if first gear
      createdAt: new Date().toISOString(),
    };

    try {
      await putGear(newGear);
      setGearName("");
      setGearBrand("");
      setGearInitialDistanceKm("");
      setGearMaxDistanceKm("");
      setShowAddGearForm(false);
      setMessage({ type: "ok", text: t("gear.success_add") });
      await refreshData();
    } catch (err) {
      console.error(err);
      setMessage({ type: "err", text: t("common.error") });
    }
  }

  async function handleSetDefaultGear(id: string) {
    try {
      await setDefaultGear(id);
      setMessage({ type: "ok", text: t("gear.success_update") });
      await refreshData();
    } catch (err) {
      console.error(err);
      setMessage({ type: "err", text: t("common.error") });
    }
  }

  async function handleToggleGearStatus(gear: Gear) {
    try {
      const updated: Gear = {
        ...gear,
        status: gear.status === "active" ? "retired" : "active",
        isDefault: gear.status === "active" ? false : gear.isDefault,
      };
      await putGear(updated);
      setMessage({ type: "ok", text: t("gear.success_update") });
      await refreshData();
    } catch (err) {
      console.error(err);
      setMessage({ type: "err", text: t("common.error") });
    }
  }

  async function handleDeleteGear(id: string) {
    if (confirm(t("common.confirm") + "?")) {
      try {
        await removeGear(id);
        setMessage({ type: "ok", text: t("gear.success_delete") });
        await refreshData();
      } catch (err) {
        console.error(err);
        setMessage({ type: "err", text: t("common.error") });
      }
    }
  }

  return (
    <div className={`space-y-8 transition-all duration-300 w-full ${activeTab === "profile" || activeTab === "backup" ? "max-w-lg" : "max-w-2xl"}`}>
      <Link
        href="/"
        className="text-sm text-[var(--muted)] hover:text-[var(--text)] inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} />
        {t("common.back")}
      </Link>

      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center">
          {activeTab === "profile" && <User size={24} className="text-[var(--accent)]" />}
          {activeTab === "gear" && <Award size={24} className="text-[var(--accent)]" />}
          {activeTab === "achievements" && <Trophy size={24} className="text-[var(--accent)]" />}
          {activeTab === "backup" && <Database size={24} className="text-[var(--accent)]" />}
          {activeTab === "sync" && <RefreshCw size={24} className="text-[var(--accent)]" />}
        </span>
        <div>
          <h1 className="text-2xl font-bold">
            {activeTab === "profile" && t("profile.title")}
            {activeTab === "gear" && t("gear.title")}
            {activeTab === "achievements" && t("achievements.title")}
            {activeTab === "backup" && t("backup.title")}
            {activeTab === "sync" && t("sync.title")}
          </h1>
          <p className="text-[var(--muted)] text-sm">
            {activeTab === "profile" && t("profile.subtitle")}
            {activeTab === "gear" && t("gear.subtitle")}
            {activeTab === "achievements" && t("achievements.subtitle")}
            {activeTab === "backup" && t("backup.subtitle")}
            {activeTab === "sync" && t("sync.subtitle")}
          </p>
        </div>
      </div>

      {/* Tabs Menu — grid compacto em mobile para caber todas as 5 tabs */}
      <div className="grid grid-cols-5 border-b border-[var(--border)]">
        {([
          { key: "profile" as const, icon: <User size={16} />, label: t("profile.tab_details") },
          { key: "gear" as const, icon: <Award size={16} />, label: t("profile.tab_gear") },
          { key: "achievements" as const, icon: <Trophy size={16} />, label: t("profile.tab_achievements") },
          { key: "backup" as const, icon: <Database size={16} />, label: t("profile.tab_backup") },
          { key: "sync" as const, icon: <RefreshCw size={16} />, label: t("profile.tab_sync") },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setMessage(null);
            }}
            className={`flex flex-col items-center gap-1 py-2.5 px-1 text-[11px] sm:text-sm font-semibold border-b-2 transition-all leading-tight text-center ${
              activeTab === tab.key
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab.icon}
            <span className="truncate w-full">{tab.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[var(--muted)]">{t("common.loading")}</p>
      ) : (
        <>
          {/* TAB 1: Profile Details */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <section className="stat-card space-y-3 border-[var(--border)]">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Info size={16} className="text-[var(--accent)]" />
                  {t("profile.how_we_calculate_title")}
                </h2>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {t("profile.how_we_calculate_text")}
                </p>
              </section>

              <form onSubmit={handleSubmitProfile} className="stat-card space-y-5">
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1.5">
                    {t("profile.name")}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="profile-input"
                    placeholder={t("profile.name_placeholder")}
                    required
                  />
                </div>

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
                    <Heart size={16} className="text-rose-500" />
                    {t("profile.heart_rate")}
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    {t("profile.heart_rate_sub")}
                  </p>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm text-[var(--muted)]">
                        {t("profile.max_hr")}
                      </label>
                      <button
                        type="button"
                        onClick={handleCalcTanaka}
                        className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
                      >
                        <Zap size={12} />
                        {t("profile.calc_tanaka_btn")}
                      </button>
                    </div>
                    <input
                      type="number"
                      min={100}
                      max={240}
                      step={1}
                      value={maxHr}
                      onChange={(e) => setMaxHr(e.target.value)}
                      className="profile-input"
                      placeholder={t("profile.max_hr_placeholder")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1.5">
                      {t("profile.resting_hr")}
                    </label>
                    <input
                      type="number"
                      min={30}
                      max={120}
                      step={1}
                      value={restingHr}
                      onChange={(e) => setRestingHr(e.target.value)}
                      className="profile-input"
                      placeholder={t("profile.resting_hr_placeholder")}
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
                      <option value="pt">🇧🇷 {t("profile.lang_pt")}</option>
                      <option value="en">🇺🇸 {t("profile.lang_en")}</option>
                    </select>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          voiceCoachConfig.enabled
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        <Headphones size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {t("voice_coach.title")}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {voiceCoachConfig.enabled
                            ? voiceCoachConfig.triggerType === "distance"
                              ? `${t("voice_coach.trigger_distance")}: ${
                                  voiceCoachConfig.distanceIntervalM < 1000
                                    ? `${voiceCoachConfig.distanceIntervalM} m`
                                    : `${voiceCoachConfig.distanceIntervalM / 1000} km`
                                }`
                              : `${t("voice_coach.trigger_time")}: ${
                                  voiceCoachConfig.timeIntervalSec / 60
                                } min`
                            : t("voice_coach.enable_desc")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsVoiceCoachModalOpen(true)}
                      className="btn-ghost text-xs py-1.5 px-3 border border-[var(--border)] hover:border-[var(--accent)] text-[var(--accent)] font-semibold shrink-0"
                    >
                      ⚙️ {t("voice_coach.voice_settings")}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          autoPauseConfig.enabled
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "bg-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        <PauseCircle size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {t("auto_pause.title")}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {autoPauseConfig.enabled
                            ? `${autoPauseConfig.minSpeedKmh} km/h · ${autoPauseConfig.pauseDelaySec}s`
                            : t("auto_pause.enable_desc")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAutoPauseModalOpen(true)}
                      className="btn-ghost text-xs py-1.5 px-3 border border-[var(--border)] hover:border-amber-500 text-amber-400 font-semibold shrink-0"
                    >
                      ⚙️ Ajustes Auto-Pause
                    </button>
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
            </div>
          )}

          {/* TAB 2: Gear Management */}
          {activeTab === "gear" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">{t("gear.title")}</h2>
                <button
                  onClick={() => setShowAddGearForm(!showAddGearForm)}
                  className="btn-primary py-2 px-3 text-xs"
                >
                  {showAddGearForm ? t("common.cancel") : (
                    <>
                      <Plus size={14} />
                      {t("gear.add_btn")}
                    </>
                  )}
                </button>
              </div>

              {showAddGearForm && (
                <form onSubmit={handleAddGear} className="stat-card space-y-4 border-[var(--accent)]/40 bg-[var(--surface-hover)]">
                  <h3 className="font-bold text-sm">{t("gear.add_btn")}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">
                        {t("gear.name")} *
                      </label>
                      <input
                        type="text"
                        required
                        value={gearName}
                        onChange={(e) => setGearName(e.target.value)}
                        placeholder={t("gear.name_placeholder")}
                        className="profile-input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">
                        {t("gear.brand")}
                      </label>
                      <input
                        type="text"
                        value={gearBrand}
                        onChange={(e) => setGearBrand(e.target.value)}
                        placeholder={t("gear.brand_placeholder")}
                        className="profile-input text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">
                        {t("gear.initial_distance")}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={gearInitialDistanceKm}
                        onChange={(e) => setGearInitialDistanceKm(e.target.value)}
                        placeholder="0.0"
                        className="profile-input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">
                        {t("gear.max_distance")}
                      </label>
                      <input
                        type="number"
                        min={100}
                        step={50}
                        value={gearMaxDistanceKm}
                        onChange={(e) => setGearMaxDistanceKm(e.target.value)}
                        placeholder="800"
                        className="profile-input text-sm"
                      />
                      <span className="text-[10px] text-[var(--muted)] block mt-0.5">
                        {t("gear.max_distance_sub")}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddGearForm(false)}
                      className="btn-ghost py-1.5 px-3 text-xs"
                    >
                      {t("common.cancel")}
                    </button>
                    <button type="submit" className="btn-primary py-1.5 px-3 text-xs">
                      {t("common.save")}
                    </button>
                  </div>
                </form>
              )}

              {gears.length === 0 ? (
                <div className="stat-card text-center py-8 text-[var(--muted)]">
                  <p>{t("gear.no_data")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {gears.map((g) => {
                    const maxM = g.maxDistanceM || 800000;
                    const wearPercentage = Math.min(100, Math.round((g.accumulatedDistanceM / maxM) * 100));
                    const wearExceeded = g.accumulatedDistanceM >= maxM;

                    return (
                      <div
                        key={g.id}
                        className={`stat-card flex flex-col gap-4 border transition-all ${
                          g.status === "retired"
                            ? "opacity-60 border-[var(--border)] bg-[var(--surface)]/50"
                            : g.isDefault
                            ? "border-[var(--accent)] bg-[var(--surface-hover)] shadow-md"
                            : "border-[var(--border)]"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base">{g.name}</h4>
                              {g.brand && (
                                <span className="text-xs px-2 py-0.5 rounded bg-[var(--border)] text-[var(--muted)] font-medium">
                                  {g.brand}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-[var(--muted)] mt-0.5">
                              {t("gear.initial")}: {(g.initialDistanceM / 1000).toFixed(1)} km
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {g.isDefault && g.status === "active" && (
                              <span className="text-xs bg-[var(--accent-soft)] text-[var(--accent)] px-2 py-0.5 rounded-full font-semibold border border-[var(--accent)]/30">
                                {t("gear.default")}
                              </span>
                            )}
                            <span
                              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                g.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}
                            >
                              {g.status === "active" ? t("gear.status_active") : t("gear.status_retired")}
                            </span>
                          </div>
                        </div>

                        {/* Wear progression bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--muted)] font-medium">
                              {t("gear.wear")} ({wearPercentage}%)
                            </span>
                            <span className={`font-semibold ${wearExceeded ? "text-red-400" : "text-[var(--text)]"}`}>
                              {(g.accumulatedDistanceM / 1000).toFixed(1)} / {(maxM / 1000).toFixed(0)} km
                            </span>
                          </div>
                          <div className="w-full bg-[var(--bg)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                            <div
                              style={{ width: `${wearPercentage}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${
                                wearExceeded ? "bg-red-500" : wearPercentage >= 80 ? "bg-amber-500" : "bg-[var(--accent)]"
                              }`}
                            />
                          </div>
                        </div>

                        {/* Gear Actions */}
                        <div className="flex justify-between items-center border-t border-[var(--border)] pt-3 mt-1">
                          <div className="flex gap-2">
                            {g.status === "active" && !g.isDefault && (
                              <button
                                onClick={() => handleSetDefaultGear(g.id)}
                                className="btn-ghost py-1 px-2.5 text-xs inline-flex items-center gap-1"
                              >
                                {t("gear.set_default")}
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleGearStatus(g)}
                              className="btn-ghost py-1 px-2.5 text-xs inline-flex items-center gap-1 hover:bg-amber-500/10"
                            >
                              {g.status === "active" ? (
                                <>
                                  <Archive size={12} />
                                  {t("gear.retire")}
                                </>
                              ) : (
                                <>
                                  <RotateCcw size={12} />
                                  {t("gear.activate")}
                                </>
                              )}
                            </button>
                          </div>

                          <button
                            onClick={() => handleDeleteGear(g.id)}
                            className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            title={t("gear.delete")}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Achievements Grid */}
          {activeTab === "achievements" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {achievements.map((ach) => {
                  return (
                    <div
                      key={ach.id}
                      className={`stat-card border flex items-start gap-4 transition-all duration-300 relative overflow-hidden ${
                        ach.unlocked
                          ? "border-[var(--accent)] bg-[var(--surface-hover)] shadow-md"
                          : "border-[var(--border)] opacity-60 bg-[var(--surface)]/40"
                      }`}
                    >
                      {/* Ambient unlocked glow background */}
                      {ach.unlocked && (
                        <div className="absolute -top-12 -right-12 w-24 h-24 bg-[var(--accent)]/10 rounded-full blur-2xl pointer-events-none" />
                      )}

                      {/* Icon Circle */}
                      <span
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 transition-transform duration-300 ${
                          ach.unlocked
                            ? "bg-[var(--accent-soft)] scale-105"
                            : "bg-[var(--bg)] filter grayscale"
                        }`}
                      >
                        {ach.icon}
                      </span>

                      {/* Info & Progress */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col">
                          <h4 className="font-bold text-sm truncate flex items-center gap-1.5">
                            {ach.title}
                          </h4>
                          <p className="text-xs text-[var(--muted)] leading-normal mt-0.5">
                            {ach.description}
                          </p>
                        </div>

                        {ach.unlocked ? (
                          <div className="mt-3 inline-flex items-center gap-1 text-[10px] text-[var(--accent)] font-semibold uppercase tracking-wider">
                            <CheckCircle size={10} className="text-[var(--accent)]" />
                            {t("achievements.unlocked_on", { date: ach.unlockedAt || "" })}
                          </div>
                        ) : (
                          <div className="mt-3 space-y-1">
                            <div className="flex justify-between text-[10px] text-[var(--muted)]">
                              <span>{t("achievements.progress")}</span>
                              <span className="font-semibold">
                                {ach.progressCurrent} / {ach.progressTarget} {ach.unit}
                              </span>
                            </div>
                            {ach.progressTarget > 0 && (
                              <div className="w-full bg-[var(--bg)] h-1.5 rounded-full overflow-hidden border border-[var(--border)]">
                                <div
                                  style={{ width: `${ach.progressPercentage}%` }}
                                  className="h-full rounded-full bg-[var(--muted)]"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "backup" && (
            <div className="space-y-6">
              {/* Card Exportar */}
              <div className="stat-card space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">{t("backup.export_title")}</h3>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {t("backup.export_text")}
                </p>
                <button
                  onClick={handleExportBackup}
                  className="btn-primary w-full justify-center py-2.5"
                  disabled={actionLoading}
                >
                  {actionLoading ? t("common.loading") : t("backup.export_btn")}
                </button>
              </div>

              {/* Card Importar */}
              <div className="stat-card space-y-4 border-dashed border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">{t("backup.import_title")}</h3>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {t("backup.import_text")}
                </p>
                
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                    id="backup-file-input"
                    disabled={actionLoading}
                  />
                  <button
                    onClick={() => document.getElementById("backup-file-input")?.click()}
                    className="btn-ghost border border-[var(--border)] hover:border-[var(--accent)]/50 w-full justify-center py-2.5 text-sm"
                    disabled={actionLoading}
                  >
                    {actionLoading ? t("common.loading") : t("backup.import_btn")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Sincronização Multidispositivo */}
          {activeTab === "sync" && (
            <SyncPanel onSyncSuccess={refreshData} />
          )}
        </>
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

      <VoiceCoachModal
        config={voiceCoachConfig}
        isOpen={isVoiceCoachModalOpen}
        onClose={() => setIsVoiceCoachModalOpen(false)}
        onSave={async (cfg) => {
          setVoiceCoachConfig(cfg);
          try {
            const p = await getUserProfile();
            await saveUserProfile({
              ...(p || {}),
              voiceCoach: cfg,
            });
            setMessage({ type: "ok", text: t("voice_coach.saved") });
          } catch (e) {
            console.error("Erro ao salvar voice coach:", e);
            setMessage({ type: "err", text: t("common.error") });
          }
        }}
      />

      <AutoPauseModal
        config={autoPauseConfig}
        isOpen={isAutoPauseModalOpen}
        onClose={() => setIsAutoPauseModalOpen(false)}
        onSave={async (cfg) => {
          setAutoPauseConfig(cfg);
          try {
            const p = await getUserProfile();
            await saveUserProfile({
              ...(p || {}),
              autoPause: cfg,
            });
            setMessage({ type: "ok", text: t("auto_pause.saved") });
          } catch (e) {
            console.error("Erro ao salvar auto pause:", e);
            setMessage({ type: "err", text: t("common.error") });
          }
        }}
      />
    </div>
  );
}
