import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AtribuicaoClient } from "./client";

export interface LeadAttribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  cta_source: string | null;
  device_type: string | null;
  qualification_classification: string | null;
  submitted_at: string;
}

export default async function AtribuicaoPage() {
  const supabase = await createServerSupabaseClient();

  const { data: rows } = await supabase
    .from("form_submissions")
    .select(
      "utm_source, utm_medium, utm_campaign, cta_source, device_type, qualification_classification, submitted_at",
    )
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false });

  return <AtribuicaoClient leads={(rows as LeadAttribution[]) ?? []} />;
}
