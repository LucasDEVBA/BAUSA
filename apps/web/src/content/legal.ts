/**
 * Textos legais — Política de Privacidade e Exclusão de Dados.
 *
 * Ficam FORA de `src/i18n/translations/*` de propósito: são documentos de
 * texto corrido, versionados por data, com ciclo de revisão próprio (jurídico)
 * — misturá-los com as strings de UI faria os dois arquivos brigarem por
 * motivos diferentes.
 *
 * ⚠️ O conteúdo descreve o tratamento de dados REAL do sistema (formulário,
 * WhatsApp, Instagram, IA de qualificação, reuniões). Se um fluxo novo passar
 * a coletar algo que não está aqui, ESTE arquivo tem que mudar junto — uma
 * política que não descreve a prática é pior do que não ter política.
 */

export type LocaleLegal = "pt" | "en" | "es";

export interface SecaoLegal {
  titulo: string;
  /** Parágrafos de texto corrido. */
  paragrafos?: string[];
  /** Itens de lista (renderizados como <ul>). */
  itens?: string[];
}

export interface DocumentoLegal {
  titulo: string;
  atualizadoEm: string;
  intro: string[];
  secoes: SecaoLegal[];
}

/** Data única de vigência dos dois documentos (formatada por idioma na UI). */
export const LEGAL_ATUALIZADO_ISO = "2026-08-15";

const EMPRESA_PT =
  "BAUSA GLOBAL PLACEMENT LTDA (“Bolsa Atleta USA”), inscrita no CNPJ 61.792.817/0001-34";
const EMPRESA_EN =
  "BAUSA GLOBAL PLACEMENT LTDA (“Bolsa Atleta USA”), a Brazilian company registered under CNPJ 61.792.817/0001-34";
const EMPRESA_ES =
  "BAUSA GLOBAL PLACEMENT LTDA (“Bolsa Atleta USA”), empresa brasileña inscrita bajo el CNPJ 61.792.817/0001-34";

const CONTATO = "contato@bolsaatletausa.com";

// ─── Política de Privacidade ─────────────────────────────────────────────

