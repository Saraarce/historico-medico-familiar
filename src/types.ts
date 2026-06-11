export interface FamilyMember {
  id: string; // "member_1", "member_2", etc.
  name: string;
  relationship: string; // e.g., 'Pai', 'Mãe', 'Filho', 'Filha', 'Avô', 'Avó'
  birthDate: string; // YYYY-MM-DD
  bloodType: string; // e.g., 'A+', 'O-', etc.
  allergies: string;
  avatarColor: string; // Tailwind color class for profile badge
  comorbidities?: string; // e.g., 'Asma, Rinite...'
  medications?: string; // e.g., 'Symbicort 6/200 1x dia...'
}

export interface Consultation {
  id: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  specialty: string; // Cardiologia, Pediatria, etc.
  doctor: string;
  facility: string; // Hospital, Clínica
  reason: string; // Motivo da consulta
  prescription: string; // Receita médica
  notes: string;
}

export interface Exam {
  id: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  title: string; // Nome do exame
  category: string; // Specialty/Category
  facility: string; // Laboratório / clínica
  doctor: string;
  observations: string;
  photoUrl?: string; // Base64 data URI of the attached photo
}

export interface HealthVital {
  id: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  weight?: number; // kg
  systolicBP?: number; // mmHg (sistólica)
  diastolicBP?: number; // mmHg (diastólica)
  bloodGlucose?: number; // mg/dL
  heartRate?: number; // bpm
  height?: number; // cm
}

export interface Vaccine {
  id: string;
  memberId: string;
  name: string;
  dose: string; // 1ª dose, Reforço, Dose Única, etc.
  dueDate?: string; // YYYY-MM-DD (if pending/upcoming)
  appliedDate?: string; // YYYY-MM-DD (if completed)
  status: "applied" | "pending" | "overdue";
  batch?: string;
}
