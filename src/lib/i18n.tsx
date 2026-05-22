"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getUserProfile, saveUserProfile } from "@/lib/profile";

export type Language = "pt" | "en";

export const translations = {
  pt: {
    // Nav / Layout
    "nav.home": "Início",
    "nav.record": "Gravar",
    "nav.activities": "Atividades",
    "nav.import": "Importar",
    "nav.profile": "Perfil",
    "footer.text": "RunFlow — open source, gratuito, dados no seu dispositivo.",

    // Common
    "common.back": "Voltar",
    "common.save": "Salvar",
    "common.saving": "Salvando...",
    "common.loading": "Carregando...",
    "common.error": "Erro",
    "common.cancel": "Cancelar",
    "common.confirm": "Confirmar",
    "common.no_data": "Sem registro",
    "common.total": "Total",
    "common.average": "Médio",

    // Home
    "home.title": "Seus treinos de corrida",
    "home.subtitle": "Grave corridas com GPS no app ou importe do Amazfit — tudo fica no seu dispositivo.",
    "home.start_workout": "Iniciar treino",
    "home.start_workout_sub": "GPS ao vivo — distância, tempo e ritmo",
    "home.import_btn": "Importar GPX/FIT",
    "home.view_all_btn": "Ver todas",
    "home.loading_stats": "Carregando estatísticas...",
    "home.total_distance": "Distância total",
    "home.total_duration": "Tempo total",
    "home.this_week": "Esta semana",
    "home.workouts": "Treinos",
    "home.registered": "registrados",
    "home.recent_activities": "Atividades recentes",
    "home.loading_records": "Carregando recordes...",
    "home.workouts_count": "{count} treino(s)",

    // Profile
    "profile.title": "Seu perfil",
    "profile.subtitle": "Calorias, metas semanais e dados corporais",
    "profile.how_we_calculate_title": "Como calculamos",
    "profile.how_we_calculate_text": "Usamos a fórmula MET (equivalente metabólico) com seu peso — ou massa magra, se informar o % de gordura —, duração, tipo de atividade e ritmo médio. Altura e idade ficam registradas para evoluções futuras. Se o treino já trouxer calorias do relógio (FIT), esse valor é mantido.",
    "profile.age": "Idade (anos)",
    "profile.age_placeholder": "Ex.: 32",
    "profile.height": "Altura (cm)",
    "profile.height_placeholder": "Ex.: 175",
    "profile.weight": "Peso (kg)",
    "profile.weight_placeholder": "Ex.: 72.5 (calorias)",
    "profile.body_fat": "Gordura corporal (%)",
    "profile.body_fat_placeholder": "Ex.: 18 (opcional)",
    "profile.body_fat_sub": "Opcional. Melhora a estimativa usando massa magra.",
    "profile.weekly_goals": "Metas da semana",
    "profile.weekly_goals_sub": "Semana de segunda a domingo. Progresso na tela inicial.",
    "profile.weekly_distance": "Distância por semana (km)",
    "profile.weekly_distance_placeholder": "Ex.: 20",
    "profile.weekly_workouts": "Treinos por semana",
    "profile.weekly_workouts_placeholder": "Ex.: 3",
    "profile.personal_records": "Recordes Pessoais",
    "profile.personal_records_sub": "Configurações para determinação dos seus recordes pessoais.",
    "profile.min_pace_distance": "Distância mínima para recorde de ritmo (km)",
    "profile.min_pace_distance_placeholder": "Padrão: 5",
    "profile.preferences": "Preferências",
    "profile.preferences_sub": "Configurações gerais do aplicativo.",
    "profile.language": "Idioma do aplicativo",
    "profile.lang_pt": "Português",
    "profile.lang_en": "English",
    "profile.save_btn": "Salvar perfil",
    "profile.val_age": "Idade deve estar entre 10 e 120.",
    "profile.val_height": "Altura deve estar entre 100 e 250 cm.",
    "profile.val_weight": "Peso deve estar entre 30 e 300 kg.",
    "profile.val_body_fat": "% de gordura deve estar entre 3 e 70.",
    "profile.val_weekly_distance": "Meta de distância: entre 1 e 500 km por semana.",
    "profile.val_weekly_workouts": "Meta de treinos: entre 1 e 14 por semana.",
    "profile.val_min_pace": "Distância mínima para recorde de ritmo: entre 1 e 100 km.",
    "profile.save_success": "Perfil salvo com sucesso.",
    "profile.save_success_kcal": "Perfil salvo. Calorias estimadas em {count} treino(s).",
    "profile.save_error": "Erro ao salvar perfil.",

    // Weekly Goals
    "goals.loading": "Carregando metas...",
    "goals.set_goals": "Definir metas da semana",
    "goals.set_goals_sub": "Distância e número de treinos — em Perfil",
    "goals.completed": "Metas da semana concluídas!",
    "goals.completed_sub": "Parabéns — continue assim na próxima semana.",
    "goals.distance": "Distância",
    "goals.workouts": "Treinos",
    "goals.workouts_unit": "treinos",

    // Personal Records
    "prs.title": "Recordes Pessoais",
    "prs.empty": "Complete treinos de corrida para registrar seus recordes aqui!",
    "prs.longest_distance": "Maior Distância",
    "prs.best_pace": "Melhor Ritmo",
    "prs.longest_duration": "Maior Duração",
    "prs.highest_elevation": "Maior Subida",
    "prs.congrats_title": "Recorde Pessoal Batido! 🏆",
    "prs.congrats_sub": "Este treino estabeleceu sua melhor marca em: ",

    // Activity List
    "activities.title": "Atividades",
    "activities.registered_count": "{count} treino(s) registrado(s)",
    "activities.empty": "Nenhum treino ainda.",
    "activities.import_btn": "Importar treino",
    "activities.recorded_on": "Gravado no RunFlow",

    // Activity Detail
    "detail.not_found": "Treino não encontrado.",
    "detail.loading": "Carregando treino...",
    "detail.distance": "Distância",
    "detail.duration": "Duração",
    "detail.avg_pace": "Ritmo médio",
    "detail.elevation": "Elevação",
    "detail.calories": "Calorias",
    "detail.calories_source_file": "Do arquivo ou estimada",
    "detail.calories_source_profile": "Estimada pelo perfil",
    "detail.kcal_sub": "Cadastre seu peso no perfil",
    "detail.avg_max_hr": "FC média / máx",
    "detail.confirm_delete": "Excluir este treino permanentemente?",
    "detail.deleting": "Excluindo...",
    "detail.delete_btn": "Excluir",

    // Recording
    "record.title": "Iniciar treino",
    "record.active_title": "Treino em andamento",
    "record.active_sub": "GPS ativo — mantenha o app aberto durante a corrida",
    "record.inactive_sub": "Grave sua corrida com GPS, como no Strava",
    "record.discard_confirm": "Descartar este treino em andamento? Os dados não serão salvos.",
    "record.discard_btn": "Descartar treino",
    "record.points_count": "{count} pontos GPS",
    "record.paused": "Pausado",
    "record.activity_type": "Tipo de atividade",
    "record.guide_gps": "Use ao ar livre para melhor sinal GPS",
    "record.guide_permission": "Permita acesso à localização quando solicitado",
    "record.guide_profile": "Perfil com peso para estimar calorias",
    "record.guide_min": "Mínimo: 20 m e 15 segundos para salvar",
    "record.start_btn": "Iniciar",
    "record.pause_btn": "Pausar",
    "record.resume_btn": "Retomar",
    "record.stop_btn": "Finalizar",
    "record.confirm_stop_btn": "Confirmar parada",
    "record.saving_workout": "Salvando treino...",
    "record.map_loading": "Carregando mapa...",
    "record.current_pace": "Ritmo atual",
    "record.time": "Tempo",
    "record.close": "Fechar",

    // Import Form
    "import.drag_gpx_fit": "Arraste arquivos GPX ou FIT aqui",
    "import.guide": "Exporte seus treinos do relógio Amazfit com o app Zepp ou ferramentas open source (veja o guia abaixo) e importe aqui.",
    "import.choose_files": "Escolher arquivos",
    "import.importing": "Importando...",
    "import.val_files": "Selecione arquivos .gpx ou .fit exportados do Amazfit/Zepp.",
    "import.success": "{count} treino(s) importado(s) com sucesso!",

    // Splits
    "splits.title": "Voltas (a cada 1 km)",
    "splits.lap": "Volta",
    "splits.distance": "Distância",
    "splits.pace": "Ritmo",
    "splits.elevation": "Elevação",
    "splits.hr": "FC Média",
    "splits.final": "Final",

    // Sports
    "sport.running": "Corrida",
    "sport.walking": "Caminhada",
    "sport.cycling": "Ciclismo",
    "sport.other": "Outro",

    // Export GPX
    "export.gpx_btn": "Exportar GPX",
    "export.exporting": "Exportando...",
    "export.error": "Erro ao exportar GPX",
    "export.tooltip": "Exportar ou compartilhar GPX",
    "export.tooltip_no_points": "Sem pontos GPS suficientes",

    // Charts
    "charts.title": "Análise do treino",
    "charts.pace_km": "Ritmo por km",
    "charts.pace_time": "Ritmo ao longo do treino",
    "charts.pace_tip": "Menor valor = ritmo mais rápido",
    "charts.elevation": "Elevação",
    "charts.hr": "Frequência cardíaca",
    "charts.distance_km": "Distância (km)",
    "charts.kilometer": "Quilômetro",
    "charts.hr_not_available": "FC disponível em treinos importados de FIT ou relógio com sensor.",
    "charts.insufficient_data": "Dados insuficientes para o gráfico.",
    "charts.graph": "Gráfico",

    // Map
    "map.no_gps": "Sem dados de GPS para exibir o mapa.",

    // Import Guide Page
    "import.page_title": "Importar treinos",
    "import.subtitle": "Suporte a arquivos GPX e FIT — os formatos usados ao exportar do Amazfit/Zepp.",
    "import.why_no_sync_title": "Por que não sincroniza direto com a Zepp?",
    "import.why_no_sync_desc1_1": "A nuvem Zepp/Huami é ",
    "import.why_no_sync_desc1_strong": "proprietária",
    "import.why_no_sync_desc1_2": ". Não há API pública estável para apps independentes. A API oficial (",
    "import.why_no_sync_desc1_3": ") exige parceria empresarial; os endpoints usados por exportadores open source são não documentados e podem parar de funcionar a qualquer momento.",
    "import.why_no_sync_desc2_1": "O RunFlow importa ",
    "import.why_no_sync_desc2_strong": "arquivos GPX ou FIT",
    "import.why_no_sync_desc2_2": " — o método recomendado e confiável. Seus dados continuam apenas no seu computador.",
    "import.how_to_export_title": "Como exportar do Amazfit",
    "import.how_to_export_step1_1": "Instale o app ",
    "import.how_to_export_step1_strong": "Zepp",
    "import.how_to_export_step1_2": " no celular e sincronize o relógio Amazfit.",
    "import.how_to_export_step2_1": "Use uma ferramenta open source para baixar seus treinos em GPX ou FIT, por exemplo ",
    "import.how_to_export_step2_or": " ou ",
    "import.how_to_export_step3_1": "Para essas ferramentas, obtenha o ",
    "import.how_to_export_step3_2": " na página de privacidade/GDPR (",
    "import.how_to_export_step3_3": ", F12 → Rede) — veja a documentação de cada projeto.",
    "import.how_to_export_step4_1": "Alternativa: exporte ",
    "import.how_to_export_step4_strong": "um treino por vez",
    "import.how_to_export_step4_2": " em GPX pelo próprio app Zepp (manual).",
    "import.how_to_export_step5_1": "Envie os arquivos ",
    "import.how_to_export_step5_or": " ou ",
    "import.how_to_export_step5_2": " na área acima.",
    "import.gdpr_warning": "A exportação GDPR da Huami geralmente não inclui atividades com GPS. Por isso ferramentas da comunidade ou export manual são necessárias.",
  },
  en: {
    // Nav / Layout
    "nav.home": "Home",
    "nav.record": "Record",
    "nav.activities": "Activities",
    "nav.import": "Import",
    "nav.profile": "Profile",
    "footer.text": "RunFlow — open source, free, data stays on your device.",

    // Common
    "common.back": "Back",
    "common.save": "Save",
    "common.saving": "Saving...",
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.no_data": "No record",
    "common.total": "Total",
    "common.average": "Average",

    // Home
    "home.title": "Your running workouts",
    "home.subtitle": "Record runs with GPS in the app or import from Amazfit — everything stays on your device.",
    "home.start_workout": "Start workout",
    "home.start_workout_sub": "Live GPS — distance, time, and pace",
    "home.import_btn": "Import GPX/FIT",
    "home.view_all_btn": "View all",
    "home.loading_stats": "Loading stats...",
    "home.total_distance": "Total distance",
    "home.total_duration": "Total duration",
    "home.this_week": "This week",
    "home.workouts": "Workouts",
    "home.registered": "registered",
    "home.recent_activities": "Recent activities",
    "home.loading_records": "Loading records...",
    "home.workouts_count": "{count} workout(s)",

    // Profile
    "profile.title": "Your profile",
    "profile.subtitle": "Calories, weekly goals, and body metrics",
    "profile.how_we_calculate_title": "How we calculate",
    "profile.how_we_calculate_text": "We use the MET (metabolic equivalent) formula with your weight — or lean body mass, if you provide body fat % —, duration, activity type, and average pace. Height and age are logged for future stats. If the workout already has calories from the device (FIT), that value is kept.",
    "profile.age": "Age (years)",
    "profile.age_placeholder": "E.g.: 32",
    "profile.height": "Height (cm)",
    "profile.height_placeholder": "E.g.: 175",
    "profile.weight": "Weight (kg)",
    "profile.weight_placeholder": "E.g.: 72.5 (calories)",
    "profile.body_fat": "Body fat (%)",
    "profile.body_fat_placeholder": "E.g.: 18 (optional)",
    "profile.body_fat_sub": "Optional. Improves estimation using lean body mass.",
    "profile.weekly_goals": "Weekly goals",
    "profile.weekly_goals_sub": "Week from Monday to Sunday. Progress on the home screen.",
    "profile.weekly_distance": "Distance per week (km)",
    "profile.weekly_distance_placeholder": "E.g.: 20",
    "profile.weekly_workouts": "Workouts per week",
    "profile.weekly_workouts_placeholder": "E.g.: 3",
    "profile.personal_records": "Personal Records",
    "profile.personal_records_sub": "Settings to determine your personal records.",
    "profile.min_pace_distance": "Min distance for pace record (km)",
    "profile.min_pace_distance_placeholder": "Default: 5",
    "profile.preferences": "Preferences",
    "profile.preferences_sub": "General application settings.",
    "profile.language": "App language",
    "profile.lang_pt": "Português",
    "profile.lang_en": "English",
    "profile.save_btn": "Save profile",
    "profile.val_age": "Age must be between 10 and 120.",
    "profile.val_height": "Height must be between 100 and 250 cm.",
    "profile.val_weight": "Weight must be between 30 and 300 kg.",
    "profile.val_body_fat": "Body fat % must be between 3 and 70.",
    "profile.val_weekly_distance": "Distance goal: between 1 and 500 km per week.",
    "profile.val_weekly_workouts": "Workouts goal: between 1 and 14 per week.",
    "profile.val_min_pace": "Min distance for pace record: between 1 and 100 km.",
    "profile.save_success": "Profile saved successfully.",
    "profile.save_success_kcal": "Profile saved. Calories estimated in {count} workout(s).",
    "profile.save_error": "Error saving profile.",

    // Weekly Goals
    "goals.loading": "Loading goals...",
    "goals.set_goals": "Set weekly goals",
    "goals.set_goals_sub": "Distance and number of workouts — in Profile",
    "goals.completed": "Weekly goals completed!",
    "goals.completed_sub": "Congratulations — keep it up next week.",
    "goals.distance": "Distance",
    "goals.workouts": "Workouts",
    "goals.workouts_unit": "workouts",

    // Personal Records
    "prs.title": "Personal Records",
    "prs.empty": "Complete running workouts to log your records here!",
    "prs.longest_distance": "Longest Distance",
    "prs.best_pace": "Best Pace",
    "prs.longest_duration": "Longest Duration",
    "prs.highest_elevation": "Highest Elevation",
    "prs.congrats_title": "Personal Record Broken! 🏆",
    "prs.congrats_sub": "This workout established your best mark in: ",

    // Activity List
    "activities.title": "Activities",
    "activities.registered_count": "{count} workout(s) logged",
    "activities.empty": "No workouts yet.",
    "activities.import_btn": "Import workout",
    "activities.recorded_on": "Recorded on RunFlow",

    // Activity Detail
    "detail.not_found": "Workout not found.",
    "detail.loading": "Loading workout...",
    "detail.distance": "Distance",
    "detail.duration": "Duration",
    "detail.avg_pace": "Average pace",
    "detail.elevation": "Elevation",
    "detail.calories": "Calories",
    "detail.calories_source_file": "From file or estimated",
    "detail.calories_source_profile": "Estimated by profile",
    "detail.kcal_sub": "Set your weight in profile",
    "detail.avg_max_hr": "Avg / max HR",
    "detail.confirm_delete": "Permanently delete this workout?",
    "detail.deleting": "Deleting...",
    "detail.delete_btn": "Delete",

    // Recording
    "record.title": "Start workout",
    "record.active_title": "Workout in progress",
    "record.active_sub": "GPS active — keep the app open during run",
    "record.inactive_sub": "Record your run with GPS, like in Strava",
    "record.discard_confirm": "Discard this in-progress workout? Data will not be saved.",
    "record.discard_btn": "Discard workout",
    "record.points_count": "{count} GPS points",
    "record.paused": "Paused",
    "record.activity_type": "Activity type",
    "record.guide_gps": "Use outdoors for best GPS signal",
    "record.guide_permission": "Allow location access when prompted",
    "record.guide_profile": "Profile with weight to estimate calories",
    "record.guide_min": "Minimum: 20 m and 15 seconds to save",
    "record.start_btn": "Start",
    "record.pause_btn": "Pause",
    "record.resume_btn": "Resume",
    "record.stop_btn": "Finish",
    "record.confirm_stop_btn": "Confirm stop",
    "record.saving_workout": "Saving workout...",
    "record.map_loading": "Loading map...",
    "record.current_pace": "Current pace",
    "record.time": "Time",
    "record.close": "Close",

    // Import Form
    "import.drag_gpx_fit": "Drag GPX or FIT files here",
    "import.guide": "Export your workouts from your Amazfit watch using the Zepp app or open-source tools (see guide below) and import them here.",
    "import.choose_files": "Choose files",
    "import.importing": "Importing...",
    "import.val_files": "Select .gpx or .fit files exported from Amazfit/Zepp.",
    "import.success": "{count} workout(s) successfully imported!",

    // Splits
    "splits.title": "Laps (every 1 km)",
    "splits.lap": "Lap",
    "splits.distance": "Distance",
    "splits.pace": "Pace",
    "splits.elevation": "Elevation",
    "splits.hr": "Avg HR",
    "splits.final": "Final",

    // Sports
    "sport.running": "Run",
    "sport.walking": "Walk",
    "sport.cycling": "Ride",
    "sport.other": "Other",

    // Export GPX
    "export.gpx_btn": "Export GPX",
    "export.exporting": "Exporting...",
    "export.error": "Error exporting GPX",
    "export.tooltip": "Export or share GPX",
    "export.tooltip_no_points": "Not enough GPS points",

    // Charts
    "charts.title": "Workout analysis",
    "charts.pace_km": "Pace per km",
    "charts.pace_time": "Pace over time",
    "charts.pace_tip": "Lower value = faster pace",
    "charts.elevation": "Elevation",
    "charts.hr": "Heart rate",
    "charts.distance_km": "Distance (km)",
    "charts.kilometer": "Kilometer",
    "charts.hr_not_available": "HR available in workouts imported from FIT or watches with sensors.",
    "charts.insufficient_data": "Insufficient data for chart.",
    "charts.graph": "Chart",

    // Map
    "map.no_gps": "No GPS data to display map.",

    // Import Guide Page
    "import.page_title": "Import workouts",
    "import.subtitle": "Support for GPX and FIT files — the formats used when exporting from Amazfit/Zepp.",
    "import.why_no_sync_title": "Why doesn't it sync directly with Zepp?",
    "import.why_no_sync_desc1_1": "The Zepp/Huami cloud is ",
    "import.why_no_sync_desc1_strong": "proprietary",
    "import.why_no_sync_desc1_2": ". There is no stable public API for independent apps. The official API (",
    "import.why_no_sync_desc1_3": ") requires enterprise partnership; endpoints used by open source exporters are undocumented and may stop working at any time.",
    "import.why_no_sync_desc2_1": "RunFlow imports ",
    "import.why_no_sync_desc2_strong": "GPX or FIT files",
    "import.why_no_sync_desc2_2": " — the recommended and reliable method. Your data remains only on your computer.",
    "import.how_to_export_title": "How to export from Amazfit",
    "import.how_to_export_step1_1": "Install the ",
    "import.how_to_export_step1_strong": "Zepp",
    "import.how_to_export_step1_2": " app on your phone and sync your Amazfit watch.",
    "import.how_to_export_step2_1": "Use an open-source tool to download your workouts in GPX or FIT, for example ",
    "import.how_to_export_step2_or": " or ",
    "import.how_to_export_step3_1": "For these tools, obtain the ",
    "import.how_to_export_step3_2": " on the privacy/GDPR page (",
    "import.how_to_export_step3_3": ", F12 → Network) — see each project's documentation.",
    "import.how_to_export_step4_1": "Alternative: export ",
    "import.how_to_export_step4_strong": "one workout at a time",
    "import.how_to_export_step4_2": " to GPX using the Zepp app itself (manual).",
    "import.how_to_export_step5_1": "Upload the ",
    "import.how_to_export_step5_or": " or ",
    "import.how_to_export_step5_2": " files to the area above.",
    "import.gdpr_warning": "Huami's GDPR export usually does not include GPS activities. Community tools or manual export are therefore required.",
  }
};