export const PRIVACIDADE: Record<LocaleLegal, DocumentoLegal> = {
  pt: {
    titulo: "Política de Privacidade",
    atualizadoEm: "Atualizada em 15 de agosto de 2026",
    intro: [
      `Esta política explica quais dados a ${EMPRESA_PT} coleta, por que coleta, com quem compartilha e o que você pode exigir a respeito.`,
      "Escrevemos em linguagem direta de propósito. Se algo aqui não estiver claro, escreva para " +
        `${CONTATO} e nós explicamos.`,
    ],
    secoes: [
      {
        titulo: "1. Quais dados coletamos",
        paragrafos: [
          "Coletamos apenas o que você nos informa e o que é gerado pelo seu contato conosco. Não compramos listas e não coletamos dados de terceiros sobre você.",
        ],
        itens: [
          "Dados do atleta: nome, data de nascimento, WhatsApp, ano escolar, escola, cidade, esporte, posição, clubes, conquistas, perfil de Instagram e vídeos que você optar por enviar.",
          "Dados acadêmicos e de perfil: desempenho escolar, nível de inglês e as respostas do questionário de perfil e comprometimento.",
          "Dados do responsável: nome, telefone, e-mail, profissão e faixa de investimento pretendida.",
          "Endereço: país, CEP, rua, número, complemento, bairro, cidade e estado.",
          "Conversas: o conteúdo das mensagens trocadas conosco por WhatsApp e por Instagram (mensagens diretas e comentários nos nossos próprios posts).",
          "Reuniões: data, horário e, quando a reunião é gravada com aviso aos participantes, a transcrição gerada pelo Google Meet.",
          "Dados técnicos e de origem: endereço de origem do acesso (referrer), página de entrada, parâmetros de campanha (UTM), identificador de sessão, tipo de dispositivo e o momento em que o formulário foi iniciado.",
        ],
      },
      {
        titulo: "2. Por que usamos esses dados",
        itens: [
          "Avaliar o perfil do atleta e a viabilidade de um projeto de bolsa esportiva nos Estados Unidos.",
          "Entrar em contato para dar retorno, tirar dúvidas e agendar reuniões.",
          "Prestar o serviço contratado e acompanhar a família ao longo do processo.",
          "Entender quais canais de divulgação funcionam, para investir melhor.",
          "Cumprir obrigações legais, contratuais e fiscais.",
        ],
      },
      {
        titulo: "3. Uso de inteligência artificial",
        paragrafos: [
          "Usamos inteligência artificial (Google Gemini) para uma triagem inicial do perfil informado no formulário e para resumir conversas e reuniões internamente. Essa triagem organiza a fila de atendimento — ela não decide sozinha se você será ou não atendido, e toda decisão relevante passa por uma pessoa da nossa equipe.",
          "Nas conversas automatizadas por WhatsApp e Instagram, as respostas automáticas se identificam como tal e sempre oferecem caminho para falar com um atendente humano.",
        ],
      },
      {
        titulo: "4. Com quem compartilhamos",
        paragrafos: [
          "Não vendemos seus dados. Não os cedemos para publicidade de terceiros. Compartilhamos apenas com os fornecedores necessários para operar o serviço, e apenas o necessário:",
        ],
        itens: [
          "Supabase — banco de dados onde as informações ficam armazenadas, criptografadas em repouso.",
          "Google Cloud Platform — execução dos serviços de processamento.",
          "Vercel — hospedagem deste site.",
          "Google Workspace (Planilhas, Agenda, Meet e Drive) — organização interna, agendamento e transcrição de reuniões.",
          "Z-API — envio e recebimento das mensagens de WhatsApp.",
          "Meta (Instagram) — recebimento e resposta de mensagens e comentários na nossa conta.",
          "Resend e Brevo — envio dos e-mails transacionais.",
          "Google Gemini — a triagem e os resumos descritos no item 3.",
          "Google Analytics, Google Tag Manager e Meta Pixel — medição de audiência e desempenho de campanhas.",
        ],
      },
      {
        titulo: "5. Por quanto tempo guardamos",
        paragrafos: [
          "Enquanto durar o atendimento ou a relação contratual, e depois pelo prazo exigido por lei (por exemplo, obrigações fiscais e contábeis). Passados esses prazos, os dados são apagados ou anonimizados.",
          "Se você pedir a exclusão antes disso, atendemos conforme descrito no item 7.",
        ],
      },
      {
        titulo: "6. Como protegemos",
        itens: [
          "Comunicação sempre por conexão criptografada (HTTPS/TLS).",
          "Dados criptografados em repouso no banco.",
          "Acesso restrito por papel: cada pessoa da equipe enxerga apenas o necessário para o seu trabalho.",
          "Registro de auditoria das ações sensíveis realizadas nos nossos sistemas internos.",
        ],
      },
      {
        titulo: "7. Seus direitos",
        paragrafos: [
          "Pela Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018) você pode, a qualquer momento:",
        ],
        itens: [
          "Confirmar se tratamos dados seus e obter acesso a eles.",
          "Corrigir dados incompletos, inexatos ou desatualizados.",
          "Pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em desconformidade com a lei.",
          "Solicitar a portabilidade dos dados.",
          "Revogar o consentimento e pedir a exclusão dos dados tratados com base nele.",
          "Se opor a um tratamento e pedir revisão de decisões automatizadas.",
        ],
      },
      {
        titulo: "8. Como exercer seus direitos",
        paragrafos: [
          `Escreva para ${CONTATO} com o assunto “Privacidade”. Respondemos em até 15 dias.`,
          "Para excluir seus dados, veja a página de Exclusão de Dados, com o passo a passo detalhado.",
        ],
      },
      {
        titulo: "9. Menores de idade",
        paragrafos: [
          "Nosso serviço envolve atletas adolescentes. O cadastro é feito pelo responsável legal, ou com a ciência e o consentimento dele. Se identificarmos dados de menor enviados sem esse consentimento, apagamos ao tomar conhecimento.",
        ],
      },
      {
        titulo: "10. Mudanças nesta política",
        paragrafos: [
          "Se mudarmos esta política, publicamos a nova versão nesta página com a data de atualização. Mudanças relevantes são comunicadas pelos canais de contato que você nos informou.",
        ],
      },
      {
        titulo: "11. Contato",
        paragrafos: [
          `${EMPRESA_PT}. Encarregado de dados: ${CONTATO}.`,
        ],
      },
    ],
  },

  en: {
    titulo: "Privacy Policy",
    atualizadoEm: "Last updated on August 15, 2026",
    intro: [
      `This policy explains what data ${EMPRESA_EN} collects, why we collect it, who we share it with, and what you can require from us.`,
      `We wrote it in plain language on purpose. If anything is unclear, write to ${CONTATO} and we will explain.`,
    ],
    secoes: [
      {
        titulo: "1. What we collect",
        paragrafos: [
          "We only collect what you tell us and what is generated by your contact with us. We do not buy lists and we do not collect third-party data about you.",
        ],
        itens: [
          "Athlete data: name, date of birth, WhatsApp number, school year, school, city, sport, position, clubs, achievements, Instagram profile and any videos you choose to send.",
          "Academic and profile data: school performance, English level, and your answers to the profile and commitment questionnaire.",
          "Parent or guardian data: name, phone number, e-mail address, occupation and intended investment range.",
          "Address: country, postal code, street, number, complement, neighborhood, city and state.",
          "Conversations: the content of messages exchanged with us on WhatsApp and on Instagram (direct messages and comments on our own posts).",
          "Meetings: date, time and, when a meeting is recorded with notice to participants, the transcript generated by Google Meet.",
          "Technical and attribution data: referrer, landing page, campaign parameters (UTM), session identifier, device type and the moment the form was started.",
        ],
      },
      {
        titulo: "2. Why we use it",
        itens: [
          "To assess the athlete's profile and whether a U.S. athletic scholarship project is feasible.",
          "To get in touch, answer questions and schedule meetings.",
          "To deliver the contracted service and support the family throughout the process.",
          "To understand which marketing channels work, so we can invest better.",
          "To comply with legal, contractual and tax obligations.",
        ],
      },
      {
        titulo: "3. Use of artificial intelligence",
        paragrafos: [
          "We use artificial intelligence (Google Gemini) for an initial assessment of the profile submitted through the form, and to summarize conversations and meetings internally. This assessment organizes our service queue — it does not decide on its own whether you will be served, and every relevant decision is made by a member of our team.",
          "In automated conversations on WhatsApp and Instagram, automated replies identify themselves as such and always offer a path to a human agent.",
        ],
      },
      {
        titulo: "4. Who we share it with",
        paragrafos: [
          "We do not sell your data. We do not hand it over for third-party advertising. We share it only with the providers required to operate the service, and only what is required:",
        ],
        itens: [
          "Supabase — the database where information is stored, encrypted at rest.",
          "Google Cloud Platform — execution of our processing services.",
          "Vercel — hosting of this website.",
          "Google Workspace (Sheets, Calendar, Meet and Drive) — internal organization, scheduling and meeting transcripts.",
          "Z-API — sending and receiving WhatsApp messages.",
          "Meta (Instagram) — receiving and replying to messages and comments on our account.",
          "Resend and Brevo — sending transactional e-mails.",
          "Google Gemini — the assessment and summaries described in item 3.",
          "Google Analytics, Google Tag Manager and Meta Pixel — audience measurement and campaign performance.",
        ],
      },
      {
        titulo: "5. How long we keep it",
        paragrafos: [
          "For as long as the service or the contractual relationship lasts, and afterwards for the period required by law (for example, tax and accounting obligations). After those periods, data is deleted or anonymized.",
          "If you request deletion before that, we comply as described in item 7.",
        ],
      },
      {
        titulo: "6. How we protect it",
        itens: [
          "All communication over encrypted connections (HTTPS/TLS).",
          "Data encrypted at rest in the database.",
          "Role-based access: each team member sees only what their work requires.",
          "Audit logs of sensitive actions performed in our internal systems.",
        ],
      },
      {
        titulo: "7. Your rights",
        paragrafos: [
          "Under the Brazilian General Data Protection Law (LGPD, Law 13.709/2018) you may, at any time:",
        ],
        itens: [
          "Confirm whether we process your data and obtain access to it.",
          "Correct incomplete, inaccurate or outdated data.",
          "Request anonymization, blocking or deletion of unnecessary data or data processed unlawfully.",
          "Request data portability.",
          "Withdraw consent and request deletion of data processed on that basis.",
          "Object to processing and request review of automated decisions.",
        ],
      },
      {
        titulo: "8. How to exercise your rights",
        paragrafos: [
          `Write to ${CONTATO} with the subject “Privacy”. We reply within 15 days.`,
          "To delete your data, see our Data Deletion page for step-by-step instructions.",
        ],
      },
      {
        titulo: "9. Minors",
        paragrafos: [
          "Our service involves teenage athletes. Registration is completed by the legal guardian, or with their knowledge and consent. If we identify a minor's data submitted without such consent, we delete it as soon as we become aware.",
        ],
      },
      {
        titulo: "10. Changes to this policy",
        paragrafos: [
          "If we change this policy, we publish the new version on this page with the updated date. Material changes are communicated through the contact channels you provided.",
        ],
      },
      {
        titulo: "11. Contact",
        paragrafos: [`${EMPRESA_EN}. Data protection contact: ${CONTATO}.`],
      },
    ],
  },

  es: {
    titulo: "Política de Privacidad",
    atualizadoEm: "Actualizada el 15 de agosto de 2026",
    intro: [
      `Esta política explica qué datos recopila ${EMPRESA_ES}, por qué los recopila, con quién los comparte y qué puede exigir usted al respecto.`,
      `La escribimos en lenguaje directo a propósito. Si algo no queda claro, escriba a ${CONTATO} y se lo explicamos.`,
    ],
    secoes: [
      {
        titulo: "1. Qué datos recopilamos",
        paragrafos: [
          "Recopilamos solo lo que usted nos informa y lo que se genera por su contacto con nosotros. No compramos listas ni recopilamos datos de terceros sobre usted.",
        ],
        itens: [
          "Datos del atleta: nombre, fecha de nacimiento, WhatsApp, año escolar, escuela, ciudad, deporte, posición, clubes, logros, perfil de Instagram y los videos que decida enviar.",
          "Datos académicos y de perfil: desempeño escolar, nivel de inglés y las respuestas del cuestionario de perfil y compromiso.",
          "Datos del responsable: nombre, teléfono, correo electrónico, profesión y rango de inversión previsto.",
          "Dirección: país, código postal, calle, número, complemento, barrio, ciudad y estado.",
          "Conversaciones: el contenido de los mensajes intercambiados con nosotros por WhatsApp y por Instagram (mensajes directos y comentarios en nuestras propias publicaciones).",
          "Reuniones: fecha, hora y, cuando la reunión se graba con aviso a los participantes, la transcripción generada por Google Meet.",
          "Datos técnicos y de origen: referrer, página de entrada, parámetros de campaña (UTM), identificador de sesión, tipo de dispositivo y el momento en que se inició el formulario.",
        ],
      },
      {
        titulo: "2. Para qué usamos estos datos",
        itens: [
          "Evaluar el perfil del atleta y la viabilidad de un proyecto de beca deportiva en Estados Unidos.",
          "Ponernos en contacto para dar respuesta, resolver dudas y agendar reuniones.",
          "Prestar el servicio contratado y acompañar a la familia durante el proceso.",
          "Entender qué canales de difusión funcionan, para invertir mejor.",
          "Cumplir obligaciones legales, contractuales y fiscales.",
        ],
      },
      {
        titulo: "3. Uso de inteligencia artificial",
        paragrafos: [
          "Usamos inteligencia artificial (Google Gemini) para una evaluación inicial del perfil informado en el formulario y para resumir conversaciones y reuniones internamente. Esa evaluación organiza la fila de atención — no decide por sí sola si usted será atendido, y toda decisión relevante pasa por una persona de nuestro equipo.",
          "En las conversaciones automatizadas por WhatsApp e Instagram, las respuestas automáticas se identifican como tales y siempre ofrecen una vía para hablar con una persona.",
        ],
      },
      {
        titulo: "4. Con quién los compartimos",
        paragrafos: [
          "No vendemos sus datos. No los cedemos para publicidad de terceros. Los compartimos solo con los proveedores necesarios para operar el servicio, y solo lo necesario:",
        ],
        itens: [
          "Supabase — base de datos donde se almacena la información, cifrada en reposo.",
          "Google Cloud Platform — ejecución de los servicios de procesamiento.",
          "Vercel — alojamiento de este sitio.",
          "Google Workspace (Hojas de cálculo, Calendario, Meet y Drive) — organización interna, agenda y transcripción de reuniones.",
          "Z-API — envío y recepción de los mensajes de WhatsApp.",
          "Meta (Instagram) — recepción y respuesta de mensajes y comentarios en nuestra cuenta.",
          "Resend y Brevo — envío de los correos transaccionales.",
          "Google Gemini — la evaluación y los resúmenes descritos en el punto 3.",
          "Google Analytics, Google Tag Manager y Meta Pixel — medición de audiencia y desempeño de campañas.",
        ],
      },
      {
        titulo: "5. Cuánto tiempo los conservamos",
        paragrafos: [
          "Mientras dure la atención o la relación contractual, y después por el plazo exigido por ley (por ejemplo, obligaciones fiscales y contables). Transcurridos esos plazos, los datos se eliminan o se anonimizan.",
          "Si usted solicita la eliminación antes, la atendemos según el punto 7.",
        ],
      },
      {
        titulo: "6. Cómo los protegemos",
        itens: [
          "Comunicación siempre por conexión cifrada (HTTPS/TLS).",
          "Datos cifrados en reposo en la base de datos.",
          "Acceso restringido por rol: cada persona del equipo ve solo lo necesario para su trabajo.",
          "Registro de auditoría de las acciones sensibles realizadas en nuestros sistemas internos.",
        ],
      },
      {
        titulo: "7. Sus derechos",
        paragrafos: [
          "Por la Ley General de Protección de Datos de Brasil (LGPD, Ley 13.709/2018) usted puede, en cualquier momento:",
        ],
        itens: [
          "Confirmar si tratamos datos suyos y obtener acceso a ellos.",
          "Corregir datos incompletos, inexactos o desactualizados.",
          "Solicitar la anonimización, el bloqueo o la eliminación de datos innecesarios o tratados de forma no conforme con la ley.",
          "Solicitar la portabilidad de los datos.",
          "Revocar el consentimiento y solicitar la eliminación de los datos tratados con base en él.",
          "Oponerse a un tratamiento y solicitar la revisión de decisiones automatizadas.",
        ],
      },
      {
        titulo: "8. Cómo ejercer sus derechos",
        paragrafos: [
          `Escriba a ${CONTATO} con el asunto “Privacidad”. Respondemos en un plazo de 15 días.`,
          "Para eliminar sus datos, consulte la página de Eliminación de Datos, con el paso a paso detallado.",
        ],
      },
      {
        titulo: "9. Menores de edad",
        paragrafos: [
          "Nuestro servicio involucra atletas adolescentes. El registro lo realiza el responsable legal, o con su conocimiento y consentimiento. Si identificamos datos de un menor enviados sin ese consentimiento, los eliminamos al tomar conocimiento.",
        ],
      },
      {
        titulo: "10. Cambios en esta política",
        paragrafos: [
          "Si cambiamos esta política, publicamos la nueva versión en esta página con la fecha de actualización. Los cambios relevantes se comunican por los canales de contacto que usted nos informó.",
        ],
      },
      {
        titulo: "11. Contacto",
        paragrafos: [`${EMPRESA_ES}. Contacto de protección de datos: ${CONTATO}.`],
      },
    ],
  },
};

