import { FamilyMember, Consultation, Exam, HealthVital, Vaccine } from "../types";

const DB_NAME = "FamilyMedicalDB";
const DB_VERSION = 1;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Erro ao abrir banco de dados local IndexedDB."));
    };

    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("members")) {
        db.createObjectStore("members", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("consultations")) {
        db.createObjectStore("consultations", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("exams")) {
        db.createObjectStore("exams", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("vitals")) {
        db.createObjectStore("vitals", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("vaccines")) {
        db.createObjectStore("vaccines", { keyPath: "id" });
      }
    };
  });
}

// Low-level helper to execute a transaction
function runTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);

      tx.oncomplete = () => {
        resolve(request.result as T);
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    });
  });
}

function updateLocalTimestamp() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("clinical_last_update", new Date().toISOString());
  }
}

export const dbService = {
  setLocalLastUpdate(isoString?: string) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("clinical_last_update", isoString || new Date().toISOString());
    }
  },
  getLocalLastUpdate(): string | null {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("clinical_last_update");
    }
    return null;
  },

  // Clear all existing mock data tables
  clearAllData(): Promise<void> {
    const stores = ["members", "consultations", "exams", "vitals", "vaccines"];
    return initDB().then((db) => {
      const tx = db.transaction(stores, "readwrite");
      stores.forEach((storeName) => {
        tx.objectStore(storeName).clear();
      });
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          updateLocalTimestamp();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    });
  },

  // Seed the system with the spreadsheet dataset
  seedNewData(): Promise<FamilyMember[]> {
    const defaultMembers: FamilyMember[] = [
      { id: "isaac", name: "Isaac", relationship: "Filho", birthDate: "2013-05-10", bloodType: "A+", allergies: "Nenhuma", avatarColor: "bg-blue-600", comorbidities: "Asma, Rinite, Arritmia cardíaca, Desatenção, Mordida cruzada, Fratura pulso, Fratura dedo pé", medications: "Symbicort 6/200 1x dia, Nasonex" },
      { id: "matheus", name: "Matheus", relationship: "Filho", birthDate: "2015-08-15", bloodType: "O+", allergies: "Dipirona, Ibuprofeno", avatarColor: "bg-emerald-500", comorbidities: "Asma, Rinite", medications: "Nasonex" },
      { id: "samuel", name: "Samuel", relationship: "Filho", birthDate: "2017-04-20", bloodType: "O-", allergies: "Alergias sob investigação", avatarColor: "bg-rose-500", comorbidities: "Estrabismo, Sopro Sistólico, Cisto, Cáries", medications: "Nenhum" },
      { id: "sara", name: "Sara", relationship: "Mãe", birthDate: "1985-01-12", bloodType: "O+", allergies: "Nenhuma", avatarColor: "bg-purple-500", comorbidities: "Ansiedade", medications: "Sertralina 100mg" },
      { id: "eduardo", name: "Eduardo", relationship: "Pai", birthDate: "1983-09-25", bloodType: "A+", allergies: "Nenhuma", avatarColor: "bg-indigo-500", comorbidities: "Nenhuma", medications: "Nenhum" },
      { id: "davi", name: "Davi", relationship: "Filho Caçula", birthDate: "2021-11-30", bloodType: "A+", allergies: "Nenhuma", avatarColor: "bg-orange-500", comorbidities: "Nenhuma", medications: "Nenhum" }
    ];

    const defaultConsultations: Consultation[] = [
      {
        id: "imp_c_isaac_1",
        memberId: "isaac",
        date: "2026-06-09",
        specialty: "Pneumologista",
        doctor: "Dr. Tiago",
        facility: "Hospital Infantil",
        reason: "Primeira consulta de monitoramento (Asma)",
        prescription: "Symbicort 6/200 1x dia (Uso Contínuo)",
        notes: "Dr muito arrogante. Solicitou espirometria e retorno em 90 dias."
      },
      {
        id: "imp_c_isaac_2",
        memberId: "isaac",
        date: "2023-03-27",
        specialty: "Pneumologista",
        doctor: "Dra. Raphaella Benvenutti",
        facility: "Cliniped",
        reason: "Acompanhamento geral de asma",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_isaac_3",
        memberId: "isaac",
        date: "2024-10-15",
        specialty: "Alergologista",
        doctor: "Dr. Leandro",
        facility: "Não informado",
        reason: "Tratamento preventivo e controle de Rinite",
        prescription: "Nasonex (Uso Contínuo)",
        notes: ""
      },
      {
        id: "imp_c_isaac_4",
        memberId: "isaac",
        date: "2022-10-12",
        specialty: "Pneumologista",
        doctor: "Pediatra de Plantão",
        facility: "Unimed (Emergência)",
        reason: "Primeiro episódio de crise aguda de asma",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_isaac_6",
        memberId: "isaac",
        date: "2024-03-12",
        specialty: "Cardiologista",
        doctor: "Dra. Mona Adalgisa",
        facility: "Corkids",
        reason: "Investigação preventiva de Arritmia cardíaca",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_isaac_7",
        memberId: "isaac",
        date: "2024-07-20",
        specialty: "Neurologista",
        doctor: "Dra. Mariana Ribeiro e Silva",
        facility: "Neuroclínica",
        reason: "Diagnóstico e orientações para Desatenção",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_isaac_8",
        memberId: "isaac",
        date: "2023-11-18",
        specialty: "Ortopedista (Cirurgia)",
        doctor: "Dra. Jocymara",
        facility: "Unimed",
        reason: "Cirurgia corretiva por Fratura de Pulso (Colocação de fio)",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_isaac_9",
        memberId: "isaac",
        date: "2024-12-09",
        specialty: "Eletrofisiologista",
        doctor: "Dr. Rafael Ronsoni",
        facility: "Neurovie Sadalla",
        reason: "Consulta médica de avaliação de Arritmia cardíaca",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_isaac_10",
        memberId: "isaac",
        date: "2026-06-09",
        specialty: "Ortodontista",
        doctor: "Dr. Carlos Fernando Dadalto",
        facility: "Dadalto Odontologia",
        reason: "Avaliação odontológica de Mordida cruzada",
        prescription: "",
        notes: "Solicitou documentação básica (imagens). Agendar retorno após a realização dos exames."
      },
      {
        id: "imp_c_isaac_11",
        memberId: "isaac",
        date: "2025-07-08",
        specialty: "Otorrinolaringologista (Cirurgia)",
        doctor: "Dr. André Tomazi Bridi",
        facility: "COF",
        reason: "Cirurgia corretiva de Desvio de Septo",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_isaac_12",
        memberId: "isaac",
        date: "2023-09-04",
        specialty: "Ortopedista",
        doctor: "Dr. Marcelo",
        facility: "IOT",
        reason: "Acompanhamento de Fratura no dedo do pé",
        prescription: "",
        notes: ""
      },
      // Matheus
      {
        id: "imp_c_matheus_1",
        memberId: "matheus",
        date: "2024-02-18",
        specialty: "Pneumologista",
        doctor: "Médico de Turno",
        facility: "Clínica Integrada",
        reason: "Monitoramento profilático da Asma",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_matheus_2",
        memberId: "matheus",
        date: "2024-11-05",
        specialty: "Alergologista",
        doctor: "Dr. Leandro Marcelo Spinelli",
        facility: "Clínica Spinelli",
        reason: "Rotina de rinite",
        prescription: "Nasonex (Uso Contínuo)",
        notes: ""
      },
      {
        id: "imp_c_matheus_3",
        memberId: "matheus",
        date: "2023-04-06",
        specialty: "Alergologista",
        doctor: "Dr. Leandro Marcelo Spinelli",
        facility: "Clínica Spinelli",
        reason: "Diagnóstico de alergia a anti-inflamatórios",
        prescription: "",
        notes: "Paciente com história de alergia a Dipirona e Ibuprofeno, deverá evitar o uso destas medicações. Pelo baixo risco de apresentar alergia poderá usar paracetamol, hioscina, benzidamina, salicilato de sódio, codeína, tramadol, morfina e anti-inflamatórios COX-2 específicos."
      },
      {
        id: "imp_c_matheus_4",
        memberId: "matheus",
        date: "2024-05-10",
        specialty: "Neurologista",
        doctor: "Especialista Pediátrico",
        facility: "Neurocentro",
        reason: "Avaliação de desatenção / rotina",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_matheus_5",
        memberId: "matheus",
        date: "2024-03-24",
        specialty: "Cardiologista",
        doctor: "Dra. Mona Adalgisa",
        facility: "Corkids",
        reason: "Investigação preventiva",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_matheus_6",
        memberId: "matheus",
        date: "2026-06-12",
        specialty: "Otorrinolaringologista",
        doctor: "Dr. André Tomazi Bridi",
        facility: "COF",
        reason: "Tratamento de Rinite",
        prescription: "",
        notes: "Agendado para as 13:12h."
      },
      // Samuel
      {
        id: "imp_c_samuel_1",
        memberId: "samuel",
        date: "2022-10-19",
        specialty: "Oftalmologista (Cirurgia)",
        doctor: "Dr. Rintaro",
        facility: "Sadalla",
        reason: "Cirurgia de Correção de Estrabismo Horizontal AO",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_samuel_2",
        memberId: "samuel",
        date: "2023-09-06",
        specialty: "Oftalmologista (Cirurgia)",
        doctor: "Dr. Rintaro",
        facility: "Sadalla",
        reason: "Procedimento complementar de Estrabismo Horizontal AO",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_samuel_3",
        memberId: "samuel",
        date: "2024-12-05",
        specialty: "Cardiologista",
        doctor: "Dr. Francisco Cesar Pabis",
        facility: "Corkids",
        reason: "Check-up de Sopro Sistólico",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_samuel_4",
        memberId: "samuel",
        date: "2024-04-12",
        specialty: "Neurologista",
        doctor: "Não informado",
        facility: "Não informado",
        reason: "Acompanhamento preventivo de Cisto neurológico",
        prescription: "",
        notes: ""
      },
      {
        id: "imp_c_samuel_5",
        memberId: "samuel",
        date: "2024-09-20",
        specialty: "Dentista",
        doctor: "Dra. Maria Eduarda",
        facility: "Univille",
        reason: "Prevenção e controle de cáries",
        prescription: "",
        notes: ""
      },
      // Sara
      {
        id: "imp_c_sara_1",
        memberId: "sara",
        date: "2025-10-12",
        specialty: "Neurologista",
        doctor: "Dra. Renata",
        facility: "Neurocentro",
        reason: "Tratamento prolongado de Ansiedade",
        prescription: "Sertralina 100mg (Contínuo)",
        notes: "Receita disponibilizada com validade estendida até Outubro de 2026."
      }
    ];

    const defaultExams: Exam[] = [
      {
        id: "imp_e_isaac_1",
        memberId: "isaac",
        date: "2025-04-03",
        title: "Tomografia Computadorizada de Seios da Face",
        category: "Imagem / Tomografia",
        facility: "Cliniped",
        doctor: "Dra. Raphaella Benvenutti",
        observations: "Resultados Principais: O exame mostra sinais de sinusite (inflamação dos seios nasais) bilateralmente nas maçãs do rosto (maxilar) e do lado esquerdo da testa (frontal) e nariz (etmoidal).\n\nDesvio de Septo: Há um desvio do septo nasal para a esquerda, o que pode causar conflito na mucosa nasal.",
        photoUrl: ""
      },
      {
        id: "imp_e_samuel_1",
        memberId: "samuel",
        date: "2018-07-03",
        title: "Painel Imunológico de Alergias Múltiplas",
        category: "Laboratorial / Sangue",
        facility: "Laboratório Unimed",
        doctor: "Dr. Luiz Arthur Rangel Cyrino",
        observations: "Dosagem quantitativa de IgE específico para alérgenos comuns inaláveis e alimentares.\nRef: consultarExame.action",
        photoUrl: ""
      },
      {
        id: "imp_e_samuel_2",
        memberId: "samuel",
        date: "2018-08-05",
        title: "Hemograma e Perfil Inflamatório Emergencial",
        category: "Laboratorial",
        facility: "Unimed",
        doctor: "Dr. Hugo Martins de Oliveira",
        observations: "Avaliação hematológica de reação alérgica sistêmica aguda.\nRef: consultarExame.action",
        photoUrl: ""
      },
      {
        id: "imp_e_samuel_3",
        memberId: "samuel",
        date: "2020-11-28",
        title: "Painel Bioquímico Pediátrico de Rotina",
        category: "Laboratorial",
        facility: "Laboratório Unimed",
        doctor: "Dr. Paulo Andre Ribeiro",
        observations: "Exames regulares de bioquímica e sumário de urina.\nRef: consultarExame.action",
        photoUrl: ""
      },
      {
        id: "imp_e_sara_1",
        memberId: "sara",
        date: "2025-03-15",
        title: "Perfil Metabólico de Rotina",
        category: "Laboratorial",
        facility: "Laboratório Unimed",
        doctor: "Clínico Geral",
        observations: "Acompanhamento preventivo de rotina.\nRef: consultarExame.action",
        photoUrl: ""
      },
      {
        id: "imp_e_sara_2",
        memberId: "sara",
        date: "2025-05-18",
        title: "Painel Hormonal Feminino",
        category: "Laboratorial",
        facility: "Laboratório Unimed",
        doctor: "Ginecologista",
        observations: "Dosagem de TSH, T4 Livre, Progesterona e Estratidiol para acompanhamento.\nRef: consultarExame.action",
        photoUrl: ""
      }
    ];

    const defaultVitals: HealthVital[] = [
      // Historical Weight and HR parameters for kids. Isaac:
      { id: "v_is_1", memberId: "isaac", date: "2026-02-10", weight: 43.5, heartRate: 78, systolicBP: 110, diastolicBP: 72, height: 151.2 },
      { id: "v_is_2", memberId: "isaac", date: "2026-03-12", weight: 44.0, heartRate: 76, systolicBP: 108, diastolicBP: 70, height: 152.0 },
      { id: "v_is_3", memberId: "isaac", date: "2026-04-08", weight: 44.5, heartRate: 75, systolicBP: 112, diastolicBP: 71, height: 152.8 },
      { id: "v_is_4", memberId: "isaac", date: "2026-05-10", weight: 45.1, heartRate: 77, systolicBP: 110, diastolicBP: 70, height: 153.5 },
      { id: "v_is_5", memberId: "isaac", date: "2026-06-05", weight: 45.6, heartRate: 78, systolicBP: 111, diastolicBP: 72, height: 154.2 },

      // Matheus:
      { id: "v_ma_1", memberId: "matheus", date: "2026-02-15", weight: 37.2, heartRate: 80, height: 137.5 },
      { id: "v_ma_2", memberId: "matheus", date: "2026-03-15", weight: 37.8, heartRate: 82, height: 138.1 },
      { id: "v_ma_3", memberId: "matheus", date: "2026-04-12", weight: 38.3, heartRate: 79, height: 138.9 },
      { id: "v_ma_4", memberId: "matheus", date: "2026-05-18", weight: 38.9, heartRate: 81, height: 139.6 },
      { id: "v_ma_5", memberId: "matheus", date: "2026-06-08", weight: 39.4, heartRate: 80, height: 140.2 },

      // Samuel:
      { id: "v_sa_1", memberId: "samuel", date: "2026-02-20", weight: 31.0, heartRate: 85, height: 129.5 },
      { id: "v_sa_2", memberId: "samuel", date: "2026-03-22", weight: 31.4, heartRate: 84, height: 130.1 },
      { id: "v_sa_3", memberId: "samuel", date: "2026-04-19", weight: 31.9, heartRate: 82, height: 130.8 },
      { id: "v_sa_4", memberId: "samuel", date: "2026-05-20", weight: 32.3, heartRate: 83, height: 131.4 },
      { id: "v_sa_5", memberId: "samuel", date: "2026-06-02", weight: 32.8, heartRate: 85, height: 132.0 },

      // Davi (Caçula):
      { id: "v_dv_1", memberId: "davi", date: "2026-02-05", weight: 14.8, height: 98.2 },
      { id: "v_dv_2", memberId: "davi", date: "2026-03-08", weight: 15.1, height: 98.9 },
      { id: "v_dv_3", memberId: "davi", date: "2026-04-09", weight: 15.5, height: 99.6 },
      { id: "v_dv_4", memberId: "davi", date: "2026-05-12", weight: 15.8, height: 100.2 },
      { id: "v_dv_5", memberId: "davi", date: "2026-06-03", weight: 16.2, height: 100.8 },

      // Sara (Mãe):
      { id: "v_sr_1", memberId: "sara", date: "2026-02-12", weight: 62.5, systolicBP: 118, diastolicBP: 78, heartRate: 72 },
      { id: "v_sr_2", memberId: "sara", date: "2026-03-15", weight: 62.1, systolicBP: 120, diastolicBP: 80, heartRate: 74 },
      { id: "v_sr_3", memberId: "sara", date: "2026-04-10", weight: 61.8, systolicBP: 115, diastolicBP: 76, heartRate: 70 },
      { id: "v_sr_4", memberId: "sara", date: "2026-05-12", weight: 62.0, systolicBP: 122, diastolicBP: 79, heartRate: 75 },
      { id: "v_sr_5", memberId: "sara", date: "2026-06-07", weight: 61.5, systolicBP: 118, diastolicBP: 77, heartRate: 72 }
    ];

    const defaultVaccines: Vaccine[] = [
      { id: "vac_is_1", memberId: "isaac", name: "Tríplice Viral (SRC)", dose: "Dose Única Reforço", appliedDate: "2025-01-15", status: "applied", batch: "TR5512B" },
      { id: "vac_is_2", memberId: "isaac", name: "Dupla Adulto (dT)", dose: "Reforço de 10 Anos", dueDate: "2026-06-25", status: "pending" },
      { id: "vac_ma_1", memberId: "matheus", name: "Gripe (Influenza - Tetra)", dose: "Campanha Anual", appliedDate: "2025-05-20", status: "applied", batch: "FL8941" },
      { id: "vac_ma_2", memberId: "matheus", name: "Febre Amarela", dose: "Padrão", dueDate: "2026-06-25", status: "pending" },
      { id: "vac_sa_1", memberId: "samuel", name: "Meningocócica ACWY", dose: "Reforço", dueDate: "2026-05-10", status: "overdue" },
      { id: "vac_sa_2", memberId: "samuel", name: "Gripe (Influenza)", dose: "Anual 2026", dueDate: "2026-06-25", status: "pending" },
      { id: "vac_sr_1", memberId: "sara", name: "Dupla Adulto (dT)", dose: "Reforço Periódico", appliedDate: "2024-11-10", status: "applied", batch: "DT994B" },
      { id: "vac_sr_2", memberId: "sara", name: "Hepatite B", dose: "3ª Dose", dueDate: "2026-07-15", status: "pending" },
      { id: "vac_ed_1", memberId: "eduardo", name: "Febre Amarela", dose: "Reforço", appliedDate: "2024-03-12", status: "applied", batch: "FA6621" },
      { id: "vac_da_1", memberId: "davi", name: "VIP (Poliomielite Inativada)", dose: "Dose União", appliedDate: "2025-12-05", status: "applied", batch: "PV8101" }
    ];

    // Bulk save in parallel with low-level tx
    return Promise.all([
      ...defaultMembers.map((m) => this.saveMember(m)),
      ...defaultConsultations.map((c) => this.saveConsultation(c)),
      ...defaultExams.map((e) => this.saveExam(e)),
      ...defaultVitals.map((v) => this.saveVital(v)),
      ...defaultVaccines.map((v) => this.saveVaccine(v))
    ]).then(() => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("has_seeded_v1", "true");
      }
      return defaultMembers;
    });
  },

  getMembers(): Promise<FamilyMember[]> {
    return runTx<FamilyMember[]>("members", "readonly", (store) => store.getAll()).then((list) => {
      const hasOldData = list.some((m) => m.id === "member_1" || m.name === "Carlos Silva" || m.name === "Ana Silva");
      if (hasOldData) {
        return this.clearAllData().then(() => this.seedNewData());
      }
      if (list.length === 0) {
        if (typeof window !== "undefined" && window.localStorage.getItem("has_seeded_v1") === "true") {
          return [];
        }
        return this.seedNewData();
      }
      return list;
    });
  },

  saveMember(member: FamilyMember): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("members", "readwrite", (store) => store.put(member));
  },

  deleteMember(id: string): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("members", "readwrite", (store) => store.delete(id));
  },

  // Consultations
  getConsultations(): Promise<Consultation[]> {
    return runTx<Consultation[]>("consultations", "readonly", (store) => store.getAll());
  },

  saveConsultation(consultation: Consultation): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("consultations", "readwrite", (store) => store.put(consultation));
  },

  deleteConsultation(id: string): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("consultations", "readwrite", (store) => store.delete(id));
  },

  // Exams
  getExams(): Promise<Exam[]> {
    return runTx<Exam[]>("exams", "readonly", (store) => store.getAll());
  },

  saveExam(exam: Exam): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("exams", "readwrite", (store) => store.put(exam));
  },

  deleteExam(id: string): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("exams", "readwrite", (store) => store.delete(id));
  },

  // Health Vitals (Tracking data for charts)
  getVitals(): Promise<HealthVital[]> {
    return runTx<HealthVital[]>("vitals", "readonly", (store) => store.getAll());
  },

  saveVital(vital: HealthVital): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("vitals", "readwrite", (store) => store.put(vital));
  },

  deleteVital(id: string): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("vitals", "readwrite", (store) => store.delete(id));
  },

  // Vaccines
  getVaccines(): Promise<Vaccine[]> {
    return runTx<Vaccine[]>("vaccines", "readonly", (store) => store.getAll());
  },

  saveVaccine(vaccine: Vaccine): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("vaccines", "readwrite", (store) => store.put(vaccine));
  },

  deleteVaccine(id: string): Promise<void> {
    updateLocalTimestamp();
    return runTx<void>("vaccines", "readwrite", (store) => store.delete(id));
  }
};
