"use client";

import { useEffect, useRef, useState } from "react";
import { getUserProfile } from "@/lib/profile";
import type { UserProfile } from "@/lib/types";

/**
 * Carrega o perfil do usuário uma única vez por montagem, com proteção contra
 * respostas obsoletas após desmontagem. Consumidores que precisam do perfil
 * apenas para derivar métricas devem preferir este hook em vez de disparar
 * suas próprias leituras de armazenamento.
 */
export function useProfileData() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    let generation = 0;

    getUserProfile()
      .then((loaded) => {
        if (mountedRef.current && generation === 0) {
          setProfile(loaded);
        }
      })
      .catch((err) => {
        console.error("Falha ao carregar perfil:", err);
      })
      .finally(() => {
        if (mountedRef.current && generation === 0) {
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
      generation += 1;
    };
  }, []);

  return { profile, loading };
}
