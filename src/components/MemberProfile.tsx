import React, { useState } from "react";
import { FamilyMember, Consultation, Exam, HealthVital, Vaccine } from "../types";
import { 
  Heart, Calendar, Syringe, Clipboard, Plus, Save, Trash2, 
  User, Check, X, Camera, Eye, AlertCircle, FileText, Info,
  Download, ExternalLink, Sparkles, Edit3, Activity, HeartPulse,
  FileSpreadsheet
} from "lucide-react";
import HealthTrendsChart from "./HealthTrendsChart";
import SpreadsheetImporter from "./SpreadsheetImporter";

interface MemberProfileProps {
  member: FamilyMember;
  consultations: Consultation[];
  exams: Exam[];
  vitals: HealthVital[];
  vaccines: Vaccine[];
  onDataChanged: () => void;
}

type ProfileTab = "summary" | "consultations" | "surgeries" | "exams" | "vaccines";

export default function MemberProfile({ 
  member, consultations, exams, vitals, vaccines, onDataChanged 
}: MemberProfileProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("summary");
  
  // Forms states
  const [showAddVital, setShowAddVital] = useState(false);
  const [showAddConsultation, setShowAddConsultation] = useState(false);
  const [showAddSurgery, setShowAddSurgery] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [showAddVaccine, setShowAddVaccine] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showSpreadsheetImport, setShowSpreadsheetImport] = useState(false);
  const [editingVital, setEditingVital] = useState<HealthVital | null>(null);
  const [editVitalForm, setEditVitalForm] = useState({ date: "", weight: "", sys: "", dia: "", glucose: "", hr: "", height: "" });
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [editConsultForm, setEditConsultForm] = useState({ date: "", specialty: "", doctor: "", facility: "", reason: "", prescription: "", notes: "" });
  const [editingSurgery, setEditingSurgery] = useState<Consultation | null>(null);
  const [editSurgeryForm, setEditSurgeryForm] = useState({ date: "", title: "", specialty: "", doctor: "", facility: "", prescription: "", notes: "" });
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editExamForm, setEditExamForm] = useState({ date: "", title: "", category: "", facility: "", doctor: "", observations: "" });
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);
  const [editVaccineForm, setEditVaccineForm] = useState({ name: "", dose: "", status: "applied", dueDate: "", appliedDate: "", batch: "" });

  // Form Fields
  const [vitalForm, setVitalForm] = useState({ date: new Date().toISOString().split("T")[0], weight: "", sys: "", dia: "", glucose: "", hr: "", height: "" });
  const [consultForm, setConsultForm] = useState({ date: new Date().toISOString().split("T")[0], specialty: "", doctor: "", facility: "", reason: "", prescription: "", notes: "" });
  const [surgeryForm, setSurgeryForm] = useState({ date: new Date().toISOString().split("T")[0], title: "", specialty: "", doctor: "", facility: "", prescription: "", notes: "" });
  const [examForm, setExamForm] = useState({ date: new Date().toISOString().split("T")[0], title: "", category: "", facility: "", doctor: "", observations: "" });
  const [profileForm, setProfileForm] = useState({ name: "", relationship: "", birthDate: "", bloodType: "", allergies: "", comorbidities: "", medications: "" });
  const [examPhotoBase64, setExamPhotoBase64] = useState<string | null>(null);
  const [vaccineForm, setVaccineForm] = useState({ name: "", dose: "", dueDate: "", appliedDate: "", isApplied: false, batch: "" });

  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ storeName: "consultations" | "exams" | "vitals" | "vaccines"; id: string } | null>(null);

  // States for AI health summary
  const [generateLoading, setGenerateLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`ai_summary_${member.id}`);
    } catch (_) {
      return null;
    }
  });

  // Keep AI summary synchronized when switching family members
  React.useEffect(() => {
    try {
      setAiSummary(localStorage.getItem(`ai_summary_${member.id}`));
    } catch (_) {
      setAiSummary(null);
    }
  }, [member.id]);

  const handleGenerateSummary = async () => {
    setGenerateLoading(true);
    setErrorText(null);
    try {
      const response = await fetch("/api/generate-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          member,
          consultations: memberConsultations,
          exams: memberExams,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Falha ao gerar o resumo.");
      }

      setAiSummary(data.summary);
      try {
        localStorage.setItem(`ai_summary_${member.id}`, data.summary);
      } catch (_) {
        // Safe fail
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "Erro ao conectar com a Inteligência Artificial.");
    } finally {
      setGenerateLoading(false);
    }
  };

  // Helper function to render formatted markdown response simply and gracefully
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    
    return (
      <div className="space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed text-left">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1.5" />;
          
          if (trimmed.startsWith("###")) {
            return (
              <h5 key={idx} className="font-extrabold text-blue-900 text-xs sm:text-sm mt-3.5 mb-1.5 flex items-center gap-1.5">
                {parseBoldText(trimmed.replace(/^###\s*/, ""))}
              </h5>
            );
          }
          if (trimmed.startsWith("##")) {
            return (
              <h4 key={idx} className="font-black text-blue-950 text-sm sm:text-base mt-4 mb-2">
                {parseBoldText(trimmed.replace(/^##\s*/, ""))}
              </h4>
            );
          }
          
          if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            const content = trimmed.replace(/^[-*]\s*/, "");
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1.5 my-1">
                <span className="text-blue-500 mt-1 sm:mt-1.5 shrink-0 select-none">•</span>
                <span className="flex-1 text-gray-700">{parseBoldText(content)}</span>
              </div>
            );
          }
          
          return (
            <p key={idx} className="my-1 text-gray-600">
              {parseBoldText(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-gray-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // Filter states for consultations
  const [consultSpecialtyFilter, setConsultSpecialtyFilter] = useState<string>("all");
  const [consultStartDate, setConsultStartDate] = useState<string>("");
  const [consultEndDate, setConsultEndDate] = useState<string>("");

  // Filtered lists for this member - excluding surgical procedures
  const memberConsultations = consultations
    .filter((c) => c.memberId === member.id && !(c.specialty?.toLowerCase().includes("cirurgia") || c.reason?.toLowerCase().includes("cirurgia") || (c as any).isSurgery))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Surgical procedures list
  const memberSurgeries = consultations
    .filter((c) => c.memberId === member.id && (c.specialty?.toLowerCase().includes("cirurgia") || c.reason?.toLowerCase().includes("cirurgia") || (c as any).isSurgery))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Extract available unique specialties for this member
  const availableSpecialties = Array.from(
    new Set(
      consultations
        .filter((c) => c.memberId === member.id && c.specialty)
        .map((c) => c.specialty.trim())
    )
  ).sort();

  // Apply filters dynamically
  const filteredConsultations = memberConsultations.filter((c) => {
    // Specialty Filter
    const matchesSpecialty =
      consultSpecialtyFilter === "all" ||
      c.specialty.trim().toLowerCase() === consultSpecialtyFilter.trim().toLowerCase();

    // Date Range Filter
    const matchesStartDate = !consultStartDate || c.date >= consultStartDate;
    const matchesEndDate = !consultEndDate || c.date <= consultEndDate;

    return matchesSpecialty && matchesStartDate && matchesEndDate;
  });
    
  const memberExams = exams
    .filter((e) => e.memberId === member.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const memberVaccines = vaccines
    .filter((v) => v.memberId === member.id)
    .sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (a.status !== "overdue" && b.status === "overdue") return 1;
      if (a.status === "pending" && b.status === "applied") return -1;
      return (a.dueDate || a.appliedDate || "").localeCompare(b.dueDate || b.appliedDate || "");
    });

  const memberVitals = vitals
    .filter((v) => v.memberId === member.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Age Calculator
  const getAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Submit Hanlders
  const handleAddVital = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { dbService } = await import("../lib/db.ts");
      const vital: HealthVital = {
        id: `vital_${Date.now()}`,
        memberId: member.id,
        date: vitalForm.date,
        weight: vitalForm.weight ? parseFloat(vitalForm.weight) : undefined,
        systolicBP: vitalForm.sys ? parseInt(vitalForm.sys) : undefined,
        diastolicBP: vitalForm.dia ? parseInt(vitalForm.dia) : undefined,
        bloodGlucose: vitalForm.glucose ? parseInt(vitalForm.glucose) : undefined,
        heartRate: vitalForm.hr ? parseInt(vitalForm.hr) : undefined,
        height: vitalForm.height ? parseFloat(vitalForm.height) : undefined,
      };

      await dbService.saveVital(vital);
      setShowAddVital(false);
      setVitalForm({ date: new Date().toISOString().split("T")[0], weight: "", sys: "", dia: "", glucose: "", hr: "", height: "" });
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar sinais vitais.");
    }
  };

  const handleStartEditVital = (vital: HealthVital) => {
    setEditingVital(vital);
    setEditVitalForm({
      date: vital.date,
      weight: vital.weight !== undefined ? vital.weight.toString() : "",
      sys: vital.systolicBP !== undefined ? vital.systolicBP.toString() : "",
      dia: vital.diastolicBP !== undefined ? vital.diastolicBP.toString() : "",
      glucose: vital.bloodGlucose !== undefined ? vital.bloodGlucose.toString() : "",
      hr: vital.heartRate !== undefined ? vital.heartRate.toString() : "",
      height: vital.height !== undefined ? vital.height.toString() : ""
    });
  };

  const handleSaveVitalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVital) return;
    try {
      const { dbService } = await import("../lib/db.ts");
      const updated: HealthVital = {
        ...editingVital,
        date: editVitalForm.date,
        weight: editVitalForm.weight ? parseFloat(editVitalForm.weight) : undefined,
        systolicBP: editVitalForm.sys ? parseInt(editVitalForm.sys) : undefined,
        diastolicBP: editVitalForm.dia ? parseInt(editVitalForm.dia) : undefined,
        bloodGlucose: editVitalForm.glucose ? parseInt(editVitalForm.glucose) : undefined,
        heartRate: editVitalForm.hr ? parseInt(editVitalForm.hr) : undefined,
        height: editVitalForm.height ? parseFloat(editVitalForm.height) : undefined,
      };

      await dbService.saveVital(updated);
      setEditingVital(null);
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar as alterações dos sinais vitais.");
    }
  };

  const handleStartEditConsultation = (consult: Consultation) => {
    setEditingConsultation(consult);
    setEditConsultForm({
      date: consult.date,
      specialty: consult.specialty,
      doctor: consult.doctor || "",
      facility: consult.facility || "",
      reason: consult.reason || "",
      prescription: consult.prescription || "",
      notes: consult.notes || ""
    });
  };

  const handleSaveConsultationEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConsultation) return;
    try {
      const { dbService } = await import("../lib/db.ts");
      const updated: Consultation = {
        ...editingConsultation,
        date: editConsultForm.date,
        specialty: editConsultForm.specialty,
        doctor: editConsultForm.doctor,
        facility: editConsultForm.facility,
        reason: editConsultForm.reason,
        prescription: editConsultForm.prescription,
        notes: editConsultForm.notes
      };

      await dbService.saveConsultation(updated);
      setEditingConsultation(null);
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar as alterações da consulta.");
    }
  };

  const handleStartEditSurgery = (surgery: Consultation) => {
    setEditingSurgery(surgery);
    setEditSurgeryForm({
      date: surgery.date,
      title: surgery.reason || "",
      specialty: (surgery.specialty || "").replace(" (Cirurgia)", ""),
      doctor: surgery.doctor || "",
      facility: surgery.facility || "",
      prescription: surgery.prescription || "",
      notes: surgery.notes || ""
    });
  };

  const handleSaveSurgeryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSurgery) return;
    try {
      const { dbService } = await import("../lib/db.ts");
      const updated: Consultation = {
        ...editingSurgery,
        date: editSurgeryForm.date,
        specialty: editSurgeryForm.specialty ? `${editSurgeryForm.specialty} (Cirurgia)` : "Cirurgia Geral",
        doctor: editSurgeryForm.doctor,
        facility: editSurgeryForm.facility,
        reason: editSurgeryForm.title,
        prescription: editSurgeryForm.prescription,
        notes: editSurgeryForm.notes
      };

      await dbService.saveConsultation(updated);
      setEditingSurgery(null);
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar as alterações do procedimento cirúrgico.");
    }
  };

  const handleStartEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setEditExamForm({
      date: exam.date,
      title: exam.title,
      category: exam.category,
      facility: exam.facility,
      doctor: exam.doctor || "",
      observations: exam.observations || ""
    });
  };

  const handleSaveExamEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;
    try {
      const { dbService } = await import("../lib/db.ts");
      const updated: Exam = {
        ...editingExam,
        date: editExamForm.date,
        title: editExamForm.title,
        category: editExamForm.category,
        facility: editExamForm.facility,
        doctor: editExamForm.doctor,
        observations: editExamForm.observations
      };

      await dbService.saveExam(updated);
      setEditingExam(null);
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar as alterações do exame.");
    }
  };

  const handleStartEditVaccine = (vaccine: Vaccine) => {
    setEditingVaccine(vaccine);
    setEditVaccineForm({
      name: vaccine.name,
      dose: vaccine.dose,
      status: vaccine.status,
      dueDate: vaccine.dueDate || "",
      appliedDate: vaccine.appliedDate || "",
      batch: vaccine.batch || ""
    });
  };

  const handleSaveVaccineEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVaccine) return;
    try {
      const { dbService } = await import("../lib/db.ts");
      const isApplied = editVaccineForm.status === "applied";
      const updated: Vaccine = {
        ...editingVaccine,
        name: editVaccineForm.name,
        dose: editVaccineForm.dose,
        status: editVaccineForm.status as "applied" | "pending" | "overdue",
        dueDate: isApplied ? undefined : editVaccineForm.dueDate,
        appliedDate: isApplied ? editVaccineForm.appliedDate : undefined,
        batch: isApplied ? editVaccineForm.batch : undefined
      };

      // Check overdue state if pending
      const today = new Date().toISOString().split("T")[0];
      if (updated.status === "pending" && updated.dueDate && updated.dueDate < today) {
        updated.status = "overdue";
      }

      await dbService.saveVaccine(updated);
      setEditingVaccine(null);
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar as alterações da vacina.");
    }
  };

  const handleAddSurgery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { dbService } = await import("../lib/db.ts");
      const consult: Consultation = {
        id: `surgery_${Date.now()}`,
        memberId: member.id,
        date: surgeryForm.date,
        specialty: surgeryForm.specialty ? `${surgeryForm.specialty} (Cirurgia)` : "Cirurgia Geral",
        doctor: surgeryForm.doctor,
        facility: surgeryForm.facility,
        reason: surgeryForm.title,
        prescription: surgeryForm.prescription,
        notes: surgeryForm.notes,
      };
      (consult as any).isSurgery = true;

      await dbService.saveConsultation(consult);
      setShowAddSurgery(false);
      setSurgeryForm({
        date: new Date().toISOString().split("T")[0],
        title: "",
        specialty: "",
        doctor: "",
        facility: "",
        prescription: "",
        notes: ""
      });
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar procedimento cirúrgico.");
    }
  };

  const handleStartEditProfile = () => {
    setProfileForm({
      name: member.name || "",
      relationship: member.relationship || "",
      birthDate: member.birthDate || "",
      bloodType: member.bloodType || "",
      allergies: member.allergies || "",
      comorbidities: member.comorbidities || "",
      medications: member.medications || ""
    });
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { dbService } = await import("../lib/db.ts");
      const updated: FamilyMember = {
        ...member,
        name: profileForm.name,
        relationship: profileForm.relationship,
        birthDate: profileForm.birthDate,
        bloodType: profileForm.bloodType,
        allergies: profileForm.allergies,
        comorbidities: profileForm.comorbidities,
        medications: profileForm.medications
      };

      await dbService.saveMember(updated);
      setShowEditProfileModal(false);
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar dados do prontuário.");
    }
  };

  const handleDeleteProfile = async () => {
    if (confirmDeleteId !== member.id) {
      setConfirmDeleteId(member.id);
      return;
    }
    try {
      const { dbService } = await import("../lib/db.ts");
      
      // Cascade-delete related data inside IndexedDB
      const pConsults = await dbService.getConsultations();
      for (const c of pConsults.filter(item => item.memberId === member.id)) {
        await dbService.deleteConsultation(c.id);
      }
      
      const pExams = await dbService.getExams();
      for (const ex of pExams.filter(item => item.memberId === member.id)) {
        await dbService.deleteExam(ex.id);
      }

      const pVitals = await dbService.getVitals();
      for (const vt of pVitals.filter(item => item.memberId === member.id)) {
        await dbService.deleteVital(vt.id);
      }

      const pVaccines = await dbService.getVaccines();
      for (const vc of pVaccines.filter(item => item.memberId === member.id)) {
        await dbService.deleteVaccine(vc.id);
      }

      await dbService.deleteMember(member.id);
      setShowEditProfileModal(false);
      setConfirmDeleteId(null);
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao excluir integrante.");
    }
  };

  const handleAddConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { dbService } = await import("../lib/db.ts");
      const consult: Consultation = {
        id: `consult_${Date.now()}`,
        memberId: member.id,
        ...consultForm
      };

      await dbService.saveConsultation(consult);
      setShowAddConsultation(false);
      setConsultForm({ date: new Date().toISOString().split("T")[0], specialty: "", doctor: "", facility: "", reason: "", prescription: "", notes: "" });
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar consulta.");
    }
  };

  const handleExamPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setExamPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { dbService } = await import("../lib/db.ts");
      const exam: Exam = {
        id: `exam_${Date.now()}`,
        memberId: member.id,
        ...examForm,
        photoUrl: examPhotoBase64 || undefined
      };

      await dbService.saveExam(exam);
      setShowAddExam(false);
      setExamForm({ date: new Date().toISOString().split("T")[0], title: "", category: "", facility: "", doctor: "", observations: "" });
      setExamPhotoBase64(null);
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao salvar exame.");
    }
  };

  const handleAddVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { dbService } = await import("../lib/db.ts");
      const vaccine: Vaccine = {
        id: `vaccine_${Date.now()}`,
        memberId: member.id,
        name: vaccineForm.name,
        dose: vaccineForm.dose,
        status: vaccineForm.isApplied ? "applied" : "pending",
        dueDate: vaccineForm.isApplied ? undefined : vaccineForm.dueDate,
        appliedDate: vaccineForm.isApplied ? vaccineForm.appliedDate : undefined,
        batch: vaccineForm.isApplied ? vaccineForm.batch : undefined
      };

      // Check overdue state
      const today = new Date().toISOString().split("T")[0];
      if (vaccine.status === "pending" && vaccine.dueDate && vaccine.dueDate < today) {
        vaccine.status = "overdue";
      }

      await dbService.saveVaccine(vaccine);
      setShowAddVaccine(false);
      setVaccineForm({ name: "", dose: "", dueDate: "", appliedDate: "", isApplied: false, batch: "" });
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao registrar vacina.");
    }
  };

  const handleToggleVaccineApplied = async (vaccine: Vaccine) => {
    const today = new Date().toISOString().split("T")[0];
    try {
      const { dbService } = await import("../lib/db.ts");
      const updated: Vaccine = {
        ...vaccine,
        status: "applied",
        appliedDate: today,
        batch: "Aplicado via App"
      };

      await dbService.saveVaccine(updated);
      onDataChanged();
    } catch (err) {
      setErrorText("Erro ao atualizar vacina.");
    }
  };

  const handleDeleteItem = async (storeName: "consultations" | "exams" | "vitals" | "vaccines", id: string) => {
    setItemToDelete({ storeName, id });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" id={`profile-card-${member.id}`}>
      {/* Member Header */}
      <div className="relative bg-slate-50 p-6 pt-14 sm:pt-6 flex flex-col items-center border-b border-gray-100 text-center">
        {/* Buttons in top-right corner */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 flex-wrap justify-end max-w-[240px] sm:max-w-none">
          <button
            type="button"
            id="btn-edit-member-direct"
            onClick={() => handleStartEditProfile()}
            className="py-1 px-2 bg-white hover:bg-slate-100 active:scale-95 text-blue-600 font-extrabold border border-slate-200 hover:border-slate-300 rounded-lg text-[9px] flex items-center gap-1 shadow-3xs transition-all cursor-pointer shrink-0 select-none"
          >
            <Edit3 className="w-3 h-3" />
            Editar Dados
          </button>
          <button
            type="button"
            id="btn-import-spreadsheet"
            onClick={() => setShowSpreadsheetImport(true)}
            className="py-1 px-2 bg-emerald-50 hover:bg-emerald-100/85 active:scale-95 text-emerald-700 font-extrabold border border-emerald-200 hover:border-emerald-300 rounded-lg text-[9px] flex items-center gap-1 shadow-3xs transition-all cursor-pointer shrink-0 select-none"
          >
            <FileSpreadsheet className="w-3 h-3" />
            Importar Planilha
          </button>
        </div>

        {/* Centered Profile Avatar */}
        <div className={`w-16 h-16 rounded-2xl ${member.avatarColor} text-white flex items-center justify-center font-extrabold text-2xl shadow-sm uppercase shrink-0 mx-auto`}>
          {member.name.substring(0, 2)}
        </div>
        
        <div className="w-full mt-3 flex flex-col items-center">
          {/* Member Name centered */}
          <h1 className="text-2xl font-black text-gray-900 tracking-tight text-center truncate max-w-full leading-tight">
            {member.name}
          </h1>

          {/* BELOW: Relationship badge */}
          <div className="mt-1.5 flex justify-center">
            <span className="bg-blue-50 text-blue-700 text-xs font-extrabold px-3 py-0.5 rounded-full border border-blue-105 select-none">
              {member.relationship}
            </span>
          </div>

          {/* BELOW: Age/Birthdate info */}
          <div className="mt-2.5 flex justify-center select-none">
            <div className="bg-slate-100 border border-slate-200/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs text-gray-600 font-semibold">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span>{getAge(member.birthDate)} anos ({formatDate(member.birthDate)})</span>
            </div>
          </div>

          {/* BELOW: Blood Type and Allergies stacked */}
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500 font-semibold select-none">
            <div className="bg-red-50/50 border border-red-100/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0">
              <span className="font-semibold text-gray-700">Sangue: <span className="text-red-600 font-extrabold">{member.bloodType}</span></span>
            </div>
            <div className="text-amber-750 bg-amber-50/70 px-2.5 py-1 rounded-lg border border-amber-100 flex items-center gap-1 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>Alergias: <span className="font-bold text-amber-900">{member.allergies || "Nenhuma registrada"}</span></span>
            </div>
          </div>

          {/* Comorbidades e Medicamentos em Uso */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-slate-200/50 text-left">
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 flex items-start gap-2.5 shadow-3xs hover:border-slate-300 transition-colors">
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">
                  Comorbidades
                </span>
                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                  {member.comorbidities || "Nenhuma registrada"}
                </p>
              </div>
            </div>

            <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 flex items-start gap-2.5 shadow-3xs hover:border-slate-300 transition-colors">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 mt-0.5">
                <Heart className="w-4 h-4 fill-emerald-50" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">
                  Medicamentos em Uso
                </span>
                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                  {member.medications || "Nenhum em uso contínuo"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-100 bg-white scrollbar-none" id="profile-tabs" style={{ scrollbarWidth: "none" }}>
        <div className="flex min-w-max sm:min-w-full w-full">
          {(["summary", "consultations", "surgeries", "exams", "vaccines"] as ProfileTab[]).map((tab) => {
            const isSelected = activeTab === tab;
            const labels = {
              summary: "Acompanhamento",
              consultations: "Consultas",
              surgeries: "Cirurgias",
              exams: "Exames",
              vaccines: "Vacinas"
            };
            const Icons = {
              summary: Heart,
              consultations: Calendar,
              surgeries: Activity,
              exams: Clipboard,
              vaccines: Syringe
            };
            const Icon = Icons[tab];

            return (
              <button
                key={tab}
                type="button"
                className={`flex-1 py-3 sm:py-4 px-3 sm:px-4 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  isSelected 
                    ? "border-blue-600 text-blue-600 font-extrabold bg-blue-50/5" 
                    : "border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50/50"
                }`}
                onClick={() => {
                  setActiveTab(tab);
                  setErrorText(null);
                }}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                <span>{labels[tab]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content wrapper */}
      <div className="p-6">
        
        {errorText && (
          <div className="mb-4 bg-red-50 text-red-800 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
            <X className="w-4 h-4 text-red-600" onClick={() => setErrorText(null)} />
            {errorText}
          </div>
        )}

        {/* 1. Summary & Vitals Tracking */}
        {activeTab === "summary" && (
          <div className="space-y-6">
            
            {/* AI Summary Card Widget */}
            <div className="p-5 sm:p-6 bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-white border border-indigo-150 rounded-2xl shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-start gap-3 text-left">
                  <div className="p-2 sm:p-2.5 bg-blue-100/80 text-blue-600 rounded-xl shrink-0 mt-0.5">
                    <Sparkles className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-950 text-sm sm:text-base flex items-center gap-1.5">
                      Resumo Clínico Inteligente (IA)
                    </h4>
                    <p className="text-2xs sm:text-xs text-gray-500 leading-normal">
                      Análise automatizada de comorbidades, parâmetros, exames e últimas consultas
                    </p>
                  </div>
                </div>
                
                <button
                  type="button"
                  id="btn-generate-ai-summary"
                  disabled={generateLoading}
                  onClick={handleGenerateSummary}
                  className={`py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap self-stretch sm:self-auto ${
                    generateLoading 
                      ? "bg-slate-100 text-slate-400 border border-slate-200" 
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  {generateLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Analisando Prontuário...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiSummary ? "Refazer Resumo IA" : "Gerar Resumo IA"}
                    </>
                  )}
                </button>
              </div>

              {/* Summary Presentation Content */}
              {aiSummary ? (
                <div className="bg-white/85 backdrop-blur-xs border border-indigo-100/30 p-4 sm:p-5 rounded-2xl space-y-3">
                  {renderMarkdown(aiSummary)}
                  
                  <div className="flex justify-end gap-2 text-3xs text-gray-400 border-t border-slate-100 pt-3 mt-2 select-none">
                    <span>*Gerado dinamicamente com base nas informações do histórico.</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl text-center flex flex-col items-center">
                  <div className="p-2 bg-indigo-50/50 rounded-full text-indigo-500/80 mb-2">
                    <Sparkles className="w-5 h-5 opacity-70 animate-pulse" />
                  </div>
                  <span className="text-2xs font-extrabold text-slate-700">Nenhum resumo gerado ainda</span>
                  <p className="text-3xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                    Clique no botão acima para permitir que o assistente analise as comorbidades, medicações básicas e todo o histórico deste prontuário.
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">Gráficos de Parâmetros de Saúde</h3>
                <p className="text-xs text-gray-500">Histórico de acompanhamento de peso, pressão e glicemia</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddVital(!showAddVital)}
                className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer self-stretch sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Parâmetros
              </button>
            </div>

            {showAddVital && (
              <form onSubmit={handleAddVital} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 mt-2 space-y-4 text-left">
                <h4 className="font-bold text-sm text-gray-800">Nova Aferição Clínica</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Data</label>
                    <input
                      type="date"
                      required
                      value={vitalForm.date}
                      onChange={(e) => setVitalForm({ ...vitalForm, date: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Peso (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 75.5"
                      value={vitalForm.weight}
                      onChange={(e) => setVitalForm({ ...vitalForm, weight: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Glicemia (mg/dL)</label>
                    <input
                      type="number"
                      placeholder="Ex: 92"
                      value={vitalForm.glucose}
                      onChange={(e) => setVitalForm({ ...vitalForm, glucose: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">P.A. Sistólica (Máx)</label>
                    <input
                      type="number"
                      placeholder="Ex: 120"
                      value={vitalForm.sys}
                      onChange={(e) => setVitalForm({ ...vitalForm, sys: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">P.A. Diastólica (Mín)</label>
                    <input
                      type="number"
                      placeholder="Ex: 80"
                      value={vitalForm.dia}
                      onChange={(e) => setVitalForm({ ...vitalForm, dia: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Batimentos (bpm)</label>
                    <input
                      type="number"
                      placeholder="Ex: 72"
                      value={vitalForm.hr}
                      onChange={(e) => setVitalForm({ ...vitalForm, hr: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Altura (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ex: 154.5"
                      value={vitalForm.height}
                      onChange={(e) => setVitalForm({ ...vitalForm, height: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="submit"
                    className="py-1.5 px-3 bg-emerald-600 font-bold hover:bg-emerald-700 text-white rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar Aferição
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddVital(false)}
                    className="py-1.5 px-3 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Health Line Charts container */}
            <HealthTrendsChart member={member} vitals={vitals} />

            {/* Recent Vitals list */}
            {memberVitals.length > 0 && (
              <div className="mt-4">
                <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider mb-3">História Recente de Sinais Clinicos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {memberVitals.slice(0, 3).map((vital) => (
                    <div key={vital.id} className="p-3.5 border border-gray-100 bg-gray-50/30 rounded-xl relative">
                      <button
                        type="button"
                        onClick={() => handleStartEditVital(vital)}
                        className="absolute right-2 top-2 p-1 text-blue-600 hover:bg-blue-50 rounded bg-white hover:text-blue-700 transition-colors cursor-pointer border border-slate-200/55"
                        title="Editar aferição"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <div className="text-xs text-gray-500 font-semibold mb-2">{formatDate(vital.date)}</div>
                      <div className="space-y-1 text-sm font-medium pr-6">
                        {vital.weight && <p className="text-gray-700">⚖️ Peso: <strong className="text-gray-900 font-bold">{vital.weight} kg</strong></p>}
                        {vital.height && <p className="text-gray-700">📏 Altura: <strong className="text-gray-900 font-bold">{vital.height} cm</strong></p>}
                        {vital.systolicBP && vital.diastolicBP && (
                          <p className="text-gray-700">🩸 Pressão: <strong className="text-gray-900 font-bold">{vital.systolicBP}/{vital.diastolicBP} mmHg</strong></p>
                        )}
                        {vital.bloodGlucose && <p className="text-gray-700 font-medium">🍬 Glicemia: <strong className="text-gray-900 font-bold">{vital.bloodGlucose} mg/dL</strong></p>}
                        {vital.heartRate && <p className="text-gray-700 font-medium">💓 F.C.: <strong className="text-gray-900 font-bold">{vital.heartRate} bpm</strong></p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Medical Consultations */}
        {activeTab === "consultations" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">Prontuário de Consultas</h3>
                <p className="text-xs text-gray-500">Histórico detalhado de consultas e agendas médicas futuras</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddConsultation(!showAddConsultation)}
                className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer self-stretch sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Consulta
              </button>
            </div>

            {showAddConsultation && (
              <form onSubmit={handleAddConsultation} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 mt-2 space-y-4 text-left">
                <h4 className="font-bold text-sm text-gray-800">Nova Consulta Médica</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Data</label>
                    <input
                      type="date"
                      required
                      value={consultForm.date}
                      onChange={(e) => setConsultForm({ ...consultForm, date: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Especialidade / Categoria</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Cardiologia, Pediatria"
                      value={consultForm.specialty}
                      onChange={(e) => setConsultForm({ ...consultForm, specialty: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Médico Responsável</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Dr. Roberto"
                      value={consultForm.doctor}
                      onChange={(e) => setConsultForm({ ...consultForm, doctor: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Unidade / Hospital</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hospital Paulistano, Posto Pró-Saúde"
                    value={consultForm.facility}
                    onChange={(e) => setConsultForm({ ...consultForm, facility: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Motivo da Consulta</label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Sintomas, dor crônica, queixas gerais ou rotina..."
                      value={consultForm.reason}
                      onChange={(e) => setConsultForm({ ...consultForm, reason: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Receita Médica / Medicamento Prescrito</label>
                    <textarea
                      rows={2}
                      placeholder="Dosagens e medicamentos prescritos..."
                      value={consultForm.prescription}
                      onChange={(e) => setConsultForm({ ...consultForm, prescription: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Informações Adicionais / Observações</label>
                  <textarea
                    rows={2}
                    placeholder="Anotações gerais relevantes..."
                    value={consultForm.notes}
                    onChange={(e) => setConsultForm({ ...consultForm, notes: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="submit"
                    className="py-2 px-4 bg-emerald-600 font-bold hover:bg-emerald-700 text-white rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar Consulta
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddConsultation(false)}
                    className="py-2 px-4 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* List Consultations */}
            {memberConsultations.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left mb-4" id="consultation-filters">
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 select-none">
                    Filtrar Especialidade
                  </label>
                  <select
                    value={consultSpecialtyFilter}
                    onChange={(e) => setConsultSpecialtyFilter(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100 text-slate-700 cursor-pointer"
                  >
                    <option value="all">Todas as Especialidades</option>
                    {availableSpecialties.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 select-none">
                    Data Inicial (De)
                  </label>
                  <input
                    type="date"
                    value={consultStartDate}
                    onChange={(e) => setConsultStartDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100 text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 select-none">
                    Data Final (Até)
                  </label>
                  <input
                    type="date"
                    value={consultEndDate}
                    onChange={(e) => setConsultEndDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100 text-slate-700"
                  />
                </div>

                {(consultSpecialtyFilter !== "all" || consultStartDate || consultEndDate) && (
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setConsultSpecialtyFilter("all");
                        setConsultStartDate("");
                        setConsultEndDate("");
                      }}
                      className="py-1.5 px-3 bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-bold text-xxs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                    >
                      Limpar Filtros aplicados
                    </button>
                  </div>
                )}
              </div>
            )}

            {memberConsultations.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">Nenhuma consulta registrada</p>
                <p className="text-xs bg-slate-50 inline-block px-3 py-1.5 rounded-lg border border-gray-100 mt-2 text-gray-500">Agende e organize o calendário médico familiar!</p>
              </div>
            ) : filteredConsultations.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600">Nenhuma consulta encontrada para os filtros selecionados.</p>
                <button
                  type="button"
                  onClick={() => {
                    setConsultSpecialtyFilter("all");
                    setConsultStartDate("");
                    setConsultEndDate("");
                  }}
                  className="mt-3.5 py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Limpar Todos os Filtros
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredConsultations.map((item) => {
                  const isFuture = item.date >= new Date().toISOString().split("T")[0];
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`p-5 rounded-2xl border transition-all relative ${
                        isFuture 
                          ? "border-blue-200 bg-blue-50/10 shadow-3xs" 
                          : "border-gray-100 bg-white hover:border-gray-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleStartEditConsultation(item)}
                        className="absolute right-4 top-4 p-1.5 text-blue-600 hover:bg-blue-50 bg-white hover:text-blue-700 border border-slate-200/55 rounded transition-colors cursor-pointer"
                        title="Editar consulta"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
                          {formatDate(item.date)}
                        </span>
                        
                        <span className={`text-xxs font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                          isFuture ? "bg-blue-100 text-blue-700 animate-pulse" : "bg-gray-100 text-gray-600"
                        }`}>
                          {isFuture ? "Agendado / Lembrar" : "Concluído"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-2xs font-extrabold text-gray-400 uppercase">Especialidade</span>
                          <h4 className="font-extrabold text-gray-800 text-base">{item.specialty}</h4>
                          <p className="text-xs text-gray-500 mt-0.5 font-semibold">CRM: {item.doctor}</p>
                          <p className="text-2xs text-gray-400 font-medium">{item.facility}</p>
                        </div>

                        <div>
                          <span className="text-2xs font-extrabold text-gray-400 uppercase block">Motivo do Atendimento</span>
                          <p className="text-xs text-gray-700 font-medium mt-1 leading-relaxed">{item.reason || "Não especificado."}</p>
                          
                          {item.prescription && (
                            <div className="mt-3 p-2.5 bg-yellow-50/50 border border-yellow-100 rounded-xl">
                              <span className="text-3xs font-extrabold text-amber-800 uppercase block leading-none mb-1">Medicamentos e Receita</span>
                              <p className="text-2xs font-semibold text-amber-900 whitespace-pre-line">{item.prescription}</p>
                            </div>
                          )}
                        </div>

                        <div>
                          <span className="text-2xs font-extrabold text-gray-400 uppercase block">Instruções / Anotações do Paciente</span>
                          <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 font-medium mt-1 leading-relaxed whitespace-pre-line">
                            {item.notes || "Nenhuma anotação adicional registrada."}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. Physical Exams Registry */}
        {activeTab === "exams" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">Histórico de Exames Realizados</h3>
                <p className="text-xs text-gray-500">Prontuário com imagens físicas dos laudos e aferições</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExam(!showAddExam)}
                className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer self-stretch sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Exame Manual
              </button>
            </div>

            {/* SmartScan Guidance */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-left select-none">
                <span className="text-xs font-black text-blue-900">Dica Prática com IA 💡</span>
                <p className="text-2xs text-blue-800 mt-1 leading-normal">
                  Deseja extrair as informações automaticamente de um exame sem precisar digitar tudo? <strong className="font-bold">Use a aba central "SmartScan IA"</strong> no menu do topo do aplicativo para escanear a imagem via câmera do celular!
                </p>
              </div>
            </div>

            {showAddExam && (
              <form onSubmit={handleAddExam} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 mt-2 space-y-4 text-left">
                <h4 className="font-bold text-sm text-gray-800">Novo Exame Médico</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Título do Exame / Laudo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Hemograma, Ultrassom"
                      value={examForm.title}
                      onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Data</label>
                    <input
                      type="date"
                      required
                      value={examForm.date}
                      onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Área / Especialidade</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Análises Clínicas, Oftalmo"
                      value={examForm.category}
                      onChange={(e) => setExamForm({ ...examForm, category: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Laboratório / Clínica</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Fleury, Laboratório Municipal"
                      value={examForm.facility}
                      onChange={(e) => setExamForm({ ...examForm, facility: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Médico Requisitante</label>
                    <input
                      type="text"
                      placeholder="Ex: Dr. Silva"
                      value={examForm.doctor}
                      onChange={(e) => setExamForm({ ...examForm, doctor: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Laudo / Observações dos Valores de Referência</label>
                  <textarea
                    rows={3}
                    placeholder="Valores observados, dosagem, resultados e referências interpretadas..."
                    value={examForm.observations}
                    onChange={(e) => setExamForm({ ...examForm, observations: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                  />
                </div>

                <div className="p-3 bg-white border border-gray-200 rounded-xl">
                  <span className="block text-2xs font-bold text-gray-600 mb-2">Anexar Laudo do Exame (Câmera, Imagem ou PDF)</span>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      id="btn-exam-camera"
                      onClick={() => document.getElementById("exam-camera-input")?.click()}
                      className="py-2.5 px-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Camera className="w-4 h-4 text-blue-500" />
                      Tirar Foto (Câmera)
                    </button>
                    
                    <button
                      type="button"
                      id="btn-exam-file"
                      onClick={() => document.getElementById("exam-file-input")?.click()}
                      className="py-2.5 px-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <FileText className="w-4 h-4 text-indigo-500" />
                      Escolher Foto ou PDF
                    </button>

                    {examPhotoBase64 && (
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 p-1.5 rounded-xl">
                        <span className={`text-2xs font-bold flex items-center gap-1.5 ${examPhotoBase64.startsWith("data:application/pdf") ? "text-indigo-600" : "text-emerald-600"}`}>
                          <Check className="w-3.5 h-3.5" />
                          {examPhotoBase64.startsWith("data:application/pdf") ? "PDF Anexado!" : "Foto Anexada!"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExamPhotoBase64(null)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remover anexo"
                        >
                          <X className="w-3.5 h-3.5 font-bold" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Native Camera input optimized for mobile instant capture */}
                  <input
                    type="file"
                    id="exam-camera-input"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleExamPhotoCapture}
                  />

                  {/* Standard file/photo selector accepts images + pdfs */}
                  <input
                    type="file"
                    id="exam-file-input"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleExamPhotoCapture}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="submit"
                    className="py-2 px-4 bg-emerald-600 font-bold hover:bg-emerald-700 text-white rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar Exame
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddExam(false);
                      setExamPhotoBase64(null);
                    }}
                    className="py-2 px-4 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* List Exams */}
            {memberExams.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Clipboard className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">Nenhum exame cadastrado</p>
                <p className="text-xs bg-slate-50 inline-block px-3 py-1.5 rounded-lg border border-gray-100 mt-2 text-gray-500">Cadastre para guardar laudos e imagens!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memberExams.map((item) => (
                  <div key={item.id} className="p-5 border border-gray-100 rounded-2xl bg-white hover:border-gray-200 transition-all relative flex flex-col justify-between text-left">
                    <button
                      type="button"
                      onClick={() => handleStartEditExam(item)}
                      className="absolute right-4 top-4 p-1.5 text-blue-600 hover:bg-blue-50 bg-white hover:text-blue-700 border border-slate-200/55 rounded transition-colors cursor-pointer"
                      title="Editar exame"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-3xs font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-md uppercase">
                          {item.category}
                        </span>
                        <span className="text-xs text-gray-400 font-semibold">{formatDate(item.date)}</span>
                      </div>

                      <h4 className="font-extrabold text-gray-800 text-base">{item.title}</h4>
                      <p className="text-xs font-semibold text-gray-700 leading-normal mt-1">Laboratório: {item.facility}</p>
                      
                      {item.doctor && <p className="text-2xs text-gray-400 font-medium mt-0.5">Médico solicitante: {item.doctor}</p>}
                      
                      {item.observations && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-3xs font-extrabold text-gray-400 uppercase tracking-wide block">Resultado / Diagnóstico</span>
                          <p className="text-2xs font-semibold text-gray-600 leading-normal mt-1 whitespace-pre-line">{item.observations}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                      {item.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => setViewingPhotoUrl(item.photoUrl || null)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                        >
                          {item.photoUrl.startsWith("data:application/pdf") ? (
                            <>
                              <FileText className="w-4 h-4 text-indigo-500 shadow-3xs" />
                              Ver PDF do Exame
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 shadow-3xs" />
                              Ver Foto do Exame
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-2xs text-gray-400 font-semibold italic flex items-center gap-1">
                          Sem foto ou PDF em anexo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Vaccine Scorecard */}
        {activeTab === "vaccines" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">Carteira de Vacinação</h3>
                <p className="text-xs text-gray-500">Histórico de doses aplicadas e controle de pendências</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddVaccine(!showAddVaccine)}
                className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer self-stretch sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Vacina
              </button>
            </div>

            {showAddVaccine && (
              <form onSubmit={handleAddVaccine} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 mt-2 space-y-4 text-left">
                <h4 className="font-bold text-sm text-gray-800">Nova Vacina / Imunizante</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Nome da Vacina</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Tríplice Viral, Gripe Tetravalente"
                      value={vaccineForm.name}
                      onChange={(e) => setVaccineForm({ ...vaccineForm, name: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Dose</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 1ª Dose, Reforço, Dose Única"
                      value={vaccineForm.dose}
                      onChange={(e) => setVaccineForm({ ...vaccineForm, dose: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-800">O integrante já tomou essa vacina?</span>
                    <p className="text-2xs text-gray-500">Marque se já tiver sido aplicada</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={vaccineForm.isApplied}
                    onChange={(e) => setVaccineForm({ ...vaccineForm, isApplied: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-400"
                  />
                </div>

                {vaccineForm.isApplied ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-bold text-gray-600 mb-1">Data de Aplicação</label>
                      <input
                        type="date"
                        required
                        value={vaccineForm.appliedDate}
                        onChange={(e) => setVaccineForm({ ...vaccineForm, appliedDate: e.target.value })}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-gray-600 mb-1">Lote / Fabricante</label>
                      <input
                        type="text"
                        placeholder="Ex: Lote TR5512B / Fiocruz"
                        value={vaccineForm.batch}
                        onChange={(e) => setVaccineForm({ ...vaccineForm, batch: e.target.value })}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Prazo sugerido de vencimento</label>
                    <input
                      type="date"
                      required
                      value={vaccineForm.dueDate}
                      onChange={(e) => setVaccineForm({ ...vaccineForm, dueDate: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="submit"
                    className="py-2 px-4 bg-emerald-600 font-bold hover:bg-emerald-700 text-white rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar Registro
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddVaccine(false)}
                    className="py-2 px-4 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* List Vaccines */}
            {memberVaccines.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Syringe className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">Nenhuma vacina registrada</p>
                <p className="text-xs bg-slate-50 inline-block px-3 py-1.5 rounded-lg border border-gray-100 mt-2 text-gray-500">Mantenha o calendário sanitário da família atualizado!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {memberVaccines.map((item) => {
                  const isOverdue = item.status === "overdue";
                  const isPending = item.status === "pending";
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left ${
                        isOverdue 
                          ? "border-red-200 bg-red-50/20" 
                          : isPending 
                            ? "border-amber-100 bg-yellow-50/10" 
                            : "border-gray-100 bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="font-extrabold text-gray-900 text-sm leading-tight">{item.name}</h4>
                          <span className={`text-3xs font-extrabold px-1.5 py-0.5 rounded ${
                            isOverdue 
                              ? "bg-red-500 text-white animate-pulse" 
                              : isPending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {item.status === "applied" ? "Aplicada / Ok" : isOverdue ? "Atrasada!" : "Pendente"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 font-semibold">
                          <span>Dose: {item.dose}</span>
                          {item.appliedDate && <span>Aferido em: <strong className="text-gray-700 font-bold">{formatDate(item.appliedDate)}</strong></span>}
                          {item.dueDate && <span>Vencimento do Prazo: <strong className={isOverdue ? "text-red-600" : "text-gray-700"}>{formatDate(item.dueDate)}</strong></span>}
                          {item.batch && <span className="text-2xs bg-gray-100 px-2 rounded font-mono">Lote: {item.batch}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-gray-100 justify-end">
                        {(isPending || isOverdue) && (
                          <button
                            type="button"
                            id={`btn-apply-vaccine-${item.id}`}
                            onClick={() => handleToggleVaccineApplied(item)}
                            className="py-1.5 px-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-emerald-100 transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aplicar Hoje
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditVaccine(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 bg-white hover:text-blue-700 border border-slate-200/55 rounded transition-colors cursor-pointer"
                          title="Editar vacina"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2.5. Surgeries Tab Screen */}
        {activeTab === "surgeries" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">Histórico Cirúrgico</h3>
                <p className="text-xs text-gray-500">Procedimentos pós-operatórios, cirurgias e intervenções clínicas</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSurgery(!showAddSurgery)}
                className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer self-stretch sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Cirurgia
              </button>
            </div>

            {showAddSurgery && (
              <form onSubmit={handleAddSurgery} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 mt-2 space-y-4 text-left animate-in slide-in-from-top-4 duration-205">
                <h4 className="font-bold text-sm text-gray-800">Nova Cirurgia / Procedimento</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Procedimento ou Cirurgia</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Correção de Estrabismo, Desvio de Septo"
                      value={surgeryForm.title}
                      onChange={(e) => setSurgeryForm({ ...surgeryForm, title: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Especialidade Médica</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Oftalmologia, Ortopedia"
                      value={surgeryForm.specialty}
                      onChange={(e) => setSurgeryForm({ ...surgeryForm, specialty: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Data do Procedimento</label>
                    <input
                      type="date"
                      required
                      value={surgeryForm.date}
                      onChange={(e) => setSurgeryForm({ ...surgeryForm, date: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Cirurgião Responsável</label>
                    <input
                      type="text"
                      placeholder="Ex: Dr. Rintaro"
                      value={surgeryForm.doctor}
                      onChange={(e) => setSurgeryForm({ ...surgeryForm, doctor: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Hospital / Unidade</label>
                    <input
                      type="text"
                      placeholder="Ex: Hospital Sadalla Amin"
                      value={surgeryForm.facility}
                      onChange={(e) => setSurgeryForm({ ...surgeryForm, facility: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Recomendações / Prescrição Pós-Operatória</label>
                    <textarea
                      placeholder="Medicamentos de uso temporário, repouso, curativos..."
                      value={surgeryForm.prescription}
                      onChange={(e) => setSurgeryForm({ ...surgeryForm, prescription: e.target.value })}
                      rows={3}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Anotações Gerais / Evolução</label>
                    <textarea
                      placeholder="Notas adicionais sobre a cirurgia ou recuperação..."
                      value={surgeryForm.notes}
                      onChange={(e) => setSurgeryForm({ ...surgeryForm, notes: e.target.value })}
                      rows={3}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="submit"
                    className="py-2 px-4 bg-emerald-600 font-bold hover:bg-emerald-700 text-white rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar Procedimento
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSurgery(false)}
                    className="py-2 px-4 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* List Surgeries */}
            {memberSurgeries.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Activity className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">Nenhuma cirurgia registrada</p>
                <p className="text-xs bg-slate-50 inline-block px-3 py-1.5 rounded-lg border border-gray-100 mt-2 text-gray-500 font-semibold">Adicione intervenções cirúrgicas para consolidar a ficha clínica.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {memberSurgeries.map((item) => {
                  return (
                    <div 
                      key={item.id} 
                      className="p-5 rounded-2xl border border-gray-100 bg-white hover:border-gray-200 relative text-left transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => handleStartEditSurgery(item)}
                        className="absolute right-4 top-4 p-1.5 text-blue-600 hover:bg-blue-50 bg-white hover:text-blue-700 border border-slate-200/55 rounded transition-colors cursor-pointer"
                        title="Editar cirurgia"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-md border border-pink-100">
                          {formatDate(item.date)}
                        </span>
                        <span className="text-xxs font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Intervenção Cirúrgica
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-2xs font-extrabold text-gray-400 uppercase">Procedimento</span>
                          <h4 className="font-extrabold text-gray-800 text-base">{item.reason || "Cirurgia Geral"}</h4>
                          <p className="text-xs text-gray-700 mt-0.5 font-bold">Especialidade: {item.specialty.replace(" (Cirurgia)", "")}</p>
                          {item.doctor && <p className="text-xs text-gray-500 mt-0.5 font-medium">Equipe: {item.doctor}</p>}
                          {item.facility && <p className="text-2xs text-gray-400 font-medium">{item.facility}</p>}
                        </div>

                        <div>
                          <span className="text-2xs font-extrabold text-gray-400 uppercase block">Recomendações e Pós-Operatório</span>
                          <p className="text-xs text-slate-705 text-slate-700 font-medium mt-1 leading-relaxed whitespace-pre-line bg-amber-50/20 border border-amber-100/50 p-2.5 rounded-xl">
                            {item.prescription || "Nenhum cuidado especial detalhado."}
                          </p>
                        </div>

                        <div>
                          <span className="text-2xs font-extrabold text-gray-400 uppercase block">Anotações / Evolução Clínica</span>
                          <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 font-medium mt-1 leading-relaxed whitespace-pre-line">
                            {item.notes || "Sem notas adicionais cadastradas."}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal Dialog */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-155 p-6 flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4 select-none">
              <h3 className="text-lg font-extrabold text-gray-900 inline-flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                Editar Ficha do Prontuário
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditProfileModal(false);
                  setConfirmDeleteId(null);
                }}
                className="p-1 px-1.5 hover:bg-gray-100 text-gray-400 rounded-xl text-xs font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-left">
              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Parentesco</label>
                  <input
                    type="text"
                    required
                    value={profileForm.relationship}
                    onChange={(e) => setProfileForm({ ...profileForm, relationship: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    required
                    value={profileForm.birthDate}
                    onChange={(e) => setProfileForm({ ...profileForm, birthDate: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Tipo Sanguíneo</label>
                  <select
                    value={profileForm.bloodType}
                    onChange={(e) => setProfileForm({ ...profileForm, bloodType: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100 cursor-pointer"
                  >
                    <option value="">Não Informado</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Alergias</label>
                <textarea
                  placeholder="Ex: Nenhuma, Penicilina, Corante Amarelo Tartrazina"
                  value={profileForm.allergies}
                  onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Comorbidades / Condições Crônicas</label>
                <textarea
                  placeholder="Ex: Nenhuma, Asma, Hipertensão, Diabetes Tipo 1"
                  value={profileForm.comorbidities}
                  onChange={(e) => setProfileForm({ ...profileForm, comorbidities: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Medicamentos em Uso (Uso Contínuo)</label>
                <textarea
                  placeholder="Ex: Nenhum, Cloridrato de Sertralina 50mg (1x ao dia pela manhã)"
                  value={profileForm.medications}
                  onChange={(e) => setProfileForm({ ...profileForm, medications: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-between items-center pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleDeleteProfile}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all duration-150 flex items-center gap-1 cursor-pointer active:scale-95 ${
                    confirmDeleteId === member.id
                      ? "bg-red-650 hover:bg-red-700 text-white animate-pulse"
                      : "bg-red-50 hover:bg-red-100 text-red-650 border border-red-200"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {confirmDeleteId === member.id ? "Confirmar Exclusão?" : "Excluir Integrante"}
                </button>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    id="btn-save-member-edit-profile"
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditProfileModal(false);
                      setConfirmDeleteId(null);
                    }}
                    className="py-2.5 px-4 bg-white text-gray-650 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100 active:scale-95"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Vital Modal Dialog */}
      {editingVital && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6 flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4 select-none">
              <h3 className="text-lg font-extrabold text-gray-900 inline-flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                Editar Sinais Vitais / Aferição
              </h3>
              <button
                type="button"
                onClick={() => setEditingVital(null)}
                className="p-1 px-1.5 hover:bg-gray-100 text-gray-400 rounded-xl text-xs font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVitalEdit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Data da Aferição</label>
                  <input
                    type="date"
                    required
                    value={editVitalForm.date}
                    onChange={(e) => setEditVitalForm({ ...editVitalForm, date: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 75.5"
                    value={editVitalForm.weight}
                    onChange={(e) => setEditVitalForm({ ...editVitalForm, weight: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Glicemia (mg/dL)</label>
                  <input
                    type="number"
                    placeholder="Ex: 92"
                    value={editVitalForm.glucose}
                    onChange={(e) => setEditVitalForm({ ...editVitalForm, glucose: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">P.A. Sistólica (Máx)</label>
                  <input
                    type="number"
                    placeholder="Ex: 120"
                    value={editVitalForm.sys}
                    onChange={(e) => setEditVitalForm({ ...editVitalForm, sys: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">P.A. Diastólica (Mín)</label>
                  <input
                    type="number"
                    placeholder="Ex: 80"
                    value={editVitalForm.dia}
                    onChange={(e) => setEditVitalForm({ ...editVitalForm, dia: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Batimentos (bpm)</label>
                  <input
                    type="number"
                    placeholder="Ex: 72"
                    value={editVitalForm.hr}
                    onChange={(e) => setEditVitalForm({ ...editVitalForm, hr: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Altura (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 154.5"
                    value={editVitalForm.height}
                    onChange={(e) => setEditVitalForm({ ...editVitalForm, height: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-between pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={async () => {
                    if (editingVital) {
                      setEditingVital(null);
                      await handleDeleteItem("vitals", editingVital.id);
                    }
                  }}
                  className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-red-200/50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover Registro
                </button>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingVital(null)}
                    className="py-2.5 px-4 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Consultation Modal Dialog */}
      {editingConsultation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6 flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4 select-none">
              <h3 className="text-lg font-extrabold text-gray-900 inline-flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                Editar Consulta Médica
              </h3>
              <button
                type="button"
                onClick={() => setEditingConsultation(null)}
                className="p-1 px-1.5 hover:bg-gray-100 text-gray-400 rounded-xl text-xs font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConsultationEdit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Data da Consulta</label>
                  <input
                    type="date"
                    required
                    value={editConsultForm.date}
                    onChange={(e) => setEditConsultForm({ ...editConsultForm, date: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Especialidade</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pediatria, Cardiologia"
                    value={editConsultForm.specialty}
                    onChange={(e) => setEditConsultForm({ ...editConsultForm, specialty: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Médico Responsável (CRM)</label>
                  <input
                    type="text"
                    placeholder="Ex: Dr. Nelson Araujo"
                    value={editConsultForm.doctor}
                    onChange={(e) => setEditConsultForm({ ...editConsultForm, doctor: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Hospital / Clínica / Local</label>
                  <input
                    type="text"
                    placeholder="Ex: Hospital Albert Einstein"
                    value={editConsultForm.facility}
                    onChange={(e) => setEditConsultForm({ ...editConsultForm, facility: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Motivo do Atendimento / Sintomas</label>
                <input
                  type="text"
                  placeholder="Ex: Check-up de rotina, febre de 38ºC à noite"
                  value={editConsultForm.reason}
                  onChange={(e) => setEditConsultForm({ ...editConsultForm, reason: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Prescrição Médica (Receitas, Dosagens)</label>
                <textarea
                  placeholder="Ex: Paracetamol 500mg de 8h em 8h se febre persistir."
                  value={editConsultForm.prescription}
                  onChange={(e) => setEditConsultForm({ ...editConsultForm, prescription: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Anotações Gerais / Recomendações</label>
                <textarea
                  placeholder="Ex: Retornar em 15 dias com resultados de exames de sangue."
                  value={editConsultForm.notes}
                  onChange={(e) => setEditConsultForm({ ...editConsultForm, notes: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-between pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={async () => {
                    if (editingConsultation) {
                      setEditingConsultation(null);
                      await handleDeleteItem("consultations", editingConsultation.id);
                    }
                  }}
                  className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-red-200/50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover Registro
                </button>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingConsultation(null)}
                    className="py-2.5 px-4 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Surgery Modal Dialog */}
      {editingSurgery && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6 flex flex-col text-left">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4 select-none">
              <h3 className="text-lg font-extrabold text-gray-900 inline-flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                Editar Procedimento Cirúrgico
              </h3>
              <button
                type="button"
                onClick={() => setEditingSurgery(null)}
                className="p-1 px-1.5 hover:bg-gray-100 text-gray-400 rounded-xl text-xs font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSurgeryEdit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Data do Procedimento</label>
                  <input
                    type="date"
                    required
                    value={editSurgeryForm.date}
                    onChange={(e) => setEditSurgeryForm({ ...editSurgeryForm, date: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Especialidade Cirúrgica</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Geral, Ortopedia, Oftalmologia"
                    value={editSurgeryForm.specialty}
                    onChange={(e) => setEditSurgeryForm({ ...editSurgeryForm, specialty: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Médico Cirurgião / CRM</label>
                  <input
                    type="text"
                    placeholder="Ex: Dra. Eliana Silva"
                    value={editSurgeryForm.doctor}
                    onChange={(e) => setEditSurgeryForm({ ...editSurgeryForm, doctor: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Hospital / Clínica</label>
                  <input
                    type="text"
                    placeholder="Ex: Hospital Samaritano"
                    value={editSurgeryForm.facility}
                    onChange={(e) => setEditSurgeryForm({ ...editSurgeryForm, facility: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Procedimento / Motivo (Título)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Apendicectomia, Correção de Miopia"
                  value={editSurgeryForm.title}
                  onChange={(e) => setEditSurgeryForm({ ...editSurgeryForm, title: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Tratamento Pós-Operatório / Receitas</label>
                <textarea
                  placeholder="Ex: Repouso por 7 dias, Analgésico se dor."
                  value={editSurgeryForm.prescription}
                  onChange={(e) => setEditSurgeryForm({ ...editSurgeryForm, prescription: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1">Anotações Gerais / Recomendações</label>
                <textarea
                  placeholder="Ex: Retorno cirúrgico em 10 dias para retirada de pontos."
                  value={editSurgeryForm.notes}
                  onChange={(e) => setEditSurgeryForm({ ...editSurgeryForm, notes: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-between pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={async () => {
                    if (editingSurgery) {
                      setEditingSurgery(null);
                      await handleDeleteItem("consultations", editingSurgery.id);
                    }
                  }}
                  className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-red-200/50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover Registro
                </button>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSurgery(null)}
                    className="py-2.5 px-4 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Exam Modal Dialog */}
      {editingExam && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6 flex flex-col text-left">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4 select-none">
              <h3 className="text-lg font-extrabold text-gray-900 inline-flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                Editar Exame Clínico
              </h3>
              <button
                type="button"
                onClick={() => setEditingExam(null)}
                className="p-1 px-1.5 hover:bg-gray-100 text-gray-400 rounded-xl text-xs font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExamEdit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Data do Exame</label>
                  <input
                    type="date"
                    required
                    value={editExamForm.date}
                    onChange={(e) => setEditExamForm({ ...editExamForm, date: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Nome do Exame</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hemograma Completo, Raio-X de Tórax"
                    value={editExamForm.title}
                    onChange={(e) => setEditExamForm({ ...editExamForm, title: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-2xs font-bold text-gray-600 mb-1 font-semibold">Categoria</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Sangue, Imagem, Urina"
                    value={editExamForm.category}
                    onChange={(e) => setEditExamForm({ ...editExamForm, category: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-2xs font-bold text-gray-600 mb-1 font-semibold">Laboratório / Local</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Laboratório Fleury"
                    value={editExamForm.facility}
                    onChange={(e) => setEditExamForm({ ...editExamForm, facility: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Médico Solicitante</label>
                  <input
                    type="text"
                    placeholder="Ex: Dr. Nelson Araujo"
                    value={editExamForm.doctor}
                    onChange={(e) => setEditExamForm({ ...editExamForm, doctor: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-1 font-semibold">Resultados / Observações do Laudo</label>
                <textarea
                  placeholder="Ex: Colesterol LDL: 110 mg/dL, glicemia normal..."
                  value={editExamForm.observations}
                  onChange={(e) => setEditExamForm({ ...editExamForm, observations: e.target.value })}
                  rows={3}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-between pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={async () => {
                    if (editingExam) {
                      setEditingExam(null);
                      await handleDeleteItem("exams", editingExam.id);
                    }
                  }}
                  className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-red-200/50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover Registro
                </button>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingExam(null)}
                    className="py-2.5 px-4 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Vaccine Modal Dialog */}
      {editingVaccine && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6 flex flex-col text-left">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4 select-none">
              <h3 className="text-lg font-extrabold text-gray-900 inline-flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                Editar Histórico de Vacina
              </h3>
              <button
                type="button"
                onClick={() => setEditingVaccine(null)}
                className="p-1 px-1.5 hover:bg-gray-100 text-gray-400 rounded-xl text-xs font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVaccineEdit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Nome da Vacina</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tríplice Viral, Pfizer Bivalente"
                    value={editVaccineForm.name}
                    onChange={(e) => setEditVaccineForm({ ...editVaccineForm, name: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Dose</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 1ª Dose, Reforço Anual"
                    value={editVaccineForm.dose}
                    onChange={(e) => setEditVaccineForm({ ...editVaccineForm, dose: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-100 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 mb-2">Situação da Vacina</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditVaccineForm({ ...editVaccineForm, status: "applied" })}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      editVaccineForm.status === "applied"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-300"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    ✅ Aplicada
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditVaccineForm({ ...editVaccineForm, status: "pending" })}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      editVaccineForm.status !== "applied"
                        ? "bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-300"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    ⏳ Agendada (Pendente)
                  </button>
                </div>
              </div>

              {editVaccineForm.status === "applied" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in slide-in-from-top-1 duration-150">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Data da Aplicação</label>
                    <input
                      type="date"
                      required
                      value={editVaccineForm.appliedDate}
                      onChange={(e) => setEditVaccineForm({ ...editVaccineForm, appliedDate: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 mb-1">Lote / Fabricante</label>
                    <input
                      type="text"
                      placeholder="Ex: B7281A"
                      value={editVaccineForm.batch}
                      onChange={(e) => setEditVaccineForm({ ...editVaccineForm, batch: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>
              ) : (
                <div className="animate-in slide-in-from-top-1 duration-150">
                  <label className="block text-2xs font-bold text-gray-600 mb-1">Previsão da Dose / Data Limite</label>
                  <input
                    type="date"
                    required
                    value={editVaccineForm.dueDate}
                    onChange={(e) => setEditVaccineForm({ ...editVaccineForm, dueDate: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-100"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-between pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={async () => {
                    if (editingVaccine) {
                      setEditingVaccine(null);
                      await handleDeleteItem("vaccines", editingVaccine.id);
                    }
                  }}
                  className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-red-200/50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover Vacina
                </button>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingVaccine(null)}
                    className="py-2.5 px-4 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Resolution Photo Viewer Modal */}
      {viewingPhotoUrl && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-4 flex flex-col items-center">
            <button
              type="button"
              className="absolute right-4 top-4 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors font-bold text-sm cursor-pointer"
              onClick={() => setViewingPhotoUrl(null)}
            >
              <X className="w-5 h-5 shadow-3xs" />
            </button>
            <h3 className="font-bold text-gray-800 mb-4 inline-flex items-center gap-1.5 text-sm select-none">
              <Clipboard className="w-4 h-4 text-blue-500" />
              Laudo Físico do Exame Anexado
            </h3>
            <div className="overflow-auto w-full max-h-[500px] flex flex-col items-center justify-center">
              {viewingPhotoUrl.startsWith("data:application/pdf") ? (
                <div className="w-full flex flex-col items-center gap-4">
                  <div className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col items-center text-center">
                    <FileText className="w-16 h-16 text-rose-500 mb-2 animate-pulse" />
                    <span className="text-xs font-black text-slate-800">Documento em formato PDF</span>
                    <p className="text-3xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                      Para melhor visualização no celular ou para salvar o laudo completo, use uma das opções abaixo.
                    </p>
                  </div>
                  
                  {/* Desktop view iframe, hidden on small screens */}
                  <div className="hidden sm:block w-full h-[320px] border border-slate-200 rounded-xl overflow-hidden mt-1">
                    <iframe
                      src={viewingPhotoUrl}
                      title="Visualizador de PDF Exame"
                      className="w-full h-full"
                    />
                  </div>

                  {/* Actions buttons */}
                  <div className="w-full flex flex-col sm:flex-row gap-2 mt-1">
                    <a
                      href={viewingPhotoUrl}
                      download={`exame-${member.name.toLowerCase()}-${Date.now()}.pdf`}
                      className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center"
                    >
                      <Download className="w-4 h-4" />
                      Baixar Arquivo PDF
                    </a>
                    
                    <button
                      type="button"
                      onClick={() => {
                        const newTab = window.open();
                        if (newTab) {
                          newTab.document.write(`<iframe src="${viewingPhotoUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                        }
                      }}
                      className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Visualizar em Tela Cheia
                    </button>
                  </div>
                </div>
              ) : (
                <img 
                  referrerPolicy="no-referrer"
                  src={viewingPhotoUrl} 
                  alt="Documento ampliado" 
                  className="max-w-full object-contain max-h-[460px] rounded-lg shadow-sm border border-gray-100"
                />
              )}
            </div>
            <p className="text-2xs text-gray-500 mt-4 leading-normal text-center select-none">Este documento está guardado com total segurança no banco offline do seu celular.</p>
          </div>
        </div>
      )}

      {/* Spreadsheet Import Drawer Dialog Modal overlay */}
      <SpreadsheetImporter
        member={member}
        isOpen={showSpreadsheetImport}
        onClose={() => setShowSpreadsheetImport(false)}
        onDataImported={onDataChanged}
      />

      {/* Custom Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 p-6 flex flex-col text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-50 mb-4 text-red-650 border border-red-100">
              <AlertCircle className="h-6 w-6" />
            </div>
            
            <h3 className="text-base font-black text-gray-900 mb-1">
              Confirmar Exclusão
            </h3>
            
            <p className="text-xs text-gray-500 font-semibold leading-relaxed mb-6">
              Tem certeza que deseja remover este registro? Esta ação é irreversível e apagará permanentemente esses dados.
            </p>
            
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { dbService } = await import("../lib/db.ts");
                    const { storeName, id } = itemToDelete;
                    if (storeName === "consultations") await dbService.deleteConsultation(id);
                    if (storeName === "exams") await dbService.deleteExam(id);
                    if (storeName === "vaccines") await dbService.deleteVaccine(id);
                    if (storeName === "vitals") await dbService.deleteVital(id);
                    
                    setItemToDelete(null);
                    onDataChanged();
                  } catch (err) {
                    setErrorText("Falha ao deletar informação.");
                  }
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl cursor-pointer active:scale-95 transition-all shadow-xs"
              >
                Sim, Remover
              </button>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 px-4 bg-white text-gray-650 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 cursor-pointer active:scale-95 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
