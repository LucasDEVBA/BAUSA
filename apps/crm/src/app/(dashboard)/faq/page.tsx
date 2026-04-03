import { requirePapel } from "@/lib/auth";
import { listarArtigos } from "@/lib/actions/faq";
import { FaqClient } from "./FaqClient";

export default async function FaqPage() {
  await requirePapel(["ceo", "head_sucesso"]);

  const artigos = await listarArtigos();

  return <FaqClient artigosIniciais={artigos} />;
}
