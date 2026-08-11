// Bloco canônico de parâmetros de URL das campanhas Meta (decisão do CEO:
// "UTM é primordial"). {{campaign.id}} é preenchido pela Meta na entrega —
// é o que casa o lead (form_submissions.utm_id) com o gasto
// (meta_ads_campanha.campanha_id) e dá o CAC/ROI exato.
export const UTM_BLOCO_CANONICO =
  "utm_source=instagram&utm_medium=paid&utm_campaign={{campaign.name}}&utm_id={{campaign.id}}";