// ─── Exclusão de Dados ───────────────────────────────────────────────────
// Exigida pela Meta no App Review (campo "User data deletion"). Precisa ser
// uma instrução concreta e verificável — não uma promessa genérica.

export const EXCLUSAO: Record<LocaleLegal, DocumentoLegal> = {
  pt: {
    titulo: "Exclusão de Dados",
    atualizadoEm: "Atualizada em 15 de agosto de 2026",
    intro: [
      "Esta página explica como pedir a exclusão dos seus dados dos sistemas da Bolsa Atleta USA, o que é apagado e em quanto tempo.",
    ],
    secoes: [
      {
        titulo: "Como pedir",
        paragrafos: [
          `Envie um e-mail para ${CONTATO} com o assunto “Exclusão de dados”, informando o nome do atleta e o e-mail ou telefone usado no cadastro. Esses dados servem apenas para localizar o registro correto.`,
          "Se você chegou até nós pelo Instagram ou pelo WhatsApp, também pode responder a própria conversa com a palavra EXCLUIR. O pedido é registrado do mesmo jeito.",
        ],
      },
      {
        titulo: "O que é apagado",
        itens: [
          "Todos os dados do formulário: atleta, responsável, endereço, respostas do questionário e dados de origem.",
          "O histórico de conversas por WhatsApp e Instagram.",
          "Transcrições e anotações de reuniões.",
          "O registro no nosso sistema interno de acompanhamento.",
        ],
      },
      {
        titulo: "O que pode ser mantido, e por quê",
        paragrafos: [
          "Se existir ou tiver existido um contrato, somos obrigados a manter os documentos fiscais e contábeis pelo prazo da lei. Nesse caso, mantemos apenas o mínimo exigido e apagamos o restante.",
          "Registros de auditoria guardam a informação de que uma exclusão foi solicitada e executada — sem os dados pessoais em si. É o que nos permite comprovar que o pedido foi cumprido.",
        ],
      },
      {
        titulo: "Prazo",
        paragrafos: [
          "Confirmamos o recebimento em até 5 dias úteis e concluímos a exclusão em até 30 dias, avisando você quando estiver feito.",
        ],
      },
      {
        titulo: "Dúvidas",
        paragrafos: [`Escreva para ${CONTATO}. Responder é obrigação nossa, não favor.`],
      },
    ],
  },

  en: {
    titulo: "Data Deletion",
    atualizadoEm: "Last updated on August 15, 2026",
    intro: [
      "This page explains how to request deletion of your data from Bolsa Atleta USA's systems, what gets deleted, and how long it takes.",
    ],
    secoes: [
      {
        titulo: "How to request it",
        paragrafos: [
          `Send an e-mail to ${CONTATO} with the subject “Data deletion”, including the athlete's name and the e-mail address or phone number used at registration. We use those only to locate the correct record.`,
          "If you reached us through Instagram or WhatsApp, you can also reply in that same conversation with the word DELETE. The request is recorded the same way.",
        ],
      },
      {
        titulo: "What gets deleted",
        itens: [
          "All form data: athlete, parent or guardian, address, questionnaire answers and attribution data.",
          "The history of WhatsApp and Instagram conversations.",
          "Meeting transcripts and notes.",
          "The record in our internal tracking system.",
        ],
      },
      {
        titulo: "What may be kept, and why",
        paragrafos: [
          "If a contract exists or existed, we are legally required to keep tax and accounting documents for the period set by law. In that case we keep only the legal minimum and delete the rest.",
          "Audit logs keep the fact that a deletion was requested and carried out — without the personal data itself. That is what allows us to prove the request was honored.",
        ],
      },
      {
        titulo: "Timeline",
        paragrafos: [
          "We acknowledge the request within 5 business days and complete the deletion within 30 days, notifying you when it is done.",
        ],
      },
      {
        titulo: "Questions",
        paragrafos: [`Write to ${CONTATO}. Answering is our obligation, not a favor.`],
      },
    ],
  },

  es: {
    titulo: "Eliminación de Datos",
    atualizadoEm: "Actualizada el 15 de agosto de 2026",
    intro: [
      "Esta página explica cómo solicitar la eliminación de sus datos de los sistemas de Bolsa Atleta USA, qué se elimina y en cuánto tiempo.",
    ],
    secoes: [
      {
        titulo: "Cómo solicitarlo",
        paragrafos: [
          `Envíe un correo a ${CONTATO} con el asunto “Eliminación de datos”, indicando el nombre del atleta y el correo o teléfono usado en el registro. Esos datos sirven únicamente para localizar el registro correcto.`,
          "Si llegó a nosotros por Instagram o WhatsApp, también puede responder en la propia conversación con la palabra ELIMINAR. La solicitud se registra igual.",
        ],
      },
      {
        titulo: "Qué se elimina",
        itens: [
          "Todos los datos del formulario: atleta, responsable, dirección, respuestas del cuestionario y datos de origen.",
          "El historial de conversaciones por WhatsApp e Instagram.",
          "Transcripciones y notas de reuniones.",
          "El registro en nuestro sistema interno de seguimiento.",
        ],
      },
      {
        titulo: "Qué puede conservarse, y por qué",
        paragrafos: [
          "Si existe o existió un contrato, estamos obligados a conservar los documentos fiscales y contables por el plazo de ley. En ese caso conservamos solo el mínimo exigido y eliminamos el resto.",
          "Los registros de auditoría guardan el hecho de que se solicitó y ejecutó una eliminación — sin los datos personales en sí. Es lo que nos permite comprobar que la solicitud se cumplió.",
        ],
      },
      {
        titulo: "Plazo",
        paragrafos: [
          "Confirmamos la recepción en un plazo de 5 días hábiles y completamos la eliminación en un plazo de 30 días, avisándole cuando esté hecho.",
        ],
      },
      {
        titulo: "Dudas",
        paragrafos: [`Escriba a ${CONTATO}. Responder es obligación nuestra, no un favor.`],
      },
    ],
  },
};

/** Normaliza qualquer locale recebido da rota para um dos três suportados. */
export function localeLegal(locale: string): LocaleLegal {
  return locale === "en" || locale === "es" ? locale : "pt";
}
