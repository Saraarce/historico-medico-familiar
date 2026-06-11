import React, { useState, useEffect } from "react";
import { Download, Upload, Database, AlertCircle, Check, X, RefreshCw, Cloud, LogOut, Share2 } from "lucide-react";
import { dbService } from "../lib/db";
import { FamilyMember, Consultation, Exam, HealthVital, Vaccine } from "../types";
import { User } from "firebase/auth";

interface BackupData {
  version: number;
  exportedAt: string;
  members?: FamilyMember[];
  consultations?: Consultation[];
  exams?: Exam[];
  vitals?: HealthVital[];
  vaccines?: Vaccine[];
}

interface BackupManagerProps {
  onDataImported: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function BackupManager({ onDataImported, isOpen, onClose }: BackupManagerProps) {
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info" | null; text: string }>({ type: null, text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"drive" | "local">("local");

  // Local file upload states
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null);
  const [parsedBackupData, setParsedBackupData] = useState<BackupData | null>(null);

  // Google authentication and Drive file states
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleBackupFile, setGoogleBackupFile] = useState<{ id: string; name: string; modifiedTime?: string } | null>(null);
  const [googleBackupFilesList, setGoogleBackupFilesList] = useState<Array<{ id: string; name: string; modifiedTime?: string; size?: string }>>([]);
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string>("");
  const [localFileToUploadToDrive, setLocalFileToUploadToDrive] = useState<File | null>(null);

  const isMounted = React.useRef(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    
    let unsubscribe: (() => void) | undefined;
    
    import("../lib/auth")
      .then(({ initAuth }) => {
        unsubscribe = initAuth(
          (user, token) => {
            if (isMounted.current) {
              setGoogleUser(user);
              setGoogleToken(token);
            }
            fetchBackupFileInfo(token);
          },
          () => {
            if (isMounted.current) {
              setGoogleUser(null);
              setGoogleToken(null);
              setGoogleBackupFile(null);
            }
          }
        );
      })
      .catch(err => console.error("Erro ao carregar módulo de auth no BackupManager:", err));

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  const fetchBackupFileInfo = async (token: string) => {
    try {
      const q = encodeURIComponent("(name contains '.json' or mimeType = 'application/json') and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=30`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const files = data.files || [];
        if (isMounted.current) {
          setGoogleBackupFilesList(files);
          if (files.length > 0) {
            setGoogleBackupFile(files[0]);
            setSelectedDriveFileId(files[0].id);
          } else {
            setGoogleBackupFile(null);
            setSelectedDriveFileId("");
          }
        }
      }
    } catch (err) {
      console.error("Erro ao buscar backup no Drive:", err);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isMounted.current) {
      setIsLoading(true);
      setStatusMsg({ type: "info", text: "Conectando ao Google..." });
    }
    try {
      const { googleSignIn } = await import("../lib/auth");
      const result = await googleSignIn();
      if (result) {
        if (isMounted.current) {
          setGoogleUser(result.user);
          setGoogleToken(result.accessToken);
        }
        await fetchBackupFileInfo(result.accessToken);
        if (isMounted.current) {
          setStatusMsg({ type: "success", text: "Conectado ao Google Drive com sucesso!" });
        }
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Falha na conexão com Google: " + (err.message || String(err)) });
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      const { logout } = await import("../lib/auth");
      await logout();
      if (isMounted.current) {
        setGoogleUser(null);
        setGoogleToken(null);
        setGoogleBackupFile(null);
        setStatusMsg({ type: "info", text: "Google Desconectado com sucesso." });
      }
    } catch (err) {
      console.error("Erro no signout:", err);
    }
  };

  const handleExportToDrive = async () => {
    if (!googleToken) {
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Por favor, conecte-se com sua conta Google primeiro." });
      }
      return;
    }

    if (isMounted.current) {
      setIsLoading(true);
      setStatusMsg({ type: "info", text: "Preparando exportação para o Google Drive..." });
    }

    try {
      const [members, consultations, exams, vitals, vaccines] = await Promise.all([
        dbService.getMembers(),
        dbService.getConsultations(),
        dbService.getExams(),
        dbService.getVitals(),
        dbService.getVaccines(),
      ]);

      const backup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        members,
        consultations,
        exams,
        vitals,
        vaccines
      };

      const fileContent = JSON.stringify(backup, null, 2);
      
      const q = encodeURIComponent("name = 'prontuario_familiar_backup.json' and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`;
      const searchRes = await fetch(url, { headers: { Authorization: `Bearer ${googleToken}` } });
      let existingFile = null;
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        existingFile = searchData.files?.[0] || null;
      }

      if (isMounted.current) {
        if (existingFile) {
          setStatusMsg({ type: "info", text: "Atualizando arquivo existente no Google Drive..." });
        } else {
          setStatusMsg({ type: "info", text: "Criando novo arquivo de backup no Google Drive..." });
        }
      }

      let res;
      if (existingFile) {
        res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json",
          },
          body: fileContent,
        });
      } else {
        const metadata = {
          name: "prontuario_familiar_backup.json",
          mimeType: "application/json",
        };

        const boundary = "foo_bar_boundary";
        const delimiter = `\r\n--${boundary}\r\n`;
        const close_delim = `\r\n--${boundary}--`;

        const multipartRequestBody =
          delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          delimiter +
          "Content-Type: application/json\r\n\r\n" +
          fileContent +
          close_delim;

        res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Erro HTTP ${res.status}`);
      }

      await fetchBackupFileInfo(googleToken);

      if (isMounted.current) {
        setStatusMsg({
          type: "success",
          text: `Excelente! O seu prontuário clínico foi salvo/sincronizado em seu Google Drive com sucesso.`
        });
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Falha na exportação para o Google Drive: " + (err.message || String(err)) });
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleRestoreFromDrive = async () => {
    if (!googleToken) {
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Por favor, conecte-se com sua conta Google primeiro." });
      }
      return;
    }

    const targetFile = googleBackupFilesList.find(f => f.id === selectedDriveFileId) || googleBackupFile;
    if (!targetFile) {
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Nenhum arquivo de backup selecionado ou encontrado no Google Drive para restaurar." });
      }
      return;
    }

    let confirmed = false;
    try {
      confirmed = window.confirm(
        importMode === "replace"
          ? `ATENÇÃO! Você optou por Limpar & Substituir. Deseja reescrever completamente seus dados locais locais pelos dados do arquivo "${targetFile.name}" do Google Drive?`
          : `Deseja importar e mesclar os dados de "${targetFile.name}" armazenados no Google Drive com seu histórico clínico atual?`
      );
    } catch (e) {
      console.warn("window.confirm is blocked by iframe policies, bypass security check.", e);
      confirmed = true;
    }
    if (!confirmed) return;

    if (isMounted.current) {
      setIsLoading(true);
      setStatusMsg({ type: "info", text: `Baixando "${targetFile.name}" do Google Drive...` });
    }

    try {
      const url = `https://www.googleapis.com/drive/v3/files/${targetFile.id}?alt=media`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (!res.ok) {
        throw new Error(`Erro HTTP ao ler arquivo do Google Drive: ${res.status}`);
      }
      const backup: BackupData = await res.json();

      if (!backup || typeof backup !== "object") {
        throw new Error("Formato de arquivo JSON baixado é inválido.");
      }

      const membersList = backup.members || [];
      const consultationsList = backup.consultations || [];
      const examsList = backup.exams || [];
      const vitalsList = backup.vitals || [];
      const vaccinesList = backup.vaccines || [];

      if (membersList.length === 0 && consultationsList.length === 0 && examsList.length === 0 && vitalsList.length === 0 && vaccinesList.length === 0) {
        throw new Error("O arquivo de backup no Google Drive não contém nenhum registro clínico.");
      }

      if (importMode === "replace") {
        if (isMounted.current) {
          setStatusMsg({ type: "info", text: "Limpando banco de dados local atual do navegador..." });
        }
        await dbService.clearAllData();
      }

      if (isMounted.current) {
        setStatusMsg({ type: "info", text: "Mesclando itens com a base local..." });
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
      } else {
        dbService.setLocalLastUpdate(new Date().toISOString());
      }

      if (isMounted.current) {
        setStatusMsg({
          type: "success",
          text: `Excelente! O arquivo "${targetFile.name}" foi restaurado com sucesso! Foram adicionados/sincronizados ${membersList.length} prontuário(s).`
        });
      }

      onDataImported();
    } catch (err: any) {
      console.error(err);
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: `Falha na importação do Google Drive: ${err.message || String(err)}` });
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleUploadLocalFileToDrive = async (file: File) => {
    if (!googleToken) {
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Por favor, conecte-se com sua conta Google primeiro." });
      }
      return;
    }

    if (isMounted.current) {
      setIsLoading(true);
      setStatusMsg({ type: "info", text: `Enviando arquivo local "${file.name}" para o seu Google Drive...` });
    }

    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(new Error("Falha ao ler o arquivo selecionado."));
        reader.readAsText(file);
      });

      // Simple validation checks to verify backup schema health
      const backup = JSON.parse(text);
      if (!backup || typeof backup !== "object") {
        throw new Error("Formato de arquivo JSON inválido.");
      }

      // Check if file already exists in Drive
      const q = encodeURIComponent(`name = '${file.name}' and trashed = false`);
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`;
      const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${googleToken}` } });
      let existingFile = null;
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        existingFile = searchData.files?.[0] || null;
      }

      if (isMounted.current) {
        if (existingFile) {
          setStatusMsg({ type: "info", text: `Sobrescrevendo arquivo "${file.name}" existente no seu Drive...` });
        } else {
          setStatusMsg({ type: "info", text: `Criando novo arquivo "${file.name}" no seu Google Drive...` });
        }
      }

      let res;
      if (existingFile) {
        res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json",
          },
          body: text,
        });
      } else {
        const metadata = {
          name: file.name,
          mimeType: "application/json",
        };

        const boundary = "foo_bar_boundary";
        const delimiter = `\r\n--${boundary}\r\n`;
        const close_delim = `\r\n--${boundary}--`;

        const multipartRequestBody =
          delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          delimiter +
          "Content-Type: application/json\r\n\r\n" +
          text +
          close_delim;

        res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Erro HTTP ${res.status}`);
      }

      await fetchBackupFileInfo(googleToken);

      if (isMounted.current) {
        setStatusMsg({
          type: "success",
          text: `Sucesso! O arquivo de backup local "${file.name}" foi enviado diretamente para o seu Google Drive!`
        });
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current) {
        setStatusMsg({
          type: "error",
          text: `Falha no envio direto ao Drive: ${err.message || String(err)}`
        });
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  // Handle Export to JSON
  const handleExport = async () => {
    if (isMounted.current) {
      setIsLoading(true);
      setStatusMsg({ type: "info", text: "Preparando exportação de registros..." });
    }

    try {
      // Gather all local IndexedDB data blocks
      const [members, consultations, exams, vitals, vaccines] = await Promise.all([
        dbService.getMembers(),
        dbService.getConsultations(),
        dbService.getExams(),
        dbService.getVitals(),
        dbService.getVaccines(),
      ]);

      const backup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        members,
        consultations,
        exams,
        vitals,
        vaccines
      };

      const jsonString = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `backup_prontuario_familiar_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (isMounted.current) {
        setStatusMsg({
          type: "success",
          text: `Backup gerado com sucesso! Arquivo salvo contendo ${members.length} prontuários de membros e todo seu histórico.`
        });
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Insucesso na exportação. Verifique as permissões de armazenamento do navegador." });
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // Handle File Input Selection and parsing
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear input element value synchronously beforehand so that it never gets mutated post-unmount
    e.target.value = "";

    if (isMounted.current) {
      setIsLoading(true);
      setStatusMsg({ type: "info", text: "Analisando arquivo de backup (.JSON)..." });
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backup: BackupData = JSON.parse(text);

        // Simple validation checks to verify backup schema health
        if (!backup || typeof backup !== "object") {
          throw new Error("Formato de arquivo JSON inválido ou corrompido.");
        }

        const membersList = backup.members || [];
        const consultationsList = backup.consultations || [];
        const examsList = backup.exams || [];
        const vitalsList = backup.vitals || [];
        const vaccinesList = backup.vaccines || [];

        if (membersList.length === 0 && consultationsList.length === 0 && examsList.length === 0 && vitalsList.length === 0 && vaccinesList.length === 0) {
          throw new Error("O arquivo de backup selecionado não contém nenhum registro clínico válido.");
        }

        if (isMounted.current) {
          setSelectedLocalFile(file);
          setParsedBackupData(backup);

          const summaryText = `Arquivo "${file.name}" carregado! Encontramos: ` +
            `${membersList.length} membro(s), ` +
            `${consultationsList.length} consulta(s), ` +
            `${examsList.length} exame(s), ` +
            `${vitalsList.length} sinal(is) vital(is) e ` +
            `${vaccinesList.length} vacina(s). ` +
            `Para concluir, clique no botão "Confirmar e Restaurar Backup" abaixo.`;

          setStatusMsg({
            type: "success",
            text: summaryText
          });
        }
      } catch (err: any) {
        console.error(err);
        if (isMounted.current) {
          setSelectedLocalFile(null);
          setParsedBackupData(null);
          setStatusMsg({
            type: "error",
            text: `Falha na leitura do arquivo: ${err.message || "Certifique-se de selecionar um backup produzido por este aplicativo."}`
          });
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    reader.onerror = () => {
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Ocorreu um erro físico na leitura do arquivo selecionado de backup no seu dispositivo." });
        setIsLoading(false);
      }
    };

    reader.readAsText(file);
  };

  // Perform the actual restoration of state to database
  const handleExecuteLocalRestore = async () => {
    if (!parsedBackupData) {
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Nenhum dado de backup válido pronto para restaurar." });
      }
      return;
    }

    if (isMounted.current) {
      setIsLoading(true);
      setStatusMsg({ type: "info", text: "Processando restauração local..." });
    }

    try {
      const backup = parsedBackupData;
      const membersList = backup.members || [];
      const consultationsList = backup.consultations || [];
      const examsList = backup.exams || [];
      const vitalsList = backup.vitals || [];
      const vaccinesList = backup.vaccines || [];

      // Drop current stores completely if replacing is desired
      if (importMode === "replace") {
        if (isMounted.current) {
          setStatusMsg({ type: "info", text: "Limpando banco de dados local atual do prontuário..." });
        }
        await dbService.clearAllData();
      }

      if (isMounted.current) {
        setStatusMsg({ type: "info", text: "Gravando registros no armazenamento local seguro..." });
      }

      // Save imported lists
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
      } else {
        dbService.setLocalLastUpdate(new Date().toISOString());
      }

      if (isMounted.current) {
        setStatusMsg({
          type: "success",
          text: `Excelente! O seu prontuário clínico foi restaurado com sucesso (${
            importMode === "replace" ? "Limpo e Substituído" : "Mesclado com Sucesso"
          }). Encontramos e inserimos ${membersList.length} prontuário(s) de integrante(s) familiar(es).`
        });

        // Clear selection states
        setSelectedLocalFile(null);
        setParsedBackupData(null);
      }

      // Trigger parent reload
      onDataImported();
    } catch (err: any) {
      console.error("Erro na restauração local:", err);
      if (isMounted.current) {
        setStatusMsg({
          type: "error",
          text: `Falha na restauração de dados: ${err.message || String(err)}`
        });
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl p-5 sm:p-6 text-left animate-in fade-in zoom-in-95 duration-155">
        {/* Header bar */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-3 shrink-0">
          <h3 className="text-base font-extrabold text-gray-900 inline-flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600 animate-pulse" />
            Backup e Sincronização
          </h3>
          <button
            type="button"
            onClick={isLoading ? undefined : onClose}
            className={`p-1 px-1.5 rounded-xl text-xs font-bold transition-colors ${
              isLoading 
                ? "text-gray-200 cursor-not-allowed" 
                : "hover:bg-gray-100 text-gray-400 cursor-pointer"
            }`}
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body content container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 my-2">
          {/* Short context */}
          <p className="text-xs text-gray-500 leading-relaxed text-center">
            Mantenha seus dados e fichas clínicas seguras salvando uma cópia em nuvem ou em arquivo local.
          </p>

        {/* Tab selector */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl mb-4 border border-gray-200/50">
          <button
            type="button"
            onClick={() => setActiveSubTab("drive")}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === "drive"
                ? "bg-white text-blue-700 shadow-3xs"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Cloud className="w-4 h-4" />
            Nuvem (Drive)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("local")}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === "local"
                ? "bg-white text-gray-800 shadow-3xs"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Database className="w-4 h-4" />
            Arquivo Local
          </button>
        </div>

        {/* Restore options: Merge or Replace selection */}
        <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl mb-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-3xs font-black uppercase text-gray-500 tracking-wider">Modo de Restauração</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setImportMode("merge")}
                className={`px-2 py-1 text-3xs font-bold rounded-md transition-all ${
                  importMode === "merge"
                    ? "bg-blue-150 text-blue-800 font-extrabold border border-blue-200/40"
                    : "text-gray-500 hover:text-gray-700 bg-gray-200/60"
                }`}
              >
                📥 Mesclar
              </button>
              <button
                type="button"
                onClick={() => setImportMode("replace")}
                className={`px-2 py-1 text-3xs font-bold rounded-md transition-all ${
                  importMode === "replace"
                    ? "bg-amber-100 text-amber-800 font-extrabold border border-amber-200/30"
                    : "text-gray-500 hover:text-gray-700 bg-gray-200/60"
                }`}
              >
                ⚠️ Substituir
              </button>
            </div>
          </div>
          <p className="text-3xs text-gray-500 leading-relaxed">
            {importMode === "merge" ? (
              <span><strong>Mesclagem segura:</strong> Importados adicionados sem apagar histórico atual.</span>
            ) : (
              <span className="text-amber-700 font-medium"><strong>Substituição crítica:</strong> Limpa todo o histórico clínico local do navegador para carregar o backup.</span>
            )}
          </p>
        </div>

        {/* Content Tabs / Actions Grid */}
        <div className="space-y-4">
          {activeSubTab === "drive" ? (
            /* TAB: GOOGLE DRIVE BACKUP SYNC */
            <div className="space-y-3.5">
              {!googleUser ? (
                <div className="bg-blue-50/10 border border-blue-100/70 p-4.5 rounded-2xl text-center space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Conecte-se com sua conta Google de forma 100% direta e segura para salvar o histórico no seu Google Drive.
                  </p>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleGoogleSignIn}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-3xs cursor-pointer transition-transform"
                  >
                    <Cloud className="w-4 h-4 animate-bounce" />
                    Conectar Google Drive
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Google Connected User Card Info */}
                  <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {googleUser.photoURL ? (
                        <img
                          src={googleUser.photoURL}
                          alt={googleUser.displayName || "Google"}
                          className="w-8 h-8 rounded-full border border-gray-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center">
                          {googleUser.displayName?.substring(0, 2) || "G"}
                        </div>
                      )}
                      <div className="truncate">
                        <h5 className="text-xs font-bold text-gray-900 leading-tight truncate">{googleUser.displayName}</h5>
                        <p className="text-3xs text-gray-500 leading-none truncate">{googleUser.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleSignOut}
                      title="Desconectar do Google"
                      className="p-2 bg-gray-100 hover:bg-rose-50 text-gray-500 hover:text-rose-600 rounded-xl transition-all cursor-pointer border border-gray-200/50"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Cloud backups found on Google Drive list selection */}
                  {googleBackupFilesList.length > 0 ? (
                    <div className="bg-blue-50/25 border border-blue-100 p-3.5 rounded-2xl space-y-2">
                      <span className="text-3xs font-extrabold tracking-wide uppercase text-blue-700 block">💾 Selecione o Backup no seu Drive:</span>
                      <select
                        value={selectedDriveFileId}
                        onChange={(e) => setSelectedDriveFileId(e.target.value)}
                        className="w-full text-xs font-bold p-2 bg-white border border-gray-200 rounded-xl outline-hidden focus:border-blue-500 cursor-pointer text-gray-800"
                      >
                        {googleBackupFilesList.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.name} ({(file.size ? `${Math.round(parseInt(file.size) / 1024)} KB` : "N/D")})
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const sel = googleBackupFilesList.find(f => f.id === selectedDriveFileId);
                        if (sel) {
                          return (
                            <p className="text-[10px] text-blue-800 font-semibold leading-normal">
                              Modificado em: {new Date(sel.modifiedTime || "").toLocaleString("pt-BR")}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <div className="bg-amber-50/40 border border-amber-100 p-3.5 rounded-2xl">
                      <span className="text-3xs font-extrabold tracking-wide uppercase text-amber-700 block text-center">⚠️ Sem Backup no Drive</span>
                      <p className="text-3xs text-gray-500 leading-normal text-center mt-1">
                        Não encontramos arquivos de backup criados no seu Google Drive. Salve um primeiro clicando abaixo.
                      </p>
                    </div>
                  )}

                  {/* Backup actions cloud grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleExportToDrive}
                      className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Salvar Prontuário
                    </button>
                    <button
                      type="button"
                      disabled={isLoading || googleBackupFilesList.length === 0 || !selectedDriveFileId}
                      onClick={handleRestoreFromDrive}
                      className="py-2.5 px-3 bg-white border border-gray-200 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-300 text-gray-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-500" />
                      Baixar & Restaurar
                    </button>
                  </div>

                  {/* Direct upload local file to Google Drive */}
                  <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl mt-1 space-y-2">
                    <div>
                      <h4 className="text-[11px] font-black text-gray-800 uppercase tracking-wide flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                        Fazer Upload Direto para o Drive
                      </h4>
                      <p className="text-3xs text-gray-500 font-bold mt-1 leading-normal">
                        Selecione um backup (.JSON) local para enviar diretamente para a raiz segura de sua conta Google Drive.
                      </p>
                    </div>
                    <label className="block w-full">
                      <span className="sr-only">Escolher arquivo local para o Drive</span>
                      <div className="w-full flex items-center justify-center gap-2 py-3 px-3 border border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/20 rounded-xl text-3xs font-bold text-slate-700 hover:text-blue-600 transition-all cursor-pointer text-center">
                        <Upload className="w-3.5 h-3.5 text-gray-400" />
                        <span>Selecionar & Enviar direto ao Google Drive</span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleUploadLocalFileToDrive(file);
                            }
                            e.target.value = "";
                          }}
                          className="hidden"
                          disabled={isLoading}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB: LOCAL FILE JSON BACKUP */
            <div className="space-y-4">
              {/* ACTION 1: EXPORT */}
              <div className="bg-blue-50/20 border border-blue-100 p-4.5 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-xs font-black text-blue-900 uppercase tracking-wide">Exportar Backup (.JSON)</h4>
                  <p className="text-3xs text-blue-700 font-bold mt-1">Baixe agora uma cópia consolidada de seu histórico clínico e imunológico.</p>
                </div>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleExport}
                  className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-3xs cursor-pointer transition-colors active:scale-98 select-none shrink-0"
                >
                  {isLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Exportar
                </button>
              </div>

              {/* ACTION 2: IMPORT WITH CHOICE */}
              <div className="bg-slate-50 border border-slate-200/60 p-4.5 rounded-2xl space-y-3" id="local-import-card">
                <div>
                  <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide">Importar Backup (.JSON)</h4>
                  <p className="text-3xs text-gray-500 font-bold mt-1">Carregue um arquivo salvaguardado para restaurar em seu dispositivo.</p>
                </div>

                {!selectedLocalFile ? (
                  /* Actual Upload File picker styled cleanly without nesting file input inside label */
                  <div
                    onClick={() => {
                      if (!isLoading) {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="w-full flex flex-col items-center justify-center gap-2 py-5 px-4 border border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-xl text-xs font-bold text-slate-700 hover:text-blue-600 transition-all cursor-pointer text-center"
                  >
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span>Escolher Arquivo de Backup (.json)</span>
                    <span className="text-[10px] font-medium text-gray-400">Clique para navegar ou arraste o arquivo aqui</span>
                  </div>
                ) : (
                  /* Show File Preview & Active Action Buttons */
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2 text-left">
                      <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                        <Database className="w-4 h-4 text-blue-600 animate-pulse" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold text-blue-900 truncate" title={selectedLocalFile.name}>
                            {selectedLocalFile.name}
                          </p>
                          <p className="text-[10px] text-blue-700 font-semibold leading-none mt-0.5">
                            Tamanho: {Math.round(selectedLocalFile.size / 1024 * 10) / 10} KB
                          </p>
                        </div>
                      </div>

                      {/* Content summary tags inside backup file */}
                      <div className="grid grid-cols-2 gap-2 text-black pt-1">
                        <div className="bg-white/85 border border-slate-100 p-1.5 rounded-lg text-center shadow-3xs">
                          <span className="text-[10px] font-black block text-gray-500 uppercase tracking-tight">Integrantes</span>
                          <span className="text-xs font-black text-gray-900">{parsedBackupData?.members?.length || 0}</span>
                        </div>
                        <div className="bg-white/85 border border-slate-100 p-1.5 rounded-lg text-center shadow-3xs">
                          <span className="text-[10px] font-black block text-gray-500 uppercase tracking-tight">Consultas</span>
                          <span className="text-xs font-black text-gray-900">{parsedBackupData?.consultations?.length || 0}</span>
                        </div>
                        <div className="bg-white/85 border border-slate-100 p-1.5 rounded-lg text-center shadow-3xs">
                          <span className="text-[10px] font-black block text-gray-500 uppercase tracking-tight">Exames</span>
                          <span className="text-xs font-black text-gray-900">{parsedBackupData?.exams?.length || 0}</span>
                        </div>
                        <div className="bg-white/85 border border-slate-100 p-1.5 rounded-lg text-center shadow-3xs">
                          <span className="text-[10px] font-black block text-gray-500 uppercase tracking-tight">Vacinas</span>
                          <span className="text-xs font-black text-gray-900">{parsedBackupData?.vaccines?.length || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full pt-1">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={handleExecuteLocalRestore}
                        className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-750 disabled:bg-slate-300 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-3xs cursor-pointer transition-colors active:scale-98"
                      >
                        <Check className="w-4 h-4" />
                        Confirmar e Restaurar
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          setSelectedLocalFile(null);
                          setParsedBackupData(null);
                          setStatusMsg({ type: null, text: "" });
                        }}
                        className="py-2.5 px-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Message feedback block */}
        {statusMsg.type && (
          <div className={`mt-4 p-3.5 rounded-2xl flex items-start gap-2.5 border ${
            statusMsg.type === "success" 
              ? "bg-emerald-50 border-emerald-150 text-emerald-800" 
              : statusMsg.type === "error"
              ? "bg-rose-50 border-rose-150 text-rose-800" 
              : "bg-blue-50 border-blue-150 text-blue-800"
          }`}>
            {statusMsg.type === "success" ? (
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : statusMsg.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 animate-spin" />
            )}
            <div className="flex-1">
              <span className="text-2xs font-extrabold uppercase block tracking-wider">
                {statusMsg.type === "success" ? "Operação Concluída" : statusMsg.type === "error" ? "Falha na Execução" : "Processando..."}
              </span>
              <p className="text-3xs font-semibold leading-relaxed mt-0.5">{statusMsg.text}</p>
            </div>
          </div>
        )}

        </div>

        {/* Close Drawer Button */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={isLoading ? undefined : onClose}
            className={`w-full py-2.5 font-bold rounded-xl text-xs text-center select-none transition-colors ${
              isLoading
                ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
            }`}
            disabled={isLoading}
          >
            Fechar Janela
          </button>
        </div>

        {/* Hidden but always stably mounted input element for file uploads */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFileChange}
          className="hidden"
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
