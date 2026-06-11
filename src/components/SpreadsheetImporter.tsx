import React, { useState, useRef, useEffect } from "react";
import { 
  FileSpreadsheet, Download, Upload, Check, AlertTriangle, 
  X, HelpCircle, Save, Table, Plus, RefreshCw, ClipboardList,
  Cloud, LogOut, ExternalLink, Globe, Lock, Share2
} from "lucide-react";
import { FamilyMember } from "../types";
import { User } from "firebase/auth";

interface SpreadsheetImporterProps {
  member: FamilyMember;
  onDataImported: () => void;
  isOpen: boolean;
  onClose: () => void;
}

type DataType = "vitals" | "consultations" | "exams" | "vaccines";

// Mapping models for automatic template generation and mapping
const TEMPLATES = {
  vitals: {
    title: "Sinais Vitais",
    headers: ["Data", "Peso_kg", "Altura_cm", "Pressao_Sistolica", "Pressao_Diastolica", "Glicemia_mg_dL", "Batimentos_bpm"],
    sample: ["10/06/2026", "75.4", "172.5", "120", "80", "95", "72"],
    description: "Ideal para importar histórico de peso, altura, controle glicêmico e pressão arterial.",
  },
  consultations: {
    title: "Consultas & Procedimentos",
    headers: ["Data", "Especialidade", "Medico", "Local_Hospital", "Motivo", "Prescricao_Receita", "Anotacoes_Gerais"],
    sample: ["10/06/2026", "Pediatria", "Dra. Eliana Silva", "Clinica Infantil Unimed", "Consulta de Rotina de 1 Ano", "Manter vitamina D daily", "Crescimento excelente dentro do percentil 80"],
    description: "Importe histórico de consultas, diagnósticos ou pós-operatórios.",
  },
  exams: {
    title: "Exames Laboratoriais/Imagem",
    headers: ["Data", "Nome_do_Exame", "Categoria_Especialidade", "Laboratorio_Local", "Medico_Solicitante", "Observacoes_Resultados"],
    sample: ["08/06/2026", "Hemograma Completo", "Hematologia", "Laboratório Hermes Pardini", "Dr. Nelson Araujo", "Sem alterações nos leucócitos, plaquetas saudáveis"],
    description: "Importe a lista de exames realizados e seus resultados.",
  },
  vaccines: {
    title: "Histórico de Vacinação",
    headers: ["Nome_da_Vacina", "Dose", "Data_Aplicacao", "Lote_Vacina"],
    sample: ["Tríplice Viral (SCR)", "1ª Dose", "15/05/2026", "TR77281A"],
    description: "Importe vacinas administradas para manter a caderneta sempre em dia.",
  }
};

