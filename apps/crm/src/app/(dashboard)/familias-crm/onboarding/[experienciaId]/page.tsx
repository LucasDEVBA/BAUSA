import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getOnboardingByExperiencia } from "@/lib/actions/onboarding";
import { listarReunioesFamilia } from "@/lib/actions/reunioes";
import { Button, Card, EmptyState } from "@/components/ui";
import { OnboardingExecucaoClient } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Onboarding da família",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SemOnboarding() {
  return (
    <div className="mx-auto max-w-lg pt-10">
      <Card variant="plain" padding="none">
        <EmptyState
          icon={Sparkles}
          title="Onboarding não encontrado"
          description="Esta família não tem onboarding criado — onboardings são criados automaticamente quando o deal entra em admission — ou o link está inválido."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/familias-crm">Voltar para Famílias</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}

interface FamiliaResumo {
  atletaNome: string;
  responsavelNome: string | null;
  responsavelEmail: string | null;
  responsavelWhatsapp: string | null;
}

async function getFamiliaResumo(experienciaId: string): Promise<FamiliaResumo> {
  const supabase = await createServerSupabaseClient();
  const { data: exp } = await supabase
    .from("crm_experiencia")
    .select(
      "id, atleta:atletas(nome_completo, responsavel:responsaveis(nome, email, whatsapp))",
    )
    .eq("id", experienciaId)
    .maybeSingle();

  // Supabase devolve embeds como array OU objeto — normalizar defensivo
  const atletaRaw = exp?.atleta as unknown;
  const atleta = (Array.isArray(atletaRaw) ? atletaRaw[0] : atletaRaw) as {
    nome_completo?: string | null;
    responsavel?: unknown;
  } | null;
  const respRaw = atleta?.responsavel;
  const responsavel = (Array.isArray(respRaw) ? respRaw[0] : respRaw) as {
    nome?: string | null;
    email?: string | null;
    whatsapp?: string | null;
  } | null;

  return {
    atletaNome: atleta?.nome_completo ?? "Atleta",
    responsavelNome: responsavel?.nome ?? null,
    responsavelEmail: responsavel?.email ?? null,
    responsavelWhatsapp: responsavel?.whatsapp ?? null,
  };
}

export default async function OnboardingExecucaoPage({
  params,
}: {
  params: Promise<{ experienciaId: string }>;
}) {
  await requirePapel(["ceo", "head_sucesso"]);
  const { experienciaId } = await params;

  if (!UUID_RE.test(experienciaId)) {
    return <SemOnboarding />;
  }

  const [{ instancia, etapas }, reunioes, familia] = await Promise.all([
    getOnboardingByExperiencia(experienciaId),
    listarReunioesFamilia(experienciaId),
    getFamiliaResumo(experienciaId),
  ]);

  if (!instancia) {
    return <SemOnboarding />;
  }

  return (
    <OnboardingExecucaoClient
      experienciaId={experienciaId}
      instanciaInicial={instancia}
      etapasIniciais={etapas}
      reunioesIniciais={reunioes}
      familia={familia}
    />
  );
}