interface I18nContextProps {
  language: Language;
  t: (key: string, variables?: Record<string, string | number>) => string;
  changeLanguage: (lang: Language) => Promise<void>;
  loading: boolean;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("pt");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreferredLanguage() {
      try {
        const profile = await getUserProfile();
        if (profile?.language) {
          setLanguage(profile.language);
        } else {
          // Detect system browser language, fallback to Portuguese
          const browserLang = navigator.language.slice(0, 2);
          if (browserLang === "en" || browserLang === "pt") {
            setLanguage(browserLang);
          } else {
            setLanguage("pt");
          }
        }
      } catch (err) {
        console.error("Failed to load preferred language:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPreferredLanguage();
  }, []);

  const changeLanguage = async (nextLang: Language) => {
    setLanguage(nextLang);
    try {
      const current = await getUserProfile();
      if (current) {
        const { updatedAt, ...rest } = current;
        await saveUserProfile({
          ...rest,
          language: nextLang,
        });
      } else {
        await saveUserProfile({
          language: nextLang,
        });
      }
    } catch (err) {
      console.error("Failed to save preferred language:", err);
    }
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    const dictionary = translations[language];
    let text =
      dictionary[key as keyof typeof dictionary] ||
      translations["pt"][key as keyof typeof translations["pt"]] ||
      key;

    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return (
    <I18nContext.Provider value={{ language, t, changeLanguage, loading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