export default function SpreadsheetImporter({ member, onDataImported, isOpen, onClose }: SpreadsheetImporterProps) {
  const [selectedType, setSelectedType] = useState<DataType>("vitals");
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info" | null; text: string }>({ type: null, text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Sheets state integration
  const [importSource, setImportSource] = useState<"csv" | "sheets">("csv");
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>("");
  const [gSheetsList, setGSheetsList] = useState<string[]>([]);
  const [gSelectedSheet, setGSelectedSheet] = useState<string>("");
  const [exportedSpreadsheetUrl, setExportedSpreadsheetUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    let unsubscribe: (() => void) | undefined;
    
    import("../lib/auth")
      .then(({ initAuth }) => {
        unsubscribe = initAuth(
          (user, token) => {
            setGoogleUser(user);
            setGoogleToken(token);
          },
          () => {
            setGoogleUser(null);
            setGoogleToken(null);
          }
        );
      })
      .catch(err => console.error("Erro ao carregar módulo de auth:", err));

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Start Google sign-in popup flow
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setStatusMsg({ type: "info", text: "Solicitando autenticação com servidores do Google..." });
    try {
      const { googleSignIn } = await import("../lib/auth");
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setStatusMsg({ type: "success", text: "Conectado ao Google com sucesso! Integração do Planilhas ativa." });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: "error", text: "Falha na conexão com Google: " + (err.message || String(err)) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      const { logout } = await import("../lib/auth");
      await logout();
      setGoogleUser(null);
      setGoogleToken(null);
      setGSheetsList([]);
      setGSelectedSheet("");
      setExportedSpreadsheetUrl(null);
      setStatusMsg({ type: "info", text: "Logoff do Google realizado com sucesso." });
    } catch (err) {
      console.error("Erro no signout:", err);
    }
  };

  const extractSpreadsheetId = (url: string): string => {
    if (!url) return "";
    if (!url.includes("/")) return url.trim();
    const matches = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : url.trim();
  };

  const handleLoadGSheetsTabs = async () => {
    if (!googleToken) {
      setStatusMsg({ type: "error", text: "Por favor, conecte-se com sua conta Google primeiro." });
      return;
    }
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      setStatusMsg({ type: "error", text: "Por favor, insira um link ou ID de Planilha Google válido." });
      return;
    }

    setIsLoading(true);
    setStatusMsg({ type: "info", text: "Acessando metadados da planilha no Google Drive..." });
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Erro HTTP ${res.status}`);
      }
      const data = await res.json();
      const sheets = data.sheets || [];
      const sheetNames = sheets.map((s: any) => s.properties?.title).filter(Boolean);
      
      if (sheetNames.length === 0) {
        throw new Error("Nenhuma aba de dados foi localizada nesta planilha Google.");
      }
      
      setGSheetsList(sheetNames);
      setGSelectedSheet(sheetNames[0] || "");
      setStatusMsg({ type: "success", text: `Sucesso! Encontramos ${sheetNames.length} aba(s). Escolha a de interesse.` });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: "error", text: `Não foi possível carregar as abas: ${err.message || String(err)}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadGSheetValues = async () => {
    if (!googleToken || !gSelectedSheet) return;
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) return;

    setIsLoading(true);
    setStatusMsg({ type: "info", text: `Lendo registros da aba "${gSelectedSheet}"...` });
    try {
      const range = `${gSelectedSheet}!A1:Z500`;
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Erro HTTP ${res.status}`);
      }
      const data = await res.json();
      const values: string[][] = data.values || [];
      if (values.length === 0) {
        throw new Error(`A aba "${gSelectedSheet}" está vazia ou não contém cabeçalhos.`);
      }

      const fileHeaders = values[0].map(h => h.trim());
      setHeaders(fileHeaders);

      const rows: any[] = [];
      for (let i = 1; i < values.length; i++) {
        const fileRow = values[i];
        if (!fileRow || fileRow.length === 0) continue;

        const rowData: Record<string, string> = {};
        fileHeaders.forEach((h, index) => {
          const val = fileRow[index] || "";
          rowData[h] = String(val).trim();
        });

        try {
          if (selectedType === "vitals") {
            const mappedRow = {
              date: parseStandardDate(rowData["Data"] || rowData[fileHeaders[0]]),
              weight: rowData["Peso_kg"] ? parseFloat(rowData["Peso_kg"].replace(",", ".")) : undefined,
              height: rowData["Altura_cm"] ? parseFloat(rowData["Altura_cm"].replace(",", ".")) : undefined,
              systolicBP: rowData["Pressao_Sistolica"] ? parseInt(rowData["Pressao_Sistolica"]) : undefined,
              diastolicBP: rowData["Pressao_Diastolica"] ? parseInt(rowData["Pressao_Diastolica"]) : undefined,
              bloodGlucose: rowData["Glicemia_mg_dL"] ? parseInt(rowData["Glicemia_mg_dL"]) : undefined,
              heartRate: rowData["Batimentos_bpm"] ? parseInt(rowData["Batimentos_bpm"]) : undefined,
            };
            rows.push(mappedRow);
          } else if (selectedType === "consultations") {
            const mappedRow = {
              date: parseStandardDate(rowData["Data"] || rowData[fileHeaders[0]]),
              specialty: rowData["Especialidade"] || "Consulta Geral",
              doctor: rowData["Medico"] || "",
              facility: rowData["Local_Hospital"] || "",
              reason: rowData["Motivo"] || "",
              prescription: rowData["Prescricao_Receita"] || "",
              notes: rowData["Anotacoes_Gerais"] || "",
            };
            rows.push(mappedRow);
          } else if (selectedType === "exams") {
            const mappedRow = {
              date: parseStandardDate(rowData["Data"] || rowData[fileHeaders[0]]),
              title: rowData["Nome_do_Exame"] || "Exame S/ N",
              category: rowData["Categoria_Especialidade"] || "Geral",
              facility: rowData["Laboratorio_Local"] || "",
              doctor: rowData["Medico_Solicitante"] || "",
              observations: rowData["Observacoes_Resultados"] || "",
            };
            rows.push(mappedRow);
          } else if (selectedType === "vaccines") {
            const mappedRow = {
              name: rowData["Nome_da_Vacina"] || rowData[fileHeaders[0]] || "Vacina Geral",
              dose: rowData["Dose"] || "Dose Única",
              appliedDate: parseStandardDate(rowData["Data_Aplicacao"] || rowData["Data"]),
              status: "applied" as const,
              batch: rowData["Lote_Vacina"] || "FPM-Importado",
            };
            rows.push(mappedRow);
          }
        } catch (err) {
          console.warn("Falha ao mapear linha Google Sheet:", fileRow, err);
        }
      }

      if (rows.length === 0) {
        throw new Error("Nenhum dado clínico legível ou compatível encontrado na planilha.");
      }

      setParsedRows(rows);
      setStatusMsg({ type: "info", text: `Carregamos ${rows.length} registros da aba "${gSelectedSheet}". Avalie os dados na tabela e confirme para consolidar!` });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: "error", text: `Falha ao carregar registros: ${err.message || String(err)}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportToGoogleSheets = async () => {
    if (!googleToken) {
      setStatusMsg({ type: "error", text: "Por favor, conecte-se com sua conta Google primeiro." });
      return;
    }

    setIsLoading(true);
    setExportedSpreadsheetUrl(null);
    setStatusMsg({ type: "info", text: "Exportando dados clínicos... Lendo tabelas locais..." });

    try {
      const { dbService } = await import("../lib/db.ts");
      const allVitals = await dbService.getVitals();
      const allConsults = await dbService.getConsultations();
      const allExams = await dbService.getExams();
      const allVaccines = await dbService.getVaccines();

      const memberVitals = allVitals.filter(v => v.memberId === member.id);
      const memberConsults = allConsults.filter(c => c.memberId === member.id);
      const memberExams = allExams.filter(e => e.memberId === member.id);
      const memberVaccines = allVaccines.filter(v => v.memberId === member.id);

      setStatusMsg({ type: "info", text: "Criando documento de planilha no Google Drive..." });

      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            title: `Prontuário de Saúde - ${member.name} (Gerado em ${new Date().toLocaleDateString()})`
          },
          sheets: [
            { properties: { title: "Sinais Vitais" } },
            { properties: { title: "Consultas & Procedimentos" } },
            { properties: { title: "Exames" } },
            { properties: { title: "Vacinas" } }
          ]
        })
      });

      if (!createRes.ok) {
        throw new Error(`Falha ao criar planilha: HTTP ${createRes.status}`);
      }
      const sheetData = await createRes.json();
      const spreadsheetId = sheetData.spreadsheetId;
      const spreadsheetUrl = sheetData.spreadsheetUrl;

      setStatusMsg({ type: "info", text: "Montando tabelas de dados..." });

      const vitalsValues = [
        ["Data", "Peso_kg", "Altura_cm", "Pressao_Sistolica", "Pressao_Diastolica", "Glicemia_mg_dL", "Batimentos_bpm"],
        ...memberVitals.map(v => [
          v.date || "",
          v.weight !== undefined ? String(v.weight) : "",
          v.height !== undefined ? String(v.height) : "",
          v.systolicBP !== undefined ? String(v.systolicBP) : "",
          v.diastolicBP !== undefined ? String(v.diastolicBP) : "",
          v.bloodGlucose !== undefined ? String(v.bloodGlucose) : "",
          v.heartRate !== undefined ? String(v.heartRate) : ""
        ])
      ];

      const consultationsValues = [
        ["Data", "Especialidade", "Medico", "Local_Hospital", "Motivo", "Prescricao_Receita", "Anotacoes_Gerais"],
        ...memberConsults.map(c => [
          c.date || "",
          c.specialty || "",
          c.doctor || "",
          c.facility || "",
          c.reason || "",
          c.prescription || "",
          c.notes || ""
        ])
      ];

      const examsValues = [
        ["Data", "Nome_do_Exame", "Categoria_Especialidade", "Laboratorio_Local", "Medico_Solicitante", "Observacoes_Resultados"],
        ...memberExams.map(e => [
          e.date || "",
          e.title || "",
          e.category || "",
          e.facility || "",
          e.doctor || "",
          e.observations || ""
        ])
      ];

      const vaccinesValues = [
        ["Nome_da_Vacina", "Dose", "Data_Aplicacao", "Lote_Vacina"],
        ...memberVaccines.map(v => [
          v.name || "",
          v.dose || "",
          v.appliedDate || v.dueDate || "",
          v.batch || ""
        ])
      ];

      setStatusMsg({ type: "info", text: "Enviando registros para as abas do Google Sheets..." });

      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: [
            { range: "'Sinais Vitais'!A1", values: vitalsValues },
            { range: "'Consultas & Procedimentos'!A1", values: consultationsValues },
            { range: "'Exames'!A1", values: examsValues },
            { range: "'Vacinas'!A1", values: vaccinesValues }
          ]
        })
      });

      if (!updateRes.ok) {
        throw new Error(`Falha ao preencher dados na planilha: HTTP ${updateRes.status}`);
      }

      setExportedSpreadsheetUrl(spreadsheetUrl);
      setStatusMsg({
        type: "success",
        text: `Sucesso total! Exportação concluída e consolidada. Criamos a planilha com as 4 abas estruturadas contendo o histórico de ${member.name}.`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: "error", text: `Falha na exportação para o Google Sheets: ${err.message || String(err)}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate Sample CSV with proper separators for Portuguese Excel compatibility
  const handleDownloadTemplate = () => {
    const template = TEMPLATES[selectedType];
    // Semicolon (;) ensures Portuguese Excel opens columns perfectly on Brazilian/European versions
    const csvContent = "\ufeff" + [
      template.headers.join(";"),
      template.sample.join(";")
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `modelo_planilha_${selectedType}_${member.name.toLowerCase().replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parses Portuguese/standard formatted Date to ISO string YYYY-MM-DD
  const parseStandardDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split("T")[0];
    
    // Replace slashes/dashes
    const cleaned = dateStr.replace(/-|\//g, ".").trim();
    const parts = cleaned.split(".");
    
    if (parts.length === 3) {
      // Check if it's DD.MM.YYYY
      if (parts[0].length <= 2 && parts[2].length === 4) {
        const d = parts[0].padStart(2, "0");
        const m = parts[1].padStart(2, "0");
        const y = parts[2];
        return `${y}-${m}-${d}`;
      }
      // Check if it's YYYY.MM.DD
      if (parts[0].length === 4 && parts[2].length <= 2) {
        const y = parts[0];
        const m = parts[1].padStart(2, "0");
        const d = parts[2].padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
    
    // Fallback attempts
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split("T")[0];
    }
    
    return new Date().toISOString().split("T")[0];
  };

  // Custom parser logic for local file
  const parseCSVText = (text: string, type: DataType) => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) {
      throw new Error("Arquivo vazio.");
    }

    const firstLine = lines[0].trim();
    if (!firstLine) {
      throw new Error("Cabeçalho não encontrado na primeira linha.");
    }

    // Auto-detect delimiter (comma or semicolon)
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolons > commas ? ";" : ",";

    // Split headers and trim
    const fileHeaders = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ""));
    setHeaders(fileHeaders);

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let currentField = "";
      let insideQuotes = false;
      const fileRow: string[] = [];

      // Robust quote-aware splitter
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"' || char === "'") {
          insideQuotes = !insideQuotes;
        } else if (char === delimiter && !insideQuotes) {
          fileRow.push(currentField.trim());
          currentField = "";
        } else {
          currentField += char;
        }
      }
      fileRow.push(currentField.trim());

      const rowData: Record<string, string> = {};
      fileHeaders.forEach((h, index) => {
        const val = fileRow[index] || "";
        rowData[h] = val.replace(/^"|"$/g, "").trim();
      });

      // Map to proper types
      try {
        if (type === "vitals") {
          const mappedRow = {
            date: parseStandardDate(rowData["Data"] || rowData[fileHeaders[0]]),
            weight: rowData["Peso_kg"] ? parseFloat(rowData["Peso_kg"].replace(",", ".")) : undefined,
            height: rowData["Altura_cm"] ? parseFloat(rowData["Altura_cm"].replace(",", ".")) : undefined,
            systolicBP: rowData["Pressao_Sistolica"] ? parseInt(rowData["Pressao_Sistolica"]) : undefined,
            diastolicBP: rowData["Pressao_Diastolica"] ? parseInt(rowData["Pressao_Diastolica"]) : undefined,
            bloodGlucose: rowData["Glicemia_mg_dL"] ? parseInt(rowData["Glicemia_mg_dL"]) : undefined,
            heartRate: rowData["Batimentos_bpm"] ? parseInt(rowData["Batimentos_bpm"]) : undefined,
          };
          rows.push(mappedRow);
        } else if (type === "consultations") {
          const mappedRow = {
            date: parseStandardDate(rowData["Data"] || rowData[fileHeaders[0]]),
            specialty: rowData["Especialidade"] || "Consulta Geral",
            doctor: rowData["Medico"] || "",
            facility: rowData["Local_Hospital"] || "",
            reason: rowData["Motivo"] || "",
            prescription: rowData["Prescricao_Receita"] || "",
            notes: rowData["Anotacoes_Gerais"] || "",
          };
          rows.push(mappedRow);
        } else if (type === "exams") {
          const mappedRow = {
            date: parseStandardDate(rowData["Data"] || rowData[fileHeaders[0]]),
            title: rowData["Nome_do_Exame"] || "Exame S/ N",
            category: rowData["Categoria_Especialidade"] || "Geral",
            facility: rowData["Laboratorio_Local"] || "",
            doctor: rowData["Medico_Solicitante"] || "",
            observations: rowData["Observacoes_Resultados"] || "",
          };
          rows.push(mappedRow);
        } else if (type === "vaccines") {
          const mappedRow = {
            name: rowData["Nome_da_Vacina"] || rowData[fileHeaders[0]] || "Vacina Geral",
            dose: rowData["Dose"] || "Dose Única",
            appliedDate: parseStandardDate(rowData["Data_Aplicacao"] || rowData["Data"]),
            status: "applied" as const,
            batch: rowData["Lote_Vacina"] || "FPM-Importado",
          };
          rows.push(mappedRow);
        }
      } catch (err) {
        console.warn("Falha ao mapear linha CSV:", line, err);
      }
    }

    if (rows.length === 0) {
      throw new Error("Não foi possível decodificar nenhuma linha válida de dados.");
    }

    setParsedRows(rows);
    setStatusMsg({ 
      type: "info", 
      text: `Arquivo processado! Encontrados ${rows.length} registros prontos para importação.` 
    });
  };

  const handleFile = (file: File) => {
    setIsLoading(true);
    setStatusMsg({ type: "info", text: "Lendo planilha local..." });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        parseCSVText(text, selectedType);
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Erro na análise do arquivo de planilha." });
        setParsedRows([]);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setStatusMsg({ type: "error", text: "Falha na leitura física do seu arquivo." });
      setIsLoading(false);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    setIsLoading(true);
    setStatusMsg({ type: "info", text: "Gravando registros no prontuário local..." });

    try {
      const { dbService } = await import("../lib/db.ts");

      let saveCount = 0;
      for (const row of parsedRows) {
        const record = {
          ...row,
          id: `${selectedType}_imp_${Date.now()}_${saveCount}_${Math.floor(Math.random() * 10000)}`,
          memberId: member.id
        };

        if (selectedType === "vitals") {
          await dbService.saveVital(record);
        } else if (selectedType === "consultations") {
          await dbService.saveConsultation(record);
        } else if (selectedType === "exams") {
          await dbService.saveExam(record);
        } else if (selectedType === "vaccines") {
          await dbService.saveVaccine(record);
        }
        saveCount++;
      }

      setStatusMsg({
        type: "success",
        text: `Sucesso total! Foram importados e consolidados ${saveCount} lançamentos para ${member.name}.`
      });
      setParsedRows([]);
      onDataImported();
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: "error", text: "Falha na inserção física dos dados no banco local." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl p-6 flex flex-col max-h-[90vh] text-left animate-in fade-in zoom-in-95 duration-155">
        {/* Header bar */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-extrabold text-gray-900 inline-flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 animate-pulse" />
            Sincronizar Dados de Planilha ({member.name})
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 px-1.5 hover:bg-gray-100 text-gray-400 rounded-xl text-xs font-bold cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          
          {/* Segmented Tab Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-2xl w-full select-none sticky top-0 z-10 border border-gray-200">
            <button
              type="button"
              onClick={() => {
                setImportSource("csv");
                setParsedRows([]);
                setStatusMsg({ type: null, text: "" });
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                importSource === "csv"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Planilha CSV Local
            </button>
            <button
              type="button"
              onClick={() => {
                setImportSource("sheets");
                setParsedRows([]);
                setStatusMsg({ type: null, text: "" });
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                importSource === "sheets"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Cloud className="w-4 h-4 text-blue-600 animate-pulse" />
              Google Sheets (Nuvem)
            </button>
          </div>

          {/* SHARED SECTION: SELECT TYPE (Always visible to guide layout mapping) */}
          <div className="bg-slate-50 border border-gray-150 p-4 rounded-2xl">
            <label className="block text-2xs font-extrabold text-gray-500 uppercase tracking-widest mb-2.5">
              Tipo de histórico clínico alvo
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(TEMPLATES) as DataType[]).map((type) => {
                const isSelected = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setSelectedType(type);
                      setParsedRows([]);
                      setStatusMsg({ type: null, text: "" });
                    }}
                    className={`py-2 px-2.5 rounded-xl text-center border font-extrabold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer text-xs ${
                      isSelected 
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                        : "bg-white hover:bg-gray-100 text-gray-700 border-gray-200"
                    }`}
                  >
                    <span className="leading-tight uppercase">{TEMPLATES[type].title}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-2xs font-medium text-gray-500 mt-2.5 italic">
              📌 {TEMPLATES[selectedType].description}
            </p>
          </div>

          {/* TAB 1: CSV LOCAL */}
          {importSource === "csv" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Step 2: Download Model Planilha Button */}
              <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-center sm:text-left">
                  <h4 className="text-xs font-black text-emerald-950 uppercase flex items-center justify-center sm:justify-start gap-1 justify-items-center">
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    Ainda sem planilha? Baixe o modelo
                  </h4>
                  <p className="text-3xs text-emerald-700 font-semibold mt-0.5">Use o modelo CSV inicial pronto com os cabeçalhos aceitos para preencher no Excel.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-2xs rounded-xl flex items-center gap-1.5 shadow-3xs cursor-pointer select-none shrink-0"
                >
                  Baixar Modelo CSV
                </button>
              </div>

              {/* Step 3: Drag and Drop Upload Box */}
              <div className="space-y-2">
                <label className="block text-2xs font-extrabold text-gray-500 uppercase tracking-widest">
                  Fazer upload do arquivo (.CSV)
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full py-8 px-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                    dragActive 
                      ? "bg-blue-50/50 border-blue-500" 
                      : "bg-slate-50 border-gray-200 hover:border-blue-400 hover:bg-slate-100/40"
                  }`}
                >
                  <Upload className="w-8 h-8 text-gray-400" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-800">Clique para selecionar ou arraste o arquivo CSV</p>
                    <p className="text-3xs text-gray-400 font-medium mt-0.5">Formatos suportados: CSV (separado por vírgula ou ponto e vírgula)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE SHEETS */}
          {importSource === "sheets" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* GOOGLE SECURITY / STATUS BADGE */}
              {!googleToken ? (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-50 border border-gray-150 rounded-2xl space-y-4">
                  <Cloud className="w-12 h-12 text-blue-500 animate-pulse" />
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Conecte seu Google Planilhas</h4>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm">Autentique-se com sua conta Google para ler planilhas diretamente do Drive ou exportar o prontuário de {member.name} com um clique.</p>
                  </div>
                  
                  {/* Modern Material Sign-In Google button */}
                  <button 
                    type="button" 
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center bg-white border border-gray-300 rounded-lg px-5 py-2.5 shadow-xs hover:shadow-sm transition-all font-bold text-xs text-slate-800 hover:bg-gray-50 cursor-pointer disabled:bg-gray-100"
                  >
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 mr-2.5">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    Fazer Login com Google
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Connected Header status */}
                  <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-2xl">
                    <div className="flex items-center gap-2.5">
                      {googleUser?.photoURL ? (
                        <img src={googleUser.photoURL} alt={googleUser.displayName || ""} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-blue-200" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center uppercase">
                          {googleUser?.displayName?.charAt(0) || "G"}
                        </div>
                      )}
                      <div className="text-left">
                        <h5 className="text-xs font-black text-slate-800 leading-none">{googleUser?.displayName || "Google Conectado"}</h5>
                        <span className="text-3xs font-semibold text-gray-500 mt-1 block leading-none">{googleUser?.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleSignOut}
                      className="text-[10px] font-extrabold uppercase text-gray-500 hover:text-red-650 px-2.5 py-1.5 border border-gray-250 rounded-lg flex items-center gap-1 select-none cursor-pointer"
                    >
                      <LogOut className="w-3 h-3 text-gray-400" />
                      Sair
                    </button>
                  </div>

                  {/* DOUBLE CAPABILITIES: EXPORT / IMPORT PANEL */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    
                    {/* EXP PANEL A: IMPORT FROM SHEET */}
                    <div className="p-4 rounded-2xl border border-gray-150 bg-white space-y-3">
                      <div>
                        <h4 className="text-xs font-black text-gray-800 uppercase">Importar de Planilha</h4>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Insira a URL de um documento Google Sheet compartilhado.</p>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          value={spreadsheetUrl}
                          onChange={(e) => setSpreadsheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="w-full text-xs p-2.5 bg-gray-50 rounded-xl border border-gray-250 font-medium placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleLoadGSheetsTabs}
                          disabled={isLoading || !spreadsheetUrl}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400"
                        >
                          <Table className="w-3.5 h-3.5" />
                          Localizar Abas no Google Drive
                        </button>
                      </div>

                      {gSheetsList.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-dashed border-gray-150  animate-in slide-in-from-top-2 duration-120">
                          <label className="block text-[10px] font-black text-gray-500 uppercase">
                            Selecione a aba (Sheet):
                          </label>
                          <div className="flex gap-1.5">
                            <select
                              value={gSelectedSheet}
                              onChange={(e) => setGSelectedSheet(e.target.value)}
                              className="flex-1 text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                            >
                              {gSheetsList.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleLoadGSheetValues}
                              disabled={isLoading}
                              className="px-4.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                            >
                              Ler Dados
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* EXP PANEL B: EXPORT CLINICAL HISTORY */}
                    <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/20 flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-blue-950 uppercase flex items-center gap-1">
                          <Share2 className="w-3.5 h-3.5 text-blue-600" />
                          Backup e Exportação Google
                        </h4>
                        <p className="text-[10px] text-blue-800 font-bold leading-relaxed">
                          Gere uma planilha Google estruturada com todos os dados do prontuário (Vitals, Consultas, Exames e Vacinas) deste membro.
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        {exportedSpreadsheetUrl && (
                          <a
                            href={exportedSpreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-800 text-[10px] font-black uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors select-none"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                            Ver Planilha no Google Sheets
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={handleExportToGoogleSheets}
                          disabled={isLoading}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                        >
                          <Cloud className="w-3.5 h-3.5" />
                          Gerar Nova Google Spreadsheet
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {/* Dynamic Spreadsheet Parsed Preview Grid table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex justify-between items-center bg-slate-900 text-white p-3 rounded-t-2xl">
                <span className="text-xs font-black uppercase tracking-wide inline-flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-emerald-400" />
                  Visualização da Planilha ({parsedRows.length} linhas lidas)
                </span>
                <span className="text-3xs font-extrabold px-2.5 py-0.5 bg-emerald-500 text-white rounded-full">
                  Pronto para Importar
                </span>
              </div>
              
              <div className="border border-gray-200 rounded-b-2xl overflow-x-auto max-h-56">
                <table className="w-full text-left border-collapse text-3xs font-semibold">
                  <thead className="bg-gray-100 text-gray-600 sticky top-0 border-b border-gray-200 select-none">
                    <tr>
                      <th className="p-2 border-r border-gray-200">#</th>
                      {selectedType === "vitals" && (
                        <>
                          <th className="p-2 border-r border-gray-200">Data</th>
                          <th className="p-2 border-r border-gray-200">Peso (kg)</th>
                          <th className="p-2 border-r border-gray-200">Altura (cm)</th>
                          <th className="p-2 border-r border-gray-200">Pressão</th>
                          <th className="p-2 border-r border-gray-200">Glicemia</th>
                          <th className="p-2">Ritmo Cardíaco</th>
                        </>
                      )}
                      {selectedType === "consultations" && (
                        <>
                          <th className="p-2 border-r border-gray-200">Data</th>
                          <th className="p-2 border-r border-gray-200">Especialidade</th>
                          <th className="p-2 border-r border-gray-200">Médico</th>
                          <th className="p-2 border-r border-gray-200">Hospital</th>
                          <th className="p-2">Motivo</th>
                        </>
                      )}
                      {selectedType === "exams" && (
                        <>
                          <th className="p-2 border-r border-gray-200">Data</th>
                          <th className="p-2 border-r border-gray-200">Exame</th>
                          <th className="p-2 border-r border-gray-200">Categoria</th>
                          <th className="p-2 border-r border-gray-200">Laboratório</th>
                          <th className="p-2">Médico</th>
                        </>
                      )}
                      {selectedType === "vaccines" && (
                        <>
                          <th className="p-2 border-r border-gray-200">Vacina</th>
                          <th className="p-2 border-r border-gray-200">Dose</th>
                          <th className="p-2 border-r border-gray-200">Data de Aplicação</th>
                          <th className="p-2">Lote</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
                    {parsedRows.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50/50">
                        <td className="p-2 border-r border-gray-100 bg-gray-50 text-gray-400 text-center font-bold">
                          {index + 1}
                        </td>
                        {selectedType === "vitals" && (
                          <>
                            <td className="p-2 border-r border-gray-100 font-bold text-gray-900">{row.date}</td>
                            <td className="p-2 border-r border-gray-100">{row.weight !== undefined ? `${row.weight} kg` : "-"}</td>
                            <td className="p-2 border-r border-gray-100">{row.height !== undefined ? `${row.height} cm` : "-"}</td>
                            <td className="p-2 border-r border-gray-100">
                              {row.systolicBP && row.diastolicBP ? `${row.systolicBP}/${row.diastolicBP} mmHg` : "-"}
                            </td>
                            <td className="p-2 border-r border-gray-100">{row.bloodGlucose !== undefined ? `${row.bloodGlucose} mg/dL` : "-"}</td>
                            <td className="p-2">{row.heartRate !== undefined ? `${row.heartRate} bpm` : "-"}</td>
                          </>
                        )}
                        {selectedType === "consultations" && (
                          <>
                            <td className="p-2 border-r border-gray-100 font-bold text-gray-900">{row.date}</td>
                            <td className="p-2 border-r border-gray-100 text-blue-700 font-bold">{row.specialty}</td>
                            <td className="p-2 border-r border-gray-100">{row.doctor || "-"}</td>
                            <td className="p-2 border-r border-gray-100">{row.facility || "-"}</td>
                            <td className="p-2 max-w-xs truncate">{row.reason || "-"}</td>
                          </>
                        )}
                        {selectedType === "exams" && (
                          <>
                            <td className="p-2 border-r border-gray-100 font-bold text-gray-900">{row.date}</td>
                            <td className="p-2 border-r border-gray-100 text-purple-700 font-bold">{row.title}</td>
                            <td className="p-2 border-r border-gray-100">{row.category || "-"}</td>
                            <td className="p-2 border-r border-gray-100">{row.facility || "-"}</td>
                            <td className="p-2">{row.doctor || "-"}</td>
                          </>
                        )}
                        {selectedType === "vaccines" && (
                          <>
                            <td className="p-2 border-r border-gray-100 text-indigo-700 font-bold">{row.name}</td>
                            <td className="p-2 border-r border-gray-100">{row.dose}</td>
                            <td className="p-2 border-r border-gray-100 font-medium">{row.appliedDate}</td>
                            <td className="p-2">{row.batch || "-"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status Alert feedback banner */}
          {statusMsg.type && (
            <div className={`p-4 rounded-2xl flex items-start gap-3 border ${
              statusMsg.type === "success" 
                ? "bg-emerald-50 border-emerald-150 text-emerald-800" 
                : statusMsg.type === "error"
                ? "bg-rose-50 border-rose-150 text-rose-800" 
                : "bg-blue-50 border-blue-150 text-blue-800"
            }`}>
              {statusMsg.type === "success" ? (
                <Check className="w-5 h-5 shrink-0 text-emerald-600" />
              ) : statusMsg.type === "error" ? (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              ) : (
                <RefreshCw className="w-5 h-5 shrink-0 text-blue-600 animate-spin" />
              )}
              <div className="flex-1">
                <span className="text-2xs font-extrabold uppercase block tracking-wider">
                  {statusMsg.type === "success" ? "Operação Concluída" : statusMsg.type === "error" ? "Ops! Algo deu errado" : "Processando Sincronização"}
                </span>
                <p className="text-xs font-semibold leading-relaxed mt-0.5">{statusMsg.text}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-gray-100 flex gap-2 justify-end shrink-0 select-none">
          {parsedRows.length > 0 && (
            <button
              type="button"
              disabled={isLoading}
              onClick={handleImport}
              className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Alimentar Histórico Clínico
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
