/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { 
  Heart, BrainCircuit, Bell, Settings, Award, Users, 
  Plus, Edit3, CheckCircle, Smartphone, Info, Save, X, Database,
  Cloud, RefreshCw, AlertTriangle, Download, Trash2
} from "lucide-react";

import { FamilyMember, Consultation, Exam, HealthVital, Vaccine } from "./types";
import { dbService } from "./lib/db";

// Components
import MemberProfile from "./components/MemberProfile";
import AIExamScanner from "./components/AIExamScanner";
import RemindersList from "./components/RemindersList";
import BackupManager from "./components/BackupManager";

type MainViewTab = "portfolio" | "scanner" | "reminders";

export default function App() {
  const [activeTab, setActiveTab] = useState<MainViewTab>("portfolio");
  const [showBackup, setShowBackup] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [vitals, setVitals] = useState<HealthVital[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Auto Cloud Sync Detect States
  const [googleAuthState, setGoogleAuthState] = useState<{ user: any; token: string | null }>({ user: null, token: null });
  const [driveCheckPending, setDriveCheckPending] = useState(true);
  const [driveBackupToOffer, setDriveBackupToOffer] = useState<{ id: string; name: string; modifiedTime: string; size?: string } | null>(null);
  const [showDriveOfferModal, setShowDriveOfferModal] = useState(false);
  const [autoRestoreLoading, setAutoRestoreLoading] = useState(false);

  // Editing Member State
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isAddingNewMember, setIsAddingNewMember] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ 
    name: "", 
    relationship: "", 
    birthDate: "", 
    bloodType: "", 
    allergies: "",
    comorbidities: "",
    medications: ""
  });

  // Load all data from IndexedDB
  const loadClinicalData = async () => {
    try {
      const pMembers = await dbService.getMembers();
      const pConsults = await dbService.getConsultations();
      const pExams = await dbService.getExams();
      const pVitals = await dbService.getVitals();
      const pVaccines = await dbService.getVaccines();

      setMembers(pMembers);
      setConsultations(pConsults);
      setExams(pExams);
      setVitals(pVitals);
      setVaccines(pVaccines);

      if (pMembers.length > 0 && !selectedMemberId) {
        setSelectedMemberId(pMembers[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do prontuário local:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkDriveBackupForNewerVersion = async (token: string) => {
    try {
      const q = encodeURIComponent("(name contains '.json' or mimeType = 'application/json') and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=10`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        const files = data.files || [];
        if (files.length > 0) {
          const newestFile = files[0];
          
          const localLastUpdateStr = dbService.getLocalLastUpdate();
          const localTime = localLastUpdateStr ? new Date(localLastUpdateStr).getTime() : 0;
          const driveTime = newestFile.modifiedTime ? new Date(newestFile.modifiedTime).getTime() : 0;
          
          if (driveTime > localTime + 5000) {
            const dismissedId = sessionStorage.getItem(`dismissed_drive_restore_${newestFile.id}`);
            if (!dismissedId) {
              setDriveBackupToOffer(newestFile);
              setShowDriveOfferModal(true);
            }
          }
        }
      }
    } catch (err) {
      console.error("Erro ao verificar versão de backup no auto-check:", err);
    } finally {
      setDriveCheckPending(false);
    }
  };

  const handleAutoRestore = async (mode: 'merge' | 'replace') => {
    if (!googleAuthState.token || !driveBackupToOffer) return;
    
    setAutoRestoreLoading(true);
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${driveBackupToOffer.id}?alt=media`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${googleAuthState.token}` }
      });
      
      if (!res.ok) {
        throw new Error(`Falha ao obter backup do Drive: HTTP ${res.status}`);
      }
      
      const backup = await res.json();
      if (!backup || typeof backup !== "object") {
        throw new Error("Formato de arquivo JSON do backup é inválido.");
      }
      
      const membersList = backup.members || [];
      const consultationsList = backup.consultations || [];
      const examsList = backup.exams || [];
      const vitalsList = backup.vitals || [];
      const vaccinesList = backup.vaccines || [];
      
      if (mode === "replace") {
        await dbService.clearAllData();
      }
      
      for (const m of membersList) {
        await dbService.saveMember(m);
      }
      for (const c of consultationsList) {
        await dbService.saveConsultation(c);
      }
      for (const ex of examsList) {
        await dbService.saveExam(ex);
      }
      for (const vt of vitalsList) {
        await dbService.saveVital(vt);
      }
      for (const vc of vaccinesList) {
        await dbService.saveVaccine(vc);
      }
      
      if (backup.exportedAt) {
        dbService.setLocalLastUpdate(backup.exportedAt);
      } else if (driveBackupToOffer.modifiedTime) {
        dbService.setLocalLastUpdate(driveBackupToOffer.modifiedTime);
      } else {
        dbService.setLocalLastUpdate(new Date().toISOString());
      }
      
      alert(
        `Sucesso! Prontuário restaurado com sucesso a partir do Google Drive.\n` +
        `Carregados: ${membersList.length} integrante(s), ${consultationsList.length} consulta(s), ${examsList.length} exame(s).`
      );
      
      setShowDriveOfferModal(false);
      setDriveBackupToOffer(null);
      await loadClinicalData();
    } catch (err: any) {
      console.error(err);
      alert("Falha ao restaurar backup automaticamente: " + (err.message || String(err)));
    } finally {
      setAutoRestoreLoading(false);
    }
  };

  const handleDismissDriveOffer = () => {
    if (driveBackupToOffer) {
      sessionStorage.setItem(`dismissed_drive_restore_${driveBackupToOffer.id}`, "true");
    }
    setShowDriveOfferModal(false);
  };

  useEffect(() => {
    loadClinicalData();
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    import("./lib/auth")
      .then(({ initAuth }) => {
        unsubscribe = initAuth(
          async (user, token) => {
            setGoogleAuthState({ user, token });
            checkDriveBackupForNewerVersion(token);
          },
          () => {
            setGoogleAuthState({ user: null, token: null });
            setDriveCheckPending(false);
          }
        );
      })
      .catch((err) => {
        console.error("Erro ao iniciar auth listener no App:", err);
        setDriveCheckPending(false);
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleAddNewMemberClick = () => {
    setIsAddingNewMember(true);
    setEditForm({
      name: "",
      relationship: "",
      birthDate: "",
      bloodType: "A+",
      allergies: "",
      comorbidities: "",
      medications: "",
    });
  };

  const handleEditMemberClick = (member: FamilyMember) => {
    setIsAddingNewMember(false);
    setEditingMember(member);
    setEditForm({
      name: member.name,
      relationship: member.relationship,
      birthDate: member.birthDate,
      bloodType: member.bloodType,
      allergies: member.allergies,
      comorbidities: member.comorbidities || "",
      medications: member.medications || "",
    });
  };

  const handleDeleteMember = async (memberId: string) => {
    if (confirmDeleteId !== memberId) {
      setConfirmDeleteId(memberId);
      return;
    }

    try {
      // 1. Cascade-delete clinical data for this member inside IndexedDB
      const pConsults = await dbService.getConsultations();
      for (const c of pConsults.filter(item => item.memberId === memberId)) {
        await dbService.deleteConsultation(c.id);
      }
      
      const pExams = await dbService.getExams();
      for (const ex of pExams.filter(item => item.memberId === memberId)) {
        await dbService.deleteExam(ex.id);
      }

      const pVitals = await dbService.getVitals();
      for (const vt of pVitals.filter(item => item.memberId === memberId)) {
        await dbService.deleteVital(vt.id);
      }

      const pVaccines = await dbService.getVaccines();
      for (const vc of pVaccines.filter(item => item.memberId === memberId)) {
        await dbService.deleteVaccine(vc.id);
      }

      // 2. Delete the member themselves
      await dbService.deleteMember(memberId);

      setEditingMember(null);
      setConfirmDeleteId(null);
      setIsAddingNewMember(false);
      
      const nextMembers = members.filter(m => m.id !== memberId);
      if (nextMembers.length > 0) {
        setSelectedMemberId(nextMembers[0].id);
      } else {
        setSelectedMemberId("");
      }

      await loadClinicalData();
    } catch (err) {
      console.error("Erro ao excluir integrante:", err);
    }
  };

  const handleEditMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingNewMember && !editingMember) return;

    try {
      if (isAddingNewMember) {
        const colors = [
          "bg-blue-600",
          "bg-emerald-500",
          "bg-rose-500",
          "bg-purple-500",
          "bg-indigo-500",
          "bg-orange-550",
          "bg-pink-500",
          "bg-amber-500",
          "bg-red-500"
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newId = "member_" + Date.now();
        const newMember: FamilyMember = {
          id: newId,
          name: editForm.name,
          relationship: editForm.relationship,
          birthDate: editForm.birthDate,
          bloodType: editForm.bloodType || "O+",
          allergies: editForm.allergies || "Nenhuma",
          avatarColor: randomColor,
          comorbidities: editForm.comorbidities,
          medications: editForm.medications,
        };

        await dbService.saveMember(newMember);
        setIsAddingNewMember(false);
        setSelectedMemberId(newId);
      } else if (editingMember) {
        const updated: FamilyMember = {
          ...editingMember,
          name: editForm.name,
          relationship: editForm.relationship,
          birthDate: editForm.birthDate,
          bloodType: editForm.bloodType,
          allergies: editForm.allergies,
          comorbidities: editForm.comorbidities,
          medications: editForm.medications,
        };

        await dbService.saveMember(updated);
        setEditingMember(null);
      }
      await loadClinicalData();
    } catch (err) {
      console.error("Erro ao salvar dados do membro:", err);
    }
  };

  const activeMember = members.find((m) => m.id === selectedMemberId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-14 h-14 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
        <h3 className="text-gray-800 font-bold text-lg select-none">Iniciando Prontuário Médico Familiar...</h3>
        <p className="text-sm text-gray-500 mt-1 select-none">Configurando base de dados offline e de alta velocidade.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-800" id="app-root">
      {/* Top Brand Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/60 shadow-xs" id="app-header">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-xs shrink-0">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-white/10" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-gray-900 leading-tight truncate">
                Histórico Médico Familiar
              </h1>
              <span className="text-[9px] sm:text-[10px] font-extrabold text-blue-600 tracking-wider uppercase block mt-0.5 truncate">
                {members.length} {members.length === 1 ? "Integrante" : "Integrantes"} • Prontuário IA
              </span>
            </div>
          </div>

          {/* Quick Action elements */}
          <div className="select-none shrink-0">
            <button
              type="button"
              id="btn-open-backup"
              onClick={() => setShowBackup(true)}
              className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold border border-blue-200 rounded-xl text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer shadow-3xs active:scale-95"
            >
              <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="hidden sm:inline">Salvar ou Restaurar</span>
              <span className="sm:hidden">Sincronizar</span>
            </button>
          </div>
        </div>

        {/* Global tab Switcher navigation bar */}
        <div className="max-w-5xl mx-auto border-t border-slate-100 bg-white shadow-3xs" id="main-navigation">
          <div className="grid grid-cols-3 w-full bg-white px-1 sm:px-4">
            {(["portfolio", "scanner", "reminders"] as MainViewTab[]).map((tab) => {
              const isSelected = activeTab === tab;
              const labels = {
                portfolio: (
                  <>
                    <span className="hidden sm:inline">Prontuário Individual</span>
                    <span className="sm:hidden">Prontuário</span>
                  </>
                ),
                scanner: (
                  <>
                    <span className="hidden sm:inline">SmartScan™ IA</span>
                    <span className="sm:hidden">SmartScan IA</span>
                  </>
                ),
                reminders: (
                  <>
                    <span className="hidden sm:inline">Vacinas & Lembretes</span>
                    <span className="sm:hidden">Lembretes</span>
                  </>
                )
              };
              const Icons = {
                portfolio: Users,
                scanner: BrainCircuit,
                reminders: Bell
              };
              const Icon = Icons[tab];

              return (
                <button
                  key={tab}
                  type="button"
                  className={`py-3 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs md:text-sm font-bold tracking-wide border-b-3 transition-colors cursor-pointer shrink-0 ${
                    isSelected 
                      ? "border-blue-600 text-blue-600 font-black bg-blue-50/5" 
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50/50"
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="truncate max-w-full leading-none">{labels[tab]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main viewport Container */}
      <main className="max-w-5xl mx-auto px-4 mt-6">
        
        {/* TAB 1: Individual medical profile portfolios */}
        {activeTab === "portfolio" && (
          <div className="space-y-6">
            
            {/* Horizontal Family member row chooser */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-5" id="member-scroller">
              <div className="flex items-center justify-between mb-3 text-left">
                <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-widest block font-bold select-none">
                  Escolha o Integrante da Família
                </span>
                
                {activeMember && (
                  <button
                    type="button"
                    onClick={() => handleEditMemberClick(activeMember)}
                    className="text-[9px] text-blue-600 font-extrabold hover:text-blue-800 flex items-center gap-0.5 cursor-pointer bg-blue-50 hover:bg-blue-100/70 border border-blue-100 px-1.5 py-0.5 rounded-md transition-transform"
                    id="btn-edit-member"
                  >
                    <Edit3 className="w-2.5 h-2.5" />
                    Editar Perfil
                  </button>
                )}
              </div>

              {/* Members horizontal slider container */}
              <div className="flex gap-3 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-gray-200" id="members-horizontal-list">
                {members.map((member) => {
                  const isSelected = member.id === selectedMemberId;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={`flex-none flex items-center gap-3 py-3 px-4 rounded-xl border transition-all text-left cursor-pointer ${
                        isSelected 
                          ? "border-blue-600 bg-blue-50/20 ring-1 ring-blue-600/50 shadow-3xs" 
                          : "border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedMemberId(member.id)}
                    >
                      {/* Circle avatar badge */}
                      <div className={`w-10 h-10 rounded-lg ${member.avatarColor} text-white font-extrabold flex items-center justify-center shadow-3xs uppercase tracking-wide`}>
                        {member.name.substring(0, 2)}
                      </div>
                      
                      <div className="min-w-[80px]">
                        <h4 className="font-bold text-gray-900 text-xs truncate leading-snug">{member.name}</h4>
                        <span className="text-3xs font-semibold text-gray-500 uppercase tracking-wider block mt-0.5">{member.relationship}</span>
                      </div>
                    </button>
                  );
                })}

                {/* Add member button inside carousel */}
                <button
                  type="button"
                  onClick={handleAddNewMemberClick}
                  className="flex-none flex items-center gap-3 py-3 px-4 rounded-xl border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/20 hover:text-blue-600 text-gray-500 font-extrabold transition-all text-left cursor-pointer"
                  id="btn-add-new-member-carousel"
                >
                  <div className="w-10 h-10 rounded-lg border border-dashed border-gray-300 hover:border-blue-300 flex items-center justify-center bg-gray-50/10 shadow-3xs shrink-0 select-none">
                    <Plus className="w-5 h-5 text-gray-405 group-hover:text-blue-500" />
                  </div>
                  <div className="min-w-[80px]">
                    <h4 className="font-semibold text-xs leading-snug">Novo Membro</h4>
                    <span className="text-3xs font-semibold uppercase tracking-wider block mt-0.5 text-blue-600">Cadastrar</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Render active selected Member Profile Ledger */}
            {activeMember ? (
              <MemberProfile
                member={activeMember}
                consultations={consultations}
                exams={exams}
                vitals={vitals}
                vaccines={vaccines}
                onDataChanged={loadClinicalData}
              />
            ) : (
              <div className="text-center p-12 bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center">
                <Users className="w-12 h-12 text-gray-300 mb-2 shrink-0" />
                <p className="font-bold text-gray-700 max-w-sm mb-4">Selecione ou cadastre um integrante para visualizar seu histórico de prontuários.</p>
                <button
                  type="button"
                  onClick={handleAddNewMemberClick}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Integrante
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AI exam scanner portal */}
        {activeTab === "scanner" && (
          <AIExamScanner 
            members={members} 
            onExamSaved={loadClinicalData} 
          />
        )}

        {/* TAB 3: Global reminders & auto alert ledger */}
        {activeTab === "reminders" && (
          <RemindersList 
            members={members} 
            consultations={consultations} 
            vaccines={vaccines} 
          />
        )}
      </main>

      {/* Edit/Add Member Profile Modal Dialog */}
      {(editingMember || isAddingNewMember) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="relative max-w-sm w-full max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl p-5 sm:p-6 text-left overflow-hidden">
            <button
              type="button"
              className="absolute right-4 top-4 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors cursor-pointer animate-in fade-in zoom-in-95"
              onClick={() => {
                setEditingMember(null);
                setIsAddingNewMember(false);
                setConfirmDeleteId(null);
              }}
            >
              <X className="w-4 h-4 shadow-3xs" />
            </button>

            <h3 className="font-extrabold text-gray-900 text-lg mb-4 inline-flex items-center gap-2 shrink-0 select-none">
              {isAddingNewMember ? (
                <>
                  <Plus className="w-5 h-5 text-emerald-500" />
                  Cadastrar Integrante
                </>
              ) : (
                <>
                  <Users className="w-5 h-5 text-blue-500" />
                  Editar Dados de Saúde
                </>
              )}
            </h3>

            <form onSubmit={handleEditMemberSubmit} className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
              <div>
                <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wider mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva..."
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-100 font-semibold text-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wider mb-1">Parentesco</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Filho, Mãe, Tio..."
                    value={editForm.relationship}
                    onChange={(e) => setEditForm({ ...editForm, relationship: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-100 text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wider mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    required
                    value={editForm.birthDate}
                    onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-100 text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wider mb-1">Tipo Sanguíneo</label>
                  <select
                    value={editForm.bloodType}
                    onChange={(e) => setEditForm({ ...editForm, bloodType: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-100 text-gray-800"
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Não Sei"].map((blood) => (
                      <option key={blood} value={blood}>
                        {blood}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wider mb-1">Alergias</label>
                  <input
                    type="text"
                    placeholder="Ex: Nenhuma, Dipirona..."
                    value={editForm.allergies}
                    onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-100 text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wider mb-1">Comorbidades</label>
                  <input
                    type="text"
                    placeholder="Ex: Asma, Hipertensão..."
                    value={editForm.comorbidities}
                    onChange={(e) => setEditForm({ ...editForm, comorbidities: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-100 text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wider mb-1">Medicamentos em Uso</label>
                  <input
                    type="text"
                    placeholder="Ex: Symbicort, Sertralina..."
                    value={editForm.medications}
                    onChange={(e) => setEditForm({ ...editForm, medications: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-100 text-gray-800"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-between items-center">
                {!isAddingNewMember && editingMember && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(editingMember.id)}
                    className={`py-2 px-3 rounded-xl text-[10px] font-extrabold transition-all duration-150 flex items-center gap-1 cursor-pointer active:scale-95 shrink-0 select-none ${
                      confirmDeleteId === editingMember.id
                        ? "bg-red-650 text-white animate-pulse"
                        : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmDeleteId === editingMember.id ? "Confirmar?" : "Excluir"}
                  </button>
                )}

                <div className="flex gap-2 ml-auto">
                  <button
                    type="submit"
                    id="btn-save-member-edit"
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 font-bold text-white text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-transform cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isAddingNewMember ? "Adicionar" : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMember(null);
                      setIsAddingNewMember(false);
                      setConfirmDeleteId(null);
                    }}
                    className="py-2 px-4 bg-white text-gray-600 border border-gray-200 rounded-xl text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Drive Automatic Restore Alert Overlay */}
      {showDriveOfferModal && driveBackupToOffer && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-6 text-left border border-blue-100 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              className="absolute right-4 top-4 p-2 bg-gray-50 hover:bg-gray-150 text-gray-500 hover:text-gray-800 rounded-full transition-colors cursor-pointer"
              onClick={handleDismissDriveOffer}
              disabled={autoRestoreLoading}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Cloud className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-black text-gray-950 text-base leading-tight">
                  Backup mais recente na Nuvem!
                </h3>
                <span className="text-[10px] text-blue-600 font-extrabold tracking-wider uppercase block mt-0.5">
                  Sincronização em Nuvem Detectada
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-650 font-medium leading-relaxed mb-4">
              Encontramos um arquivo de prontuário clínico salvo no seu Google Drive com atualizações mais recentes do que as informações salvas localmente neste navegador.
            </p>

            <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-3.5 space-y-2 mb-4 text-xs font-semibold text-gray-700">
              <div className="flex justify-between items-center text-[9px] uppercase tracking-wider text-gray-450 font-black">
                <span>Navegador Local</span>
                <span>Google Drive (Nuvem)</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="border-r border-gray-200 pr-2">
                  <p className="font-extrabold text-gray-900 leading-tight text-xs">Instalação Atual</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {(() => {
                      const localVal = dbService.getLocalLastUpdate();
                      return localVal 
                        ? new Date(localVal).toLocaleString("pt-BR") 
                        : "Sem alterações registradas";
                    })()}
                  </p>
                </div>
                <div className="pl-2">
                  <p className="font-extrabold text-blue-900 leading-tight text-xs truncate animate-pulse" title={driveBackupToOffer.name}>
                    {driveBackupToOffer.name}
                  </p>
                  <p className="text-[10px] text-blue-700 mt-1">
                    {driveBackupToOffer.modifiedTime 
                      ? new Date(driveBackupToOffer.modifiedTime).toLocaleString("pt-BR") 
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={autoRestoreLoading}
                  onClick={() => handleAutoRestore("replace")}
                  className="flex-1 py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-350 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-98"
                >
                  {autoRestoreLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Limpar & Substituir
                </button>
                <button
                  type="button"
                  disabled={autoRestoreLoading}
                  onClick={() => handleAutoRestore("merge")}
                  className="flex-1 py-2.5 px-3.5 bg-sky-50 hover:bg-sky-100 disabled:bg-slate-35 border border-sky-150 text-sky-800 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  Mesclar com Local
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={autoRestoreLoading}
                  onClick={handleDismissDriveOffer}
                  className="w-full py-2 bg-white hover:bg-gray-50 text-gray-500 border border-gray-250/55 hover:text-gray-700 text-center font-bold text-[9px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                >
                  Ignorar e Manter Dados Locais
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup and Restore Manager Dialog Modal overlay */}
      <BackupManager 
        isOpen={showBackup} 
        onClose={() => setShowBackup(false)} 
        onDataImported={loadClinicalData} 
      />
    </div>
  );
}
