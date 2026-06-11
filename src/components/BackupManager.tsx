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
  const [showDriveRestoreConfirm, setShowDriveRestoreConfirm] = useState(false);

  const isMounted = React.useRef(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedDriveFile = googleBackupFilesList.find(f => f.id === selectedDriveFileId) || googleBackupFile;

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
    console.log("[Google Drive Backup] Buscando informações de arquivos de backup salvos no Drive...");
    try {
      const q = encodeURIComponent("(name contains '.json' or mimeType = 'application/json') and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=30`;
      console.log(`[Google Drive Backup] Chamando API Google Drive: GET ${url}`);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`[Google Drive Backup] Resposta recebida. Código de Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const files = data.files || [];
        console.log(`[Google Drive Backup] Encontrados ${files.length} arquivos no Google Drive.`);
        if (isMounted.current) {
          setGoogleBackupFilesList(files);
          if (files.length > 0) {
            console.log(`[Google Drive Backup] Primeiro backup selecionado automaticamente: ID="${files[0].id}", Nome="${files[0].name}"`);
            setGoogleBackupFile(files[0]);
            setSelectedDriveFileId(files[0].id);
          } else {
            console.log("[Google Drive Backup] Nenhum arquivo JSON de backup encontrado no Google Drive.");
            setGoogleBackupFile(null);
            setSelectedDriveFileId("");
          }
        }
      } else {
        const errText = await res.text().catch(() => "N/A");
        console.error(`[Google Drive Backup] Erro HTTP ao buscar backups de arquivos. Status: ${res.status}`, errText);
        if (res.status === 401) {
          console.warn("[Google Drive Backup] Token de acesso do Google inválido ou expirado (401). Desconectando sessão...");
          handleGoogleSignOut();
        }
      }
    } catch (err) {
      console.error("[Google Drive Backup] Erro grave/exceção física ao tentar buscar arquivos no Drive:", err);
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
    console.log("[Google Drive Backup] Iniciando exportação de registros locais para o Google Drive...");
    if (!googleToken) {
      console.error("[Google Drive Backup] Cancelado: Token do Google não está disponível.");
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
      console.log("[Google Drive Backup] Recuperando todos os dados do IndexedDB local...");
      const [members, consultations, exams, vitals, vaccines] = await Promise.all([
        dbService.getMembers(),
        dbService.getConsultations(),
        dbService.getExams(),
        dbService.getVitals(),
        dbService.getVaccines(),
      ]);
      console.log(`[Google Drive Backup] Dados locais obtidos: ${members.length} membros, ${consultations.length} consultas, ${exams.length} exames, ${vitals.length} sinais vitais, ${vaccines.length} vacinas.`);

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
      console.log(`[Google Drive Backup] JSON de backup gerado com sucesso. Tamanho total (caracteres): ${fileContent.length}`);
      
      const q = encodeURIComponent("name = 'prontuario_familiar_backup.json' and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`;
      console.log(`[Google Drive Backup] Buscando arquivo existente de nome 'prontuario_familiar_backup.json' no Drive: GET ${url}`);
      const searchRes = await fetch(url, { headers: { Authorization: `Bearer ${googleToken}` } });
      console.log(`[Google Drive Backup] Resposta de busca recebida. Status: ${searchRes.status}`);

      if (!searchRes.ok) {
        const errText = await searchRes.text().catch(() => "N/A");
        console.error(`[Google Drive Backup] Falha ao verificar existência de arquivo anterior no Drive. Status: ${searchRes.status}`, errText);
        if (searchRes.status === 401) {
          handleGoogleSignOut();
          throw new Error("Token expirado ou inválido. Por favor, conecte-se novamente.");
        }
        throw new Error(`Erro de resposta HTTP ${searchRes.status} do Google Drive.`);
      }

      const searchData = await searchRes.json();
      const existingFile = searchData.files?.[0] || null;
      if (existingFile) {
        console.log(`[Google Drive Backup] Arquivo existente encontrado! ID="${existingFile.id}", Modificado em: ${existingFile.modifiedTime}`);
      } else {
        console.log("[Google Drive Backup] Nenhum arquivo correspondente existente no Drive. Um novo arquivo será criado.");
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
        const fileId = existingFile.id;
        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
        console.log(`[Google Drive Backup] Realizando PATCH de dados no arquivo existente. URL: PATCH ${uploadUrl}`);
        res = await fetch(uploadUrl, {
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
        // Fixed: Ensure standard multipart format without leading double-newline before first delimiter
        const multipartRequestBody =
          `--${boundary}\r\n` +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          `\r\n--${boundary}\r\n` +
          "Content-Type: application/json\r\n\r\n" +
          fileContent +
          `\r\n--${boundary}--`;

        const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
        console.log(`[Google Drive Backup] Criando novo arquivo no Drive via upload multipart. URL: POST ${uploadUrl}`);
        res = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        });
      }

      console.log(`[Google Drive Backup] Upload finalizado. Status HTTP de resposta: ${res.status}`);

      if (!res.ok) {
        const errText = await res.text().catch(() => "{}");
        let parsedErr: any = {};
        try { parsedErr = JSON.parse(errText); } catch(e){}
        console.error(`[Google Drive Backup] Erro HTTP no envio do arquivo. Status: ${res.status}`, errText);
        throw new Error(parsedErr.error?.message || `Erro HTTP ${res.status}: ${errText}`);
      }

      console.log("[Google Drive Backup] Upload do arquivo realizado com completo sucesso! Atualizando listagem de backups...");
      await fetchBackupFileInfo(googleToken);

      if (isMounted.current) {
        setStatusMsg({
          type: "success",
          text: `Excelente! O seu prontuário clínico foi salvo/sincronizado em seu Google Drive com sucesso.`
        });
      }
    } catch (err: any) {
      console.error("[Google Drive Backup] Falha de exceção no método handleExportToDrive:", err);
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Falha na exportação para o Google Drive: " + (err.message || String(err)) });
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleRestoreFromDrive = () => {
    console.log("[Google Drive Backup] Solicitando confirmação de download e restauração...");
    if (!googleToken) {
      console.error("[Google Drive Backup] Cancelado: Token do Google indisponível.");
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Por favor, conecte-se com sua conta Google primeiro." });
      }
      return;
    }

    const targetFile = googleBackupFilesList.find(f => f.id === selectedDriveFileId) || googleBackupFile;
    if (!targetFile) {
      console.warn("[Google Drive Backup] Cancelado: Nenhum arquivo de backup foi selecionado para restaurar.");
      if (isMounted.current) {
        setStatusMsg({ type: "error", text: "Nenhum arquivo de backup selecionado ou encontrado no Google Drive para restaurar." });
      }
      return;
    }

    setShowDriveRestoreConfirm(true);
  };

  const executeRestoreFromDrive = async () => {
    setShowDriveRestoreConfirm(false);
    
    if (!googleToken) return;

    const targetFile = googleBackupFilesList.find(f => f.id === selectedDriveFileId) || googleBackupFile;
    if (!targetFile) return;

    console.log(`[Google Drive Backup] Executando restauração do arquivo: ID="${targetFile.id}", Nome="${targetFile.name}"`);

    if (isMounted.current) {
      setIsLoading(true);
      setStatusMsg({ type: "info", text: `Baixando "${targetFile.name}" do Google Drive...` });
    }

    try {
      const url = `https://www.googleapis.com/drive/v3/files/${targetFile.id}?alt=media`;
      console.log(`[Google Drive Backup] Baixando conteúdo brutas do arquivo: GET ${url}`);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      console.log(`[Google Drive Backup] Resposta do download recebida. Status HTTP: ${res.status}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => "N/A");
        console.error(`[Google Drive Backup] Erro ao obter conteúdo do arquivo de backup no Drive. Status: ${res.status}`, errText);
        throw new Error(`Erro HTTP ao ler arquivo do Google Drive: ${res.status} (${errText})`);
      }
      
      const backup: BackupData = await res.json();
      console.log("[Google Drive Backup] Sucesso no download e parsing do JSON do backup.");

      if (!backup || typeof backup !== "object") {
        console.error("[Google Drive Backup] Validação falhou: Conteúdo de backup não é um objeto JSON válido.");
        throw new Error("Formato de arquivo JSON baixado é inválido.");
      }

      const membersList = backup.members || [];
      const consultationsList = backup.consultations || [];
      const examsList = backup.exams || [];
      const vitalsList = backup.vitals || [];
      const vaccinesList = backup.vaccines || [];

      console.log(`[Google Drive Backup] Estrutura extraída com sucesso: ` +
                  `${membersList.length} membros, ${consultationsList.length} consultas, ` +
                  `${examsList.length} exames, ${vitalsList.length} sinais vitais, ` +
                  `${vaccinesList.length} vacinas.`);

      if (membersList.length === 0 && consultationsList.length === 0 && examsList.length === 0 && vitalsList.length === 0 && vaccinesList.length === 0) {
        throw new Error("O arquivo de backup no Google Drive não contém nenhum registro clínico.");
      }

      if (importMode === "replace") {
        console.log("[Google Drive Backup] Modo de importação: Limpar e Substituir ativo. Removendo todos os dados locais antigos do IndexedDB...");
        if (isMounted.current) {
          setStatusMsg({ type: "info", text: "Limpando banco de dados local atual do navegador..." });
        }
        await dbService.clearAllData();
        console.log("[Google Drive Backup] IndexedDB local limpo com êxito.");
      } else {
        console.log("[Google Drive Backup] Modo de importação: Mesclagem activa.");
      }

      if (isMounted.current) {
        setStatusMsg({ type: "info", text: "Mesclando itens com a base local..." });
      }

      console.log("[Google Drive Backup] Escrevendo registros no IndexedDB...");
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
      console.log("[Google Drive Backup] Todos os registros gravados com sucesso no IndexedDB local.");

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

      console.log("[Google Drive Backup] Atualizando estado visual global...");
      onDataImported();
    } catch (err: any) {
      console.error("[Google Drive Backup] Exceção durante handleRestoreFromDrive:", err);
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
    console.log(`[Google Drive Backup] Iniciando envio do arquivo local "${file.name}" de tamanho ${file.size} bytes para o Google Drive.`);
    if (!googleToken) {
      console.error("[Google Drive Backup] Erro: Token do Google inexistente.");
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
      console.log(`[Google Drive Backup] Lendo conteúdo do arquivo local "${file.name}" como texto...`);
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(new Error("Falha ao ler o arquivo selecionado."));
        reader.readAsText(file);
      });

      console.log("[Google Drive Backup] Texto do arquivo lido com sucesso. Efetuando validação de parser JSON...");
      // Simple validation checks to verify backup schema health
      const backup = JSON.parse(text);
      if (!backup || typeof backup !== "object") {
        throw new Error("Formato de arquivo JSON inválido.");
      }
      console.log("[Google Drive Backup] JSON é válido. Verificando se já existe um arquivo com esse mesmo nome no Drive...");

      // Check if file already exists in Drive
      const q = encodeURIComponent(`name = '${file.name}' and trashed = false`);
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`;
      console.log(`[Google Drive Backup] GET ${searchUrl}`);
      const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${googleToken}` } });
      console.log(`[Google Drive Backup] Resposta da busca recebida. Status: ${searchRes.status}`);

      if (!searchRes.ok) {
        const errText = await searchRes.text().catch(() => "N/A");
        console.error(`[Google Drive Backup] Erro de busca do arquivo no Drive. Status: ${searchRes.status}`, errText);
        if (searchRes.status === 401) {
          handleGoogleSignOut();
          throw new Error("Sessão expirada. Reconecte-se ao Google Drive.");
        }
        throw new Error(`Erro de resposta HTTP ${searchRes.status} ao consultar arquivo existente.`);
      }

      const searchData = await searchRes.json();
      const existingFile = searchData.files?.[0] || null;
      if (existingFile) {
        console.log(`[Google Drive Backup] Arquivo idêntico encontrado: ID="${existingFile.id}"`);
      } else {
        console.log("[Google Drive Backup] Nenhum arquivo com esse nome encontrado. Criando novo arquivo...");
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
        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
        console.log(`[Google Drive Backup] Enviando PATCH para ${uploadUrl}`);
        res = await fetch(uploadUrl, {
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
        // Fixed: Ensure standard multipart format without leading double-newline before first delimiter
        const multipartRequestBody =
          `--${boundary}\r\n` +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          `\r\n--${boundary}\r\n` +
          "Content-Type: application/json\r\n\r\n" +
          text +
          `\r\n--${boundary}--`;

        const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
        console.log(`[Google Drive Backup] Enviando POST multipart completo para ${uploadUrl}`);
        res = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        });
      }

      console.log(`[Google Drive Backup] Resposta do envio. Status: ${res.status}`);

      if (!res.ok) {
        const errText = await res.text().catch(() => "N/A");
        console.error(`[Google Drive Backup] Falha no upload para o Drive. Status: ${res.status}`, errText);
        throw new Error(`Erro HTTP ${res.status}: ${errText}`);
      }

      console.log("[Google Drive Backup] Envio realizado com sucesso. Atualizando listagem de backups no Drive...");
      await fetchBackupFileInfo(googleToken);

      if (isMounted.current) {
        setStatusMsg({
          type: "success",
          text: `Sucesso! O arquivo de backup local "${file.name}" foi enviado diretamente para o seu Google Drive!`
        });
      }
    } catch (err: any) {
      console.error("[Google Drive Backup] Exceção durante handleUploadLocalFileToDrive:", err);
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
      <div className="relative bg-white rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl p-5 sm:p-6 text-left animate-in fade-in zoom-in-95 duration-155">
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
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-3xs cursor-pointer transition-transform active:scale-98"
                  >
                    <Cloud className="w-4 h-4 animate-bounce" />
                    Conectar Google Drive
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Google Connected User Card Info */}
                  <div className="bg-slate-50 border border-slate-200/60 p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {googleUser.photoURL ? (
                        <img
                          src={googleUser.photoURL}
                          alt={googleUser.displayName || "Google"}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-gray-200 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white font-extrabold text-[10px] sm:text-xs flex items-center justify-center shrink-0">
                          {googleUser.displayName?.substring(0, 2) || "G"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h5 className="text-[11px] sm:text-xs font-bold text-gray-900 leading-tight truncate">{googleUser.displayName}</h5>
                        <p className="text-[9px] sm:text-3xs text-gray-500 leading-none truncate">{googleUser.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleSignOut}
                      title="Desconectar do Google"
                      className="p-1.5 sm:p-2 bg-gray-100 hover:bg-rose-50 text-gray-500 hover:text-rose-600 rounded-xl transition-all cursor-pointer border border-gray-200/50 shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* SEÇÃO 1: GUARDAR NA NUVEM / FAZER UPLOAD */}
                  <div className="bg-blue-50/15 border border-blue-105 p-3 sm:p-3.5 rounded-2xl space-y-2.5">
                    <div>
                      <h4 className="text-[11px] sm:text-xs font-black text-blue-900 uppercase tracking-tight flex items-center gap-1.5">
                        <Cloud className="w-4 h-4 text-blue-600 animate-pulse" />
                        Guardar na Nuvem (Fazer Backup)
                      </h4>
                      <p className="text-[9px] sm:text-3xs text-slate-500 font-semibold leading-normal mt-0.5">
                        Crie uma cópia de segurança enviando os registros atuais ou fazendo upload de um arquivo para seu Drive.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                      {/* Enviar Prontuário Atual */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={handleExportToDrive}
                        className="py-2 px-2.5 sm:py-2.5 sm:px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-extrabold text-[10px] sm:text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer select-none active:scale-98 disabled:-pointer-events-none"
                      >
                        <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Salvar Prontuário Atual
                      </button>

                      {/* Enviar Arquivo Local */}
                      <label className="block">
                        <div className="py-2 px-2.5 sm:py-2.5 sm:px-3 bg-white border border-gray-200 hover:border-blue-305 hover:bg-blue-50/10 text-slate-700 font-extrabold text-[10px] sm:text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer text-center select-none active:scale-98">
                          <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-505 shrink-0" />
                          <span>Fazer Upload de arquivo</span>
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

                  {/* SEÇÃO 2: RESTAURAR DA NUVEM / BAIXAR */}
                  <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl space-y-3">
                    <div>
                      <h4 className="text-xs font-black text-gray-800 uppercase tracking-tight flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-emerald-600" />
                        Restaurar da Nuvem (Baixar Backup)
                      </h4>
                      <p className="text-3xs text-slate-400 font-semibold leading-normal mt-1">
                        Selecione um arquivo de backup armazenado na raiz ou pasta segura do seu Google Drive.
                      </p>
                    </div>

                    {googleBackupFilesList.length > 0 ? (
                      <div className="space-y-2.5">
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
                        
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                          {(() => {
                            const sel = googleBackupFilesList.find(f => f.id === selectedDriveFileId);
                            if (sel) {
                              return (
                                <p className="text-[10px] text-blue-800 font-semibold leading-normal">
                                  Modificado: {new Date(sel.modifiedTime || "").toLocaleString("pt-BR")}
                                </p>
                              );
                            }
                            return null;
                          })()}

                          <button
                            type="button"
                            disabled={isLoading || !selectedDriveFileId}
                            onClick={handleRestoreFromDrive}
                            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-750 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Baixar & Restaurar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50/45 border border-amber-100/70 p-3 rounded-xl text-center">
                        <span className="text-xs font-extrabold text-amber-700 block">⚠️ Nenhum backup encontrado no Drive</span>
                        <p className="text-[11px] text-gray-500 mt-1 leading-normal">
                          Gere e salve um backup no Drive primeiro utilizando o botão <strong>"Salvar Prontuário Atual"</strong> para que possa restaurá-lo depois.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB: LOCAL FILE JSON BACKUP */
            <div className="space-y-4">
              {/* ACTION 1: EXPORT */}
              <div className="bg-blue-50/20 border border-blue-100 p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                <div className="flex-1">
                  <h4 className="text-xs font-black text-blue-900 uppercase tracking-wide">Exportar Backup (.JSON)</h4>
                  <p className="text-3xs text-blue-700 font-bold mt-1">Baixe agora uma cópia consolidada de seu histórico clínico e imunológico.</p>
                </div>
                <button
                  type="button"
                  disabled={isLoading || false}
                  onClick={handleExport}
                  className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-3xs cursor-pointer transition-colors active:scale-98 select-none self-stretch sm:self-auto shrink-0"
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

        {/* custom confirmation dialog for Google Drive restore */}
        {showDriveRestoreConfirm && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-50 flex flex-col justify-center p-6 text-center animate-in fade-in duration-200 shadow-xl rounded-3xl">
            <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4 border border-amber-200">
              <AlertCircle className="w-6 h-6 text-amber-600 animate-bounce" />
            </div>
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Confirmar Restauração</h4>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              Você escolheu restaurar o arquivo <strong className="text-slate-800 break-all">"{selectedDriveFile?.name}"</strong> do Google Drive.
            </p>
            
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-left max-w-xs mx-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Detalhes da Operação:</span>
              <span className="text-xs font-bold text-slate-700 block mt-1">
                Modo: {importMode === "replace" ? "⚠️ Limpar & Substituir" : "📥 Mesclar Registros"}
              </span>
              <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                {importMode === "replace"
                  ? "Isso apagará permanentemente todos os dados de prontuários atuais neste navegador antes de restaurar."
                  : "Os registros salvos no arquivo serão somados ao seu histórico atual."}
              </p>
            </div>

            <div className="flex gap-3 w-full max-w-xs mx-auto mt-6">
              <button
                type="button"
                onClick={executeRestoreFromDrive}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-750 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setShowDriveRestoreConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-100 border border-gray-200 text-slate-700 font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
