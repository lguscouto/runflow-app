"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Archive,
  RotateCcw,
  Wrench,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Bike,
  Sparkles,
  Info,
  Layers,
  Activity,
  Calendar,
  Tag,
  Gauge,
  Scale,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  calculateComponentWear,
  getDefaultComponentsForBikeType,
  replaceBikeComponent,
  addBikeComponent,
  removeBikeComponent,
  setDefaultCyclingGear,
  type GearWithUsage,
} from "@/lib/gear";
import { putGear, removeGear } from "@/lib/storage";
import type {
  Gear,
  BikeType,
  BikeComponent,
  BikeComponentType,
} from "@/lib/types";
import { haptics } from "@/lib/haptics";
import { v4 as uuidv4 } from "uuid";
import { useModalA11y } from "@/hooks/useModalA11y";

interface BikeGarageManagerProps {
  bikes: GearWithUsage[];
  onRefresh: () => Promise<void>;
  setMessage: (msg: { type: "ok" | "err"; text: string } | null) => void;
}

const BIKE_TYPE_ICONS: Record<BikeType, string> = {
  road: "🚴 Speed / Road",
  mtb: "🚵 MTB",
  gravel: "🚵‍♂️ Gravel",
  urban: "🚲 Urbana",
  ebike: "⚡ E-Bike",
  tt: "⏱️ Triathlon / TT",
  other: "🚲 Outra",
};

const COMPONENT_ICONS: Record<BikeComponentType, string> = {
  chain: "⛓️",
  front_tire: "🛞",
  rear_tire: "🛞",
  brake_pads: "🛑",
  tubeless_sealant: "💧",
  cables: "🔌",
  general_service: "🔧",
  custom: "⚙️",
};

