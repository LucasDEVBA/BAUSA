"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { SchoolDetailSheet } from "./SchoolDetailSheet";
import { listarContatosEscola } from "@/lib/actions/escolas";
import type { School } from "@/types/school";

interface ContatoEscola {
  id: string;
  escola_id: string;
  data_contato: string;
  tipo_contato: string;
  resumo: string;
  created_at: string;
}

interface EscolasClientProps {
  schools: School[];
}

export function EscolasClient({ schools }: EscolasClientProps) {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [contatos, setContatos] = useState<ContatoEscola[]>([]);
  const [, startTransition] = useTransition();

  const handleSelect = useCallback(
    (schoolId: string) => {
      const school = schools.find((s) => s.id === schoolId);
      if (school) setSelectedSchool(school);
    },
    [schools]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest("[data-school-id]");
      if (card) {
        const schoolId = card.getAttribute("data-school-id");
        if (schoolId) handleSelect(schoolId);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [handleSelect]);

  useEffect(() => {
    if (!selectedSchool) return;

    startTransition(async () => {
      const result = await listarContatosEscola(selectedSchool.id);
      if (result.success) {
        setContatos(result.data as ContatoEscola[]);
      }
    });
  }, [selectedSchool]);

  return (
    <>
      {selectedSchool && (
        <SchoolDetailSheet
          school={selectedSchool}
          contatos={contatos}
          open={!!selectedSchool}
          onClose={() => {
            setSelectedSchool(null);
            setContatos([]);
          }}
        />
      )}
    </>
  );
}
