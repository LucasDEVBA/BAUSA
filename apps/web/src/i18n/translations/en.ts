// ─── English — formal, premium tone matching Bolsa Atleta USA brand ──
import type { Translations } from "./pt";

const en: Translations = {
  header: {
    protectedData: "Protected data",
  },

  form: {
    stage1Badge: "Stage 1",
    stage2Badge: "Stage 2",
    stageOf: "of",
    complete: "% complete",
    optional: "optional",
    selectPlaceholder: "Select an option",

    welcome: {
      badge: "Strategic Assessment",
      title1: "Life projects demand",
      title2: "precision and direction.",
      line1: "BAU Global guides life projects within the American sports education system, providing continuous support from High School through university, and beyond.",
      line2: "We work with a select group each cycle, ensuring the proximity and accountability the stakes demand:",
      line2Bold: "a young person's future.",
      line3: "Each application is assessed individually, considering timing, family vision, and the potential to access opportunities of excellence.",
      line4: "Aligned candidates are invited for a strategic conversation with the founder of BAU Global.",
      cta: "Proceed to Strategic Assessment",
      footer: "Your information is confidential and used solely for this assessment.",
    },

    step1: {
      header: "Basic Information",
      name: { label: "Athlete's full name", placeholder: "Full name" },
      birth: { label: "Date of Birth" },
      whatsapp: { label: "WhatsApp", placeholder: "+1 (555) 000-0000" },
      schoolYear: {
        label: "Current grade / year",
        placeholder: "Select your grade",
        opt_before_7th:  "Before 7th Grade",
        opt_8th:         "8th Grade — Middle School",
        opt_9th:         "9th Grade — Middle School",
        opt_hs1:         "Freshman — 9th Grade (High School)",
        opt_hs2:         "Sophomore — 10th Grade (High School)",
        opt_hs3:         "Junior / Senior — 11th–12th Grade",
        opt_grad_last:   "Graduated last year",
        opt_grad_2plus:  "Graduated more than two years ago",
      },
    },

    step2: {
      header: "Current Academic Background",
      school: { label: "School name", placeholder: "School name" },
      cityState: { label: "City / State", placeholder: "e.g. New York, NY" },
      educationModel: {
        label: "Educational model",
        bilingual: "Bilingual",
        international: "International",
        traditional: "Traditional",
        other: "Other",
      },
    },

    step3: {
      header: "Athletic Journey",
      position: { label: "Position", placeholder: "e.g. Midfielder" },
      clubs: { label: "Current club and team history", placeholder: "Describe your current club and previous teams..." },
      achievements: { label: "Main achievements", placeholder: "Championships, titles, call-ups..." },
      instagram: { label: "Instagram", placeholder: "@username" },
      video: { label: "Game footage or athlete highlights link", placeholder: "https://youtube.com/...", helper: "YouTube, Vimeo or similar" },
    },

    step4: {
      header: "Starting Point",
      question: "When does the family plan to begin the structured project within the American sports education system?",
      nextYear: "Next academic year",
      twoYears: "Within 2 years",
      exploring: "Just exploring possibilities",
      undefined: "Still undecided",
    },

    step5: {
      header: "Project Direction",
      question: "What is the family's main priority in this project?",
      academic: "Academic excellence education",
      university: "Structured university planning",
      sports: "Consistent athletic development",
      human: "Human development with a long-term vision",
      integrated: "Integration across all pillars",
    },

    stage2: {
      badge: "Stage 2 — Strategic Reading",
      title1: "Profile",
      title2: "Alignment",
      line1: "In this stage, we deepen our understanding of the young athlete and the family structure that supports this decision.",
      line2: "Each response contributes to organizing the direction with strategic certainty, aligning choices with the young person's moment and the family's long-term vision.",
      cta: "Continue",
    },

    step7: {
      header: "Academic Background",
      performance: {
        label: "Current academic performance",
        high: "High and consistent",
        good: "Good with growth potential",
        average: "Average, but committed",
        needs: "Requires academic redirection",
      },
      english: {
        label: "Current English level",
        fluent: "Fluent",
        advanced: "Advanced",
        intermediate: "Intermediate",
        basic: "Basic",
      },
    },

    step8: {
      header: "Behavioral Profile",
      question: "How do you perceive the young person's current stage regarding an experience in the United States?",
      ready: "Ready to advance",
      interested: "Interested, in need of guidance",
      exploring: "Still getting to know this possibility",
    },

    step9: {
      header: "Youth Commitment",
      question: "Does the young person show genuine willingness to take on a structured project abroad?",
      initiative: "Yes, shows initiative",
      guidance: "Yes, but needs guidance",
      maturing: "Still maturing",
    },

    step10: {
      header: "Family Decision Structure",
      question: "Where does your family stand regarding this opportunity in the United States?",
      mature: "A decision that has matured over time, already integrated into family planning",
      recent: "A recent decision, but with a clear intention to move forward",
      exploring: "We are still learning more about this possibility before deciding",
    },

    step11: {
      header: "Strategic Investment",
      desc1: "Annual investment (USD) for a complete structure: education, housing, health insurance, and athletic development.",
      desc2: "Projects with greater structure offer greater strategic control and access to more selective environments.",
      question: "What is the annual investment (USD) your family is prepared to allocate to this project in the U.S.?",
      helper: "Estimated values in USD per year.",
      footer: "Information used exclusively for strategic alignment.",
      range1: "US$ 15,000 to US$ 20,000",
      range2: "US$ 20,000 to US$ 30,000",
      range3: "US$ 30,000 to US$ 40,000",
      range4: "US$ 40,000 to US$ 50,000",
      range5: "US$ 50,000 to US$ 70,000",
      range6: "Above US$ 70,000",
    },

    step12: {
      header: "Legal Guardian",
      name: { label: "Full name", placeholder: "Full name" },
      profession: { label: "Profession", placeholder: "Profession" },
      phone: { label: "Phone / WhatsApp" },
      email: { label: "Email", placeholder: "email@example.com" },
    },

    step13: {
      header: "Residential Address",
      country: { label: "Country" },
      cep: { label: "ZIP Code", placeholder: "00000-000", searching: "Looking up address..." },
      street: { label: "Street / Avenue", placeholder: "Street name" },
      number: { label: "Number", placeholder: "123" },
      complement: { label: "Apt / Suite", placeholder: "Apt 45" },
      neighborhood: { label: "Neighborhood", placeholder: "Neighborhood name" },
      city: { label: "City", placeholder: "City" },
      state: { label: "State", placeholder: "NY" },
      postalCode: { label: "Postal Code", placeholder: "e.g. 90210" },
      address: { label: "Address", placeholder: "Street / Avenue" },
    },

    nav: {
      back: "Back",
      confirm: "Confirm",
      proceed: "Proceed to Full Strategic Assessment",
      submit: "Submit",
      submitting: "Submitting...",
    },

    success: {
      title: "Application submitted.",
      line1: "Our team will evaluate your profile and get in touch within 48 hours.",
      line2: "Best of luck.",
      team: "BAU Global Team",
      edit: "Edit your response",
    },

    error: {
      title: "Error sending",
    },

    toast: {
      title: "Application submitted!",
      description: "Our team will evaluate your profile and get in touch within 48 hours.",
    },

    errors: {
      "Nome é obrigatório": "Name is required",
      "Data de nascimento é obrigatória": "Date of birth is required",
      "WhatsApp é obrigatório": "WhatsApp is required",
      "Série é obrigatória": "Grade is required",
      "Escola é obrigatória": "School is required",
      "Cidade/Estado é obrigatório": "City/State is required",
      "Modelo educacional é obrigatório": "Educational model is required",
      "Selecione uma opção": "Select an option",
      "Selecione uma faixa": "Select a range",
      "Posição é obrigatória": "Position is required",
      "Histórico é obrigatório": "Club history is required",
      "URL inválida": "Invalid URL",
      "Nível atual de inglês": "English level is required",
      "Profissão é obrigatória": "Profession is required",
      "Telefone é obrigatório": "Phone is required",
      "E-mail inválido": "Invalid email",
      "E-mail é obrigatório": "Email is required",
      "CEP inválido": "Invalid ZIP code",
      "Rua é obrigatória": "Street is required",
      "Número é obrigatório": "Number is required",
      "Bairro é obrigatório": "Neighborhood is required",
      "Cidade é obrigatória": "City is required",
      "Estado é obrigatório": "State is required",
      "País é obrigatório": "Country is required",
    },
  },

  links: {
    brand: "Smart Sports Education®️",
    subtitle: "Structured life projects for young athletes in the American education system.",
    limitedSpots: "Limited spots per cycle",
    officialSite: "Official Website",
    card1: {
      label: "Exclusive",
      title1: "Strategic",
      title2: "Assessment",
      description: "One-on-one conversation with the founder",
      cta: "Request",
    },
    card2: {
      title: "Submit Athlete Profile",
      description: "First step to enter the S.A.F.E.® Method selection process",
    },
    card3: {
      title: "Direct Conversation",
      description: "Get quick answers from an advisor.",
      cta: "Start Chat",
    },
    copyright: "© 2026 BAU Global",
  },
};

export { en };
export default en;
