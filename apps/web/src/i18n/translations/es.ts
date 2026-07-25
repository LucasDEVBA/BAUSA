// ─── Español — tono formal, premium, neutro para América Latina ───
import type { Translations } from "./pt";

const es: Translations = {
  header: {
    protectedData: "Datos protegidos",
  },

  form: {
    stage1Badge: "Etapa 1",
    stage2Badge: "Etapa 2",
    stageOf: "de",
    complete: "% completado",
    optional: "opcional",
    selectPlaceholder: "Seleccione una opción",

    welcome: {
      badge: "Evaluación Estratégica",
      title1: "Los proyectos de vida exigen",
      title2: "criterio y dirección.",
      line1: "BAU Global conduce proyectos de vida dentro del sistema educativo deportivo de los Estados Unidos, con acompañamiento continuo desde la High School hasta la universidad, y más allá.",
      line2: "Trabajamos con un grupo selecto por ciclo, asegurando la cercanía y responsabilidad acordes con lo que está en juego:",
      line2Bold: "el futuro de un joven.",
      line3: "Cada candidatura es analizada individualmente, considerando el momento, la visión familiar y el potencial de acceso a oportunidades de excelencia.",
      line4: "Las candidaturas alineadas son invitadas a una conversación estratégica con el fundador de BAU Global.",
      cta: "Proceder a la Evaluación Estratégica",
      footer: "Su información es confidencial y se utiliza únicamente para esta evaluación.",
    },

    step1: {
      header: "Información Inicial",
      name: { label: "Nombre completo del atleta", placeholder: "Nombre completo" },
      birth: { label: "Fecha de Nacimiento" },
      whatsapp: { label: "WhatsApp", placeholder: "+54 (11) 0000-0000" },
      schoolYear: {
        label: "Grado / Año actual",
        placeholder: "Seleccione su grado",
        opt_before_7th:  "Anterior al 7º Año",
        opt_8th:         "8º Año — Secundaria",
        opt_9th:         "9º Año — Secundaria",
        opt_hs1:         "1º Año — Bachillerato",
        opt_hs2:         "2º Año — Bachillerato",
        opt_hs3:         "3º Año — Bachillerato",
        opt_grad_last:   "Me gradué el año pasado",
        opt_grad_2plus:  "Me gradué hace más de dos años",
      },
    },

    step2: {
      header: "Contexto Educativo Actual",
      school: { label: "Nombre de la escuela", placeholder: "Nombre de la escuela" },
      cityState: { label: "Ciudad / Estado", placeholder: "Ej: Buenos Aires, BA" },
      educationModel: {
        label: "Modelo educativo",
        bilingual: "Bilingüe",
        international: "Internacional",
        traditional: "Tradicional",
        other: "Otro",
      },
    },

    step3: {
      header: "Trayectoria Deportiva",
      position: { label: "Posición", placeholder: "Ej: Mediocampista" },
      clubs: { label: "Club actual e historial de equipos", placeholder: "Describe tu club actual y equipos anteriores..." },
      achievements: { label: "Principales logros", placeholder: "Campeonatos, títulos, convocatorias..." },
      instagram: { label: "Instagram", placeholder: "@usuario" },
      video: { label: "Enlace a video de juego o highlights del atleta", placeholder: "https://youtube.com/...", helper: "YouTube, Vimeo o similar" },
    },

    step4: {
      header: "Momento de Inicio",
      question: "¿Cuándo planea la familia iniciar el proyecto estructurado en el sistema educativo deportivo americano?",
      nextYear: "Próximo año lectivo",
      twoYears: "En hasta 2 años",
      exploring: "Solo evaluando posibilidades",
      undefined: "Aún sin definición",
    },

    step5: {
      header: "Dirección del Proyecto",
      question: "¿Cuál es la prioridad principal de la familia en este proyecto?",
      academic: "Formación académica de excelencia",
      university: "Planificación universitaria estructurada",
      sports: "Desarrollo deportivo consistente",
      human: "Formación humana con visión de largo plazo",
      integrated: "Integración entre todos los pilares",
    },

    stage2: {
      badge: "Etapa 2 — Lectura Estratégica",
      title1: "Alineamiento",
      title2: "de Perfil",
      line1: "En esta etapa profundizamos en la comprensión del joven y de la estructura familiar que sustenta esta decisión.",
      line2: "Cada respuesta contribuye a organizar la dirección con seguridad estratégica, alineando las elecciones al momento del joven y a la visión de largo plazo de la familia.",
      cta: "Continuar",
    },

    step7: {
      header: "Base Académica",
      performance: {
        label: "Rendimiento académico actual",
        high: "Alto y consistente",
        good: "Bueno con potencial de evolución",
        average: "Mediano, pero comprometido",
        needs: "Necesita reorientación académica",
      },
      english: {
        label: "Nivel actual de inglés",
        fluent: "Fluido",
        advanced: "Avanzado",
        intermediate: "Intermedio",
        basic: "Básico",
      },
    },

    step8: {
      header: "Perfil de Comportamiento",
      question: "¿Cómo percibe el estado actual del joven en relación con una experiencia en los Estados Unidos?",
      ready: "Preparado para avanzar",
      interested: "Interesado, con necesidad de orientación",
      exploring: "Está conociendo mejor esta posibilidad",
    },

    step9: {
      header: "Compromiso del Joven",
      question: "¿El joven demuestra disposición real para asumir un proyecto estructurado fuera del país?",
      initiative: "Sí, demuestra iniciativa",
      guidance: "Sí, pero necesita orientación",
      maturing: "Aún en proceso de maduración",
    },

    step10: {
      header: "Estructura de Decisión Familiar",
      question: "¿En qué momento se encuentra la decisión de su familia en relación a esta oportunidad en los Estados Unidos?",
      mature: "Una decisión madurada a lo largo del tiempo, ya integrada en la planificación familiar",
      recent: "Una decisión reciente, pero con intención clara de avanzar",
      exploring: "Estamos conociendo mejor esta posibilidad antes de decidir",
    },

    step11: {
      header: "Estructura Estratégica",
      desc1: "Inversión anual (USD) para una estructura completa: educación, alojamiento, seguro médico y desarrollo deportivo.",
      desc2: "Los proyectos con mayor estructura ofrecen mayor control estratégico y acceso a entornos más selectivos.",
      question: "¿Cuál es la inversión anual (USD) que su familia está preparada para destinar a este proyecto en EE.UU.?",
      helper: "Valores estimados en USD por año.",
      footer: "Información utilizada exclusivamente para el alineamiento estratégico.",
      range1: "US$ 15.000 a US$ 20.000",
      range2: "US$ 20.000 a US$ 30.000",
      range3: "US$ 30.000 a US$ 40.000",
      range4: "US$ 40.000 a US$ 50.000",
      range5: "US$ 50.000 a US$ 70.000",
      range6: "Por encima de US$ 70.000",
    },

    step12: {
      header: "Representante Legal",
      name: { label: "Nombre completo", placeholder: "Nombre completo" },
      profession: { label: "Profesión", placeholder: "Profesión" },
      phone: { label: "Teléfono / WhatsApp" },
      email: { label: "Correo electrónico", placeholder: "email@ejemplo.com" },
    },

    step13: {
      header: "Dirección Residencial",
      country: { label: "País" },
      cep: { label: "Código Postal", placeholder: "00000-000", searching: "Buscando dirección..." },
      street: { label: "Calle / Avenida", placeholder: "Nombre de la calle" },
      number: { label: "Número", placeholder: "123" },
      complement: { label: "Complemento", placeholder: "Apto 45" },
      neighborhood: { label: "Barrio", placeholder: "Nombre del barrio" },
      city: { label: "Ciudad", placeholder: "Ciudad" },
      state: { label: "Estado/Prov.", placeholder: "BA" },
      postalCode: { label: "Código Postal", placeholder: "Ej: 1001" },
      address: { label: "Dirección", placeholder: "Calle / Avenida" },
    },

    nav: {
      back: "Volver",
      confirm: "Confirmar",
      proceed: "Proceder al Análisis Estratégico Completo",
      submit: "Finalizar",
      submitting: "Enviando...",
    },

    success: {
      title: "Candidatura completada.",
      line1: "Nuestro equipo evaluará su perfil y se pondrá en contacto en un máximo de 48 horas.",
      line2: "Mucha suerte.",
      team: "Equipo BAU Global",
      edit: "Editar su respuesta",
    },

    error: {
      title: "Error al enviar",
    },

    toast: {
      title: "¡Candidatura completada!",
      description: "Nuestro equipo evaluará su perfil y se pondrá en contacto en un máximo de 48 horas.",
    },

    errors: {
      "Nome é obrigatório": "El nombre es obligatorio",
      "Data de nascimento é obrigatória": "La fecha de nacimiento es obligatoria",
      "WhatsApp é obrigatório": "El WhatsApp es obligatorio",
      "Série é obrigatória": "El grado es obligatorio",
      "Escola é obrigatória": "La escuela es obligatoria",
      "Cidade/Estado é obrigatório": "La Ciudad/Estado es obligatoria",
      "Modelo educacional é obrigatório": "El modelo educativo es obligatorio",
      "Selecione uma opção": "Seleccione una opción",
      "Selecione uma faixa": "Seleccione una franja",
      "Posição é obrigatória": "La posición es obligatoria",
      "Histórico é obrigatório": "El historial de clubes es obligatorio",
      "URL inválida": "URL inválida",
      "Nível atual de inglês": "El nivel de inglés es obligatorio",
      "Profissão é obrigatória": "La profesión es obligatoria",
      "Telefone é obrigatório": "El teléfono es obligatorio",
      "E-mail inválido": "Correo electrónico inválido",
      "E-mail é obrigatório": "El correo electrónico es obligatorio",
      "CEP inválido": "Código postal inválido",
      "Rua é obrigatória": "La calle es obligatoria",
      "Número é obrigatório": "El número es obligatorio",
      "Bairro é obrigatório": "El barrio es obligatorio",
      "Cidade é obrigatória": "La ciudad es obligatoria",
      "Estado é obrigatório": "El estado es obligatorio",
      "País é obrigatório": "El país es obligatorio",
    },
  },

  links: {
    brand: "Educación Deportiva Inteligente®️",
    subtitle: "Proyectos de vida estructurados para jóvenes atletas en el sistema educativo americano.",
    limitedSpots: "Número limitado de familias por ciclo",
    officialSite: "Sitio Oficial",
    card1: {
      label: "Exclusivo",
      title1: "Evaluación",
      title2: "Estratégica",
      description: "Conversación individual con el fundador",
      cta: "Solicitar",
    },
    card2: {
      title: "Enviar Perfil del Atleta",
      description: "Primer paso para entrar en el proceso selectivo del Método S.A.F.E.®️",
    },
    card3: {
      title: "Conversación Directa",
      description: "Resuelve dudas puntuales con un asesor.",
      cta: "Iniciar Chat",
    },
    copyright: "© 2026 BAU Global",
  },
};

export { es };
export default es;