export function BikeGarageManager({
  bikes,
  onRefresh,
  setMessage,
}: BikeGarageManagerProps) {
  const { t, language } = useI18n();

  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // New Bike Form States
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [bikeType, setBikeType] = useState<BikeType>("road");
  const [weightKg, setWeightKg] = useState("8.5");
  const [wheelSize, setWheelSize] = useState("700x28c");
  const [initialDistanceKm, setInitialDistanceKm] = useState("0");
  const [autoCreateComponents, setAutoCreateComponents] = useState(true);

  // Replace Component Modal States
  const [activeReplaceModal, setActiveReplaceModal] = useState<{
    bikeId: string;
    component: BikeComponent;
    bikeKm: number;
  } | null>(null);
  const [replaceLimitKm, setReplaceLimitKm] = useState<string>("");
  const [replaceNotes, setReplaceNotes] = useState<string>("");

  // Add Custom Component Modal States
  const [activeAddComponentModal, setActiveAddComponentModal] = useState<{
    bikeId: string;
  } | null>(null);
  const [compName, setCompName] = useState("");
  const [compType, setCompType] = useState<BikeComponentType>("chain");
  const [compBrandModel, setCompBrandModel] = useState("");
  const [compLimitKm, setCompLimitKm] = useState("2500");
  const [compNotes, setCompNotes] = useState("");
  const { modalRef: replaceModalRef } = useModalA11y<HTMLFormElement>({
    isOpen: Boolean(activeReplaceModal),
    onClose: () => setActiveReplaceModal(null),
  });
  const { modalRef: addComponentModalRef } = useModalA11y<HTMLFormElement>({
    isOpen: Boolean(activeAddComponentModal),
    onClose: () => setActiveAddComponentModal(null),
  });

  const handleAddBike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    haptics.medium();
    setSaving(true);
    try {
      const initialM = Math.max(0, parseFloat(initialDistanceKm) || 0) * 1000;
      const weight = parseFloat(weightKg) || undefined;

      const components = autoCreateComponents
        ? getDefaultComponentsForBikeType(bikeType).map((c) => ({
            ...c,
            installedDistanceM: initialM,
          }))
        : [];

      const isFirstBike = bikes.length === 0;

      const newBike: Gear = {
        id: uuidv4(),
        type: "bike",
        name: name.trim(),
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        bikeType,
        weightKg: weight,
        wheelSize: wheelSize.trim() || undefined,
        components,
        initialDistanceM: initialM,
        status: "active",
        isDefault: false,
        isDefaultCycling: isFirstBike,
        createdAt: new Date().toISOString(),
      };

      await putGear(newBike);
      haptics.success();

      setName("");
      setBrand("");
      setModel("");
      setWeightKg("8.5");
      setWheelSize("700x28c");
      setInitialDistanceKm("0");
      setShowAddForm(false);

      setMessage({ type: "ok", text: t("gear.success_add") });
      await onRefresh();
    } catch (err) {
      console.error(err);
      haptics.error();
      setMessage({ type: "err", text: "Erro ao cadastrar bicicleta." });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (bikeId: string) => {
    haptics.light();
    try {
      await setDefaultCyclingGear(bikeId);
      haptics.success();
      setMessage({ type: "ok", text: t("gear.success_update") });
      await onRefresh();
    } catch (err) {
      console.error(err);
      setMessage({ type: "err", text: "Erro ao atualizar bike padrão." });
    }
  };

  const handleToggleStatus = async (bike: GearWithUsage) => {
    haptics.light();
    try {
      const updated: Gear = {
        ...bike,
        status: bike.status === "active" ? "retired" : "active",
        isDefaultCycling: bike.status === "active" ? false : bike.isDefaultCycling,
      };
      await putGear(updated);
      haptics.medium();
      setMessage({ type: "ok", text: t("gear.success_update") });
      await onRefresh();
    } catch (err) {
      console.error(err);
      setMessage({ type: "err", text: "Erro ao alterar status." });
    }
  };

  const handleDeleteBike = async (bikeId: string) => {
    haptics.warning();
    if (!confirm(t("gear.delete") + "?")) return;
    try {
      await removeGear(bikeId);
      haptics.medium();
      setMessage({ type: "ok", text: t("gear.success_delete") });
      await onRefresh();
    } catch (err) {
      console.error(err);
      setMessage({ type: "err", text: "Erro ao excluir bike." });
    }
  };

  const openReplaceModal = (bikeId: string, comp: BikeComponent, bikeKm: number) => {
    haptics.light();
    setActiveReplaceModal({ bikeId, component: comp, bikeKm });
    setReplaceLimitKm(String(Math.round((comp.maxDistanceM || 2500000) / 1000)));
    setReplaceNotes("");
  };

  const handleConfirmReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReplaceModal) return;

    haptics.medium();
    try {
      const limitKm = parseFloat(replaceLimitKm) || undefined;
      await replaceBikeComponent(
        activeReplaceModal.bikeId,
        activeReplaceModal.component.id,
        limitKm,
        replaceNotes.trim() || undefined
      );

      haptics.success();
      setActiveReplaceModal(null);
      setMessage({
        type: "ok",
        text: `Substituição de ${activeReplaceModal.component.name} registrada com sucesso!`,
      });
      await onRefresh();
    } catch (err) {
      console.error(err);
      haptics.error();
      setMessage({ type: "err", text: "Erro ao registrar substituição." });
    }
  };

  const handleConfirmAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAddComponentModal || !compName.trim()) return;

    haptics.medium();
    try {
      const limitKm = parseFloat(compLimitKm) || 2500;
      await addBikeComponent(activeAddComponentModal.bikeId, {
        name: compName.trim(),
        type: compType,
        brandModel: compBrandModel.trim() || undefined,
        maxDistanceKm: limitKm,
        notes: compNotes.trim() || undefined,
      });

      haptics.success();
      setActiveAddComponentModal(null);
      setCompName("");
      setCompBrandModel("");
      setCompLimitKm("2500");
      setCompNotes("");

      setMessage({ type: "ok", text: "Componente adicionado com sucesso!" });
      await onRefresh();
    } catch (err) {
      console.error(err);
      haptics.error();
      setMessage({ type: "err", text: "Erro ao adicionar componente." });
    }
  };

  const handleRemoveComponent = async (bikeId: string, compId: string, compName: string) => {
    haptics.warning();
    if (!confirm(`Remover o componente "${compName}" da bicicleta?`)) return;

    try {
      await removeBikeComponent(bikeId, compId);
      haptics.medium();
      setMessage({ type: "ok", text: "Componente removido." });
      await onRefresh();
    } catch (err) {
      console.error(err);
      setMessage({ type: "err", text: "Erro ao remover componente." });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bike className="text-[var(--color-status-warning)]" size={20} />
            {t("bike_garage.title")}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {t("bike_garage.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            haptics.light();
            setShowAddForm(!showAddForm);
          }}
          className="btn-primary py-2 px-3.5 text-xs self-start sm:self-auto flex items-center gap-1.5"
        >
          {showAddForm ? (
            t("common.cancel")
          ) : (
            <>
              <Plus size={15} />
              {t("bike_garage.add_bike_btn")}
            </>
          )}
        </button>
      </div>

      {/* Add Bike Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddBike}
          className="stat-card space-y-4 border-amber-500/40 bg-[var(--surface-hover)] shadow-lg animate-in fade-in duration-300"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Bike className="text-[var(--color-status-warning)]" size={18} />
            <h3 className="font-bold text-sm text-[var(--text)]">
              {t("bike_garage.add_bike_btn")}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bike-name" className="block text-xs text-[var(--muted)] mb-1">
                {t("bike_garage.name")} *
              </label>
              <input
                id="bike-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Specialized Tarmac SL7"
                className="profile-input text-sm"
              />
            </div>
            <div>
              <label htmlFor="bike-brand" className="block text-xs text-[var(--muted)] mb-1">
                {t("bike_garage.brand")}
              </label>
              <input
                id="bike-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex.: Specialized, Trek, Caloi, Cannondale"
                className="profile-input text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="bike-type" className="block text-xs text-[var(--muted)] mb-1">
                {t("bike_garage.type")}
              </label>
              <select
                id="bike-type"
                value={bikeType}
                onChange={(e) => setBikeType(e.target.value as BikeType)}
                className="profile-input text-sm bg-[var(--surface)] text-[var(--text)]"
              >
                <option value="road">{t("bike_garage.type_road")}</option>
                <option value="mtb">{t("bike_garage.type_mtb")}</option>
                <option value="gravel">{t("bike_garage.type_gravel")}</option>
                <option value="urban">{t("bike_garage.type_urban")}</option>
                <option value="ebike">{t("bike_garage.type_ebike")}</option>
                <option value="tt">{t("bike_garage.type_tt")}</option>
                <option value="other">{t("bike_garage.type_other")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="bike-weight" className="block text-xs text-[var(--muted)] mb-1 flex items-center justify-between">
                <span>{t("bike_garage.weight_kg")}</span>
                <span className="text-[10px] text-[var(--color-status-warning)]">⚡ Watts</span>
              </label>
              <input
                id="bike-weight"
                type="number"
                step={0.1}
                min={4}
                max={40}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="8.5"
                className="profile-input text-sm"
              />
              <span className="text-[10px] text-[var(--muted)] block mt-0.5">
                {t("bike_garage.weight_sub")}
              </span>
            </div>

            <div>
              <label htmlFor="bike-wheel-size" className="block text-xs text-[var(--muted)] mb-1">
                {t("bike_garage.wheel_size")}
              </label>
              <input
                id="bike-wheel-size"
                type="text"
                value={wheelSize}
                onChange={(e) => setWheelSize(e.target.value)}
                placeholder={t("bike_garage.wheel_size_placeholder")}
                className="profile-input text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bike-initial-distance" className="block text-xs text-[var(--muted)] mb-1">
                {t("bike_garage.initial_distance")}
              </label>
              <input
                id="bike-initial-distance"
                type="number"
                min={0}
                step={1}
                value={initialDistanceKm}
                onChange={(e) => setInitialDistanceKm(e.target.value)}
                placeholder="0"
                className="profile-input text-sm"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={autoCreateComponents}
                  onChange={(e) => setAutoCreateComponents(e.target.checked)}
                  className="rounded border-[var(--border)] text-amber-500 focus:ring-amber-400"
                />
                <span>{t("bike_garage.auto_components")}</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn-ghost py-1.5 px-3 text-xs"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary py-1.5 px-4 text-xs bg-amber-500 hover:bg-amber-600 text-black font-bold"
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      )}

      {/* Bikes List */}
      {bikes.length === 0 ? (
        <div className="stat-card text-center py-10 text-[var(--muted)] border border-dashed border-[var(--border)]">
          <Bike size={36} className="mx-auto text-[var(--muted)] mb-2 opacity-50" />
          <p className="font-semibold text-sm">{t("bike_garage.no_bikes")}</p>
          <p className="text-xs mt-1">
            Cadastre sua bicicleta para rastrear o desgaste da corrente, pneus e pastilhas de freio.
          </p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="btn-primary mt-4 py-2 px-4 text-xs inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            {t("bike_garage.add_bike_btn")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {bikes.map((bike) => {
            const bikeKm = bike.accumulatedDistanceM / 1000;
            const components = bike.components || [];
            const isCyclingDefault = !!bike.isDefaultCycling;

            return (
              <div
                key={bike.id}
                className={`stat-card flex flex-col gap-5 border transition-all ${
                  bike.status === "retired"
                    ? "opacity-60 border-[var(--border)] bg-[var(--surface)]/50"
                    : isCyclingDefault
                    ? "border-amber-500/50 bg-[var(--surface-hover)] shadow-lg"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                {/* Bike Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[var(--color-status-warning)] flex items-center justify-center shrink-0">
                      <Bike size={24} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-lg text-[var(--text)]">
                          {bike.name}
                        </h3>
                        {bike.brand && (
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--border)] text-[var(--muted)] font-medium">
                            {bike.brand}
                          </span>
                        )}
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--color-status-warning)] font-medium">
                          {BIKE_TYPE_ICONS[bike.bikeType || "road"] || "🚲"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)] mt-1.5">
                        {bike.weightKg != null && (
                          <span className="flex items-center gap-1">
                            <Scale size={12} className="text-[var(--color-status-warning)]" />
                            {bike.weightKg} kg
                          </span>
                        )}
                        {bike.wheelSize && (
                          <span className="flex items-center gap-1">
                            <Gauge size={12} className="text-blue-400" />
                            {bike.wheelSize}
                          </span>
                        )}
                        <span className="text-[var(--text)] font-semibold flex items-center gap-1">
                          <Activity size={12} className="text-[var(--color-status-positive)]" />
                          {t("bike_garage.odometer")}: {bikeKm.toFixed(1)} km
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Badges & Actions */}
                  <div className="flex items-center gap-2 self-start">
                    {isCyclingDefault && bike.status === "active" && (
                      <span className="text-xs bg-amber-500/20 text-[var(--color-status-warning)] border border-amber-500/40 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                        <Sparkles size={12} />
                        {t("bike_garage.default_cycling")}
                      </span>
                    )}
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                        bike.status === "active"
                          ? "bg-emerald-500/10 text-[var(--color-status-positive)] border border-emerald-500/20"
                          : "bg-red-500/10 text-[var(--color-status-danger)] border border-red-500/20"
                      }`}
                    >
                      {bike.status === "active"
                        ? t("gear.status_active")
                        : t("gear.status_retired")}
                    </span>
                  </div>
                </div>

                {/* Mechanical Components & Preventive Maintenance */}
                <div className="border-t border-[var(--border)] pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench size={15} className="text-[var(--color-status-warning)]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                        {t("bike_garage.components_title")} ({components.length})
                      </h4>
                    </div>

                    {bike.status === "active" && (
                      <button
                        type="button"
                        onClick={() => {
                          haptics.light();
                          setActiveAddComponentModal({ bikeId: bike.id });
                        }}
                        className="text-xs text-[var(--color-status-warning)] hover:text-[var(--color-status-warning)] font-semibold flex items-center gap-1"
                      >
                        <Plus size={13} />
                        {t("bike_garage.add_component")}
                      </button>
                    )}
                  </div>

                  {components.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] italic py-2">
                      Nenhum componente mecânico cadastrado para esta bicicleta.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {components.map((comp) => {
                        const wear = calculateComponentWear(
                          comp,
                          bike.accumulatedDistanceM
                        );
                        const usageKm = (wear.usageDistanceM / 1000).toFixed(1);
                        const maxKm = Math.round(wear.maxDistanceM / 1000);
                        const isExceeded = wear.status === "exceeded";
                        const isWarning = wear.status === "warning";

                        return (
                          <div
                            key={comp.id}
                            className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                              isExceeded
                                ? "border-red-500/50 bg-red-500/10 shadow"
                                : isWarning
                                ? "border-amber-500/40 bg-amber-500/5"
                                : "border-[var(--border)] bg-[var(--surface)]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <span className="text-base shrink-0 mt-0.5">
                                  {COMPONENT_ICONS[comp.type] || "⚙️"}
                                </span>
                                <div>
                                  <p className="text-xs font-bold text-[var(--text)] leading-tight">
                                    {comp.name}
                                  </p>
                                  {comp.brandModel && (
                                    <p className="text-[10px] text-[var(--muted)]">
                                      {comp.brandModel}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Status indicator badge */}
                              <div className="shrink-0">
                                {isExceeded ? (
                                  <span className="text-[10px] font-extrabold text-[var(--color-status-danger)] bg-red-500/20 border border-red-500/40 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                    <AlertOctagon size={10} />
                                    TROCAR
                                  </span>
                                ) : isWarning ? (
                                  <span className="text-[10px] font-bold text-[var(--color-status-warning)] bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <AlertTriangle size={10} />
                                    ATENÇÃO
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-[var(--color-status-positive)] bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <CheckCircle size={10} />
                                    OK
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Wear Progress Bar */}
                            <div>
                              <div className="flex justify-between text-[11px] mb-1">
                                <span className="text-[var(--muted)]">
                                  {usageKm} / {maxKm} km
                                </span>
                                <span
                                  className={`font-bold tabular-nums ${
                                    isExceeded
                                      ? "text-[var(--color-status-danger)]"
                                      : isWarning
                                      ? "text-[var(--color-status-warning)]"
                                      : "text-[var(--text)]"
                                  }`}
                                >
                                  {wear.wearPercentage}%
                                </span>
                              </div>
                              <div className="w-full bg-[var(--surface-hover)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                                <div
                                  style={{
                                    width: `${Math.min(100, wear.wearPercentage)}%`,
                                  }}
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isExceeded
                                      ? "bg-red-500"
                                      : isWarning
                                      ? "bg-amber-400"
                                      : "bg-emerald-400"
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Actions & Replace Button */}
                            <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-[10px]">
                              <span className="text-[var(--muted)]">
                                {comp.lastServiceAt
                                  ? `Troca: ${new Date(
                                      comp.lastServiceAt
                                    ).toLocaleDateString(
                                      language === "pt" ? "pt-BR" : "en-US"
                                    )}`
                                  : `Instalado: ${(
                                      comp.installedDistanceM / 1000
                                    ).toFixed(0)} km`}
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openReplaceModal(bike.id, comp, bikeKm)
                                  }
                                  className="text-[var(--color-status-warning)] hover:text-[var(--color-status-warning)] font-bold flex items-center gap-1 underline"
                                >
                                  <RotateCcw size={11} />
                                  {t("bike_garage.replace_component")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveComponent(
                                      bike.id,
                                      comp.id,
                                      comp.name
                                    )
                                  }
                                  className="text-[var(--muted)] hover:text-[var(--color-status-danger)] p-1"
                                  title="Remover peça"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bike Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3 mt-1">
                  <div className="flex items-center gap-2">
                    {bike.status === "active" && !isCyclingDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(bike.id)}
                        className="btn-ghost py-1.5 px-3 text-xs border border-amber-500/40 text-[var(--color-status-warning)] hover:bg-amber-500/10 font-semibold flex items-center gap-1"
                      >
                        <Sparkles size={12} />
                        {t("bike_garage.set_default_cycling")}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(bike)}
                      className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1 text-[var(--muted)] hover:text-[var(--text)]"
                    >
                      <Archive size={13} />
                      {bike.status === "active"
                        ? t("gear.retire")
                        : t("gear.activate")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBike(bike.id)}
                      className="btn-ghost py-1.5 px-3 text-xs text-[var(--color-status-danger)] hover:text-[var(--color-status-danger)] hover:bg-red-500/10 flex items-center gap-1"
                    >
                      <Trash2 size={13} />
                      {t("gear.delete")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Replace / Service Component */}
      {activeReplaceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <form
            ref={replaceModalRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("bike_garage.replace_component")}
            onSubmit={handleConfirmReplace}
            className="stat-card max-w-md w-full border-amber-500/50 bg-[var(--surface)] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <RotateCcw className="text-[var(--color-status-warning)]" size={20} />
              <div>
                <h3 className="font-bold text-base text-[var(--text)]">
                  {t("bike_garage.replace_component")}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {activeReplaceModal.component.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text)]">
              Ao registrar a substituição, o contador de desgaste deste componente
              será zerado e calibrado para o hodômetro atual da bicicleta (
              <strong className="text-[var(--color-status-warning)]">
                {activeReplaceModal.bikeKm.toFixed(1)} km
              </strong>
              ).
            </p>

            <div>
              <label htmlFor="bike-replace-limit" className="block text-xs text-[var(--muted)] mb-1">
                Limite Recomendado para a Nova Peça (km)
              </label>
              <input
                id="bike-replace-limit"
                type="number"
                min={100}
                step={100}
                required
                value={replaceLimitKm}
                onChange={(e) => setReplaceLimitKm(e.target.value)}
                className="profile-input text-sm"
              />
            </div>

            <div>
              <label htmlFor="bike-replace-notes" className="block text-xs text-[var(--muted)] mb-1">
                {t("bike_garage.service_notes")}
              </label>
              <input
                id="bike-replace-notes"
                type="text"
                value={replaceNotes}
                onChange={(e) => setReplaceNotes(e.target.value)}
                placeholder="Ex: Corrente KMC X11 Silver instalada"
                className="profile-input text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setActiveReplaceModal(null)}
                className="btn-ghost py-2 px-4 text-xs"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="btn-primary py-2 px-4 text-xs bg-amber-500 hover:bg-amber-600 text-black font-bold"
              >
                Confirmar Substituição
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Custom Component */}
      {activeAddComponentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <form
            ref={addComponentModalRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("bike_garage.add_component")}
            onSubmit={handleConfirmAddComponent}
            className="stat-card max-w-md w-full border-amber-500/50 bg-[var(--surface)] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Plus className="text-[var(--color-status-warning)]" size={20} />
              <div>
                <h3 className="font-bold text-base text-[var(--text)]">
                  {t("bike_garage.add_component")}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Adicione uma peça mecânica para monitoramento
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="bike-component-name" className="block text-xs text-[var(--muted)] mb-1">
                Nome da Peça *
              </label>
              <input
                id="bike-component-name"
                type="text"
                required
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="Ex: Cassete Shimano 11-30, Selante Tubeless"
                className="profile-input text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bike-component-type" className="block text-xs text-[var(--muted)] mb-1">
                  Tipo
                </label>
                <select
                  id="bike-component-type"
                  value={compType}
                  onChange={(e) =>
                    setCompType(e.target.value as BikeComponentType)
                  }
                  className="profile-input text-sm bg-[var(--surface)] text-[var(--text)]"
                >
                  <option value="chain">⛓️ Corrente</option>
                  <option value="front_tire">🛞 Pneu Dianteiro</option>
                  <option value="rear_tire">🛞 Pneu Traseiro</option>
                  <option value="brake_pads">🛑 Pastilhas de Freio</option>
                  <option value="tubeless_sealant">💧 Selante Tubeless</option>
                  <option value="cables">🔌 Cabos & Conduítes</option>
                  <option value="general_service">🔧 Revisão Geral</option>
                  <option value="custom">⚙️ Outro Componente</option>
                </select>
              </div>

              <div>
                <label htmlFor="bike-component-limit" className="block text-xs text-[var(--muted)] mb-1">
                  Limite Recomendado (km)
                </label>
                <input
                  id="bike-component-limit"
                  type="number"
                  min={100}
                  step={100}
                  required
                  value={compLimitKm}
                  onChange={(e) => setCompLimitKm(e.target.value)}
                  placeholder="2500"
                  className="profile-input text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bike-component-brand" className="block text-xs text-[var(--muted)] mb-1">
                Marca / Modelo (Opcional)
              </label>
              <input
                id="bike-component-brand"
                type="text"
                value={compBrandModel}
                onChange={(e) => setCompBrandModel(e.target.value)}
                placeholder="Ex: Shimano Ultegra, Continental GP5000"
                className="profile-input text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setActiveAddComponentModal(null)}
                className="btn-ghost py-2 px-4 text-xs"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="btn-primary py-2 px-4 text-xs bg-amber-500 hover:bg-amber-600 text-black font-bold"
              >
                Adicionar Peça
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
