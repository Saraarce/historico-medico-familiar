import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, Sparkles, BrainCircuit, RefreshCw, Save, CheckCircle, AlertTriangle, FileText, Cloud, Search, X } from "lucide-react";
import { FamilyMember, Exam } from "../types";

interface AIExamScannerProps {
  members: FamilyMember[];
  onExamSaved: () => void;
}

export default function AIExamScanner({ members, onExamSaved }: AIExamScannerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    title: string;
    date: string;
    doctor: string;
    facility: string;
    observations: string;
    category: string;
  } | null>(null);
  
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Google Drive state
  const isMounted = useRef(true);
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isFetchingDriveFiles, setIsFetchingDriveFiles] = useState(false);
  const [isDownloadingDriveFile, setIsDownloadingDriveFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    isMounted.current = true;
    let unsubscribe: (() => void) | undefined;
    
    // Dynamically load auth state
    import("../lib/auth")
      .then(({ initAuth }) => {
        unsubscribe = initAuth(
          (user, token) => {
            if (isMounted.current) {
              setGoogleUser(user);
              setGoogleToken(token);
            }
          },
          () => {
            if (isMounted.current) {
              setGoogleUser(null);
              setGoogleToken(null);
            }
          }
        );
      })
      .catch(err => console.error("Erro ao carregar módulo de auth no AIExamScanner:", err));

    return () => {
      isMounted.current = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setIsFetchingDriveFiles(true);
    setFeedback(null);
    try {
      const { googleSignIn } = await import("../lib/auth");
      const result = await googleSignIn();
      if (result) {
        if (isMounted.current) {
          setGoogleUser(result.user);
          setGoogleToken(result.accessToken);
          setIsDriveModalOpen(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current) {
        setFeedback({
          type: "error",
          message: "Falha na conexão com Google Drive: " + (err.message || String(err))
        });
      }
    } finally {
      if (isMounted.current) {
        setIsFetchingDriveFiles(false);
      }
    }
  };

  const fetchDriveFiles = async (token: string, search: string = "") => {
    setIsFetchingDriveFiles(true);
    try {
      const nameFilter = search ? ` and name contains '${search.replace(/'/g, "\\'")}'` : "";
      const q = encodeURIComponent(`(mimeType = 'application/pdf' or mimeType contains 'image/') and trashed = false${nameFilter}`);
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink)&orderBy=modifiedTime desc&pageSize=100`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (isMounted.current) {
          setDriveFiles(data.files || []);
        }
      } else {
        throw new Error("Não foi possível buscar os arquivos do seu Google Drive.");
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current) {
        setFeedback({
          type: "error",
          message: err.message || "Erro de conexão ao acessar o Google Drive."
        });
      }
    } finally {
      if (isMounted.current) {
        setIsFetchingDriveFiles(false);
      }
    }
  };

  useEffect(() => {
    if (isDriveModalOpen && googleToken) {
      const delayDebounceFn = setTimeout(() => {
        fetchDriveFiles(googleToken, searchQuery);
      }, 500);

      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, isDriveModalOpen, googleToken]);

  const handleSelectDriveFile = async (file: { id: string; name: string; mimeType: string }) => {
    if (!googleToken) return;
    setIsDownloadingDriveFile(true);
    setFeedback(null);
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      
      if (!res.ok) {
        throw new Error("Erro ao baixar o arquivo selecionado no Google Drive.");
      }
      
      const blob = await res.blob();
      const virtualFile = new File([blob], file.name, { type: file.mimeType });
      
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isMounted.current) {
          setImagePreview(reader.result as string);
          setSelectedFile(virtualFile);
          setScanResult(null);
          setIsDriveModalOpen(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error(err);
      if (isMounted.current) {
        setFeedback({
          type: "error",
          message: err.message || "Não foi possível carregar o arquivo do seu Drive."
        });
        setIsDriveModalOpen(false);
      }
    } finally {
      if (isMounted.current) {
        setIsDownloadingDriveFile(false);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setScanResult(null); // Clear previous scan
        setFeedback(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setScanResult(null);
        setFeedback(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const triggerCameraInput = () => {
    cameraInputRef.current?.click();
  };

  const runAIScan = async () => {
    if (!imagePreview) return;
    setIsScanning(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/scan-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imagePreview,
          mimeType: selectedFile?.type || "image/jpeg"
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro desconhecido ao escanear exame.");
      }

      setScanResult({
        title: data.title || "Exame Escaneado",
        date: data.date || new Date().toISOString().split("T")[0],
        doctor: data.doctor || "",
        facility: data.facility || "",
        observations: data.observations || "",
        category: data.category || "Clínico Geral"
      });
      // Try to auto-select member if only one or default to Carlos
      if (members.length > 0 && !selectedMemberId) {
        setSelectedMemberId(members[0].id);
      }
    } catch (error: any) {
      console.error(error);
      setFeedback({
        type: "error",
        message: error.message || "Erro de conexão com o servidor de IA."
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanResult || !selectedMemberId) return;

    try {
      const { dbService } = await import("../lib/db.ts");
      
      const newExam: Exam = {
        id: `exam_${Date.now()}`,
        memberId: selectedMemberId,
        date: scanResult.date,
        title: scanResult.title,
        category: scanResult.category,
        facility: scanResult.facility,
        doctor: scanResult.doctor,
        observations: scanResult.observations,
        photoUrl: imagePreview || undefined
      };

      await dbService.saveExam(newExam);
      setFeedback({
        type: "success",
        message: `Exame "${scanResult.title}" salvo com sucesso no prontuário de ${members.find(m => m.id === selectedMemberId)?.name}!`
      });
      
      // Clean up interface
      setSelectedFile(null);
      setImagePreview(null);
      setScanResult(null);
      
      // Call parent update callback
      onExamSaved();
    } catch (err) {
      setFeedback({
        type: "error",
        message: "Falha ao salvar o exame no banco de dados local."
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6" id="ai-scanner-section">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">SmartScan™ Exames com IA</h2>
          <p className="text-sm text-gray-500">Tire foto com a câmera ou envie o arquivo do exame para preenchimento inteligente</p>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 ${
          feedback.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
            : "bg-red-50 text-red-800 border border-red-100"
        }`}>
          {feedback.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      {!imagePreview ? (
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50 hover:bg-blue-50/10 transition-colors duration-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer"
          onClick={triggerFileSelect}
        >
          <div className="p-4 bg-white shadow-sm border border-gray-100 rounded-2xl mb-4 text-gray-400">
            <Upload className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">Arraste ou envie o exame (Imagem ou PDF)</h3>
          <p className="text-xs text-gray-500 max-w-sm mb-6 font-medium">Suporta fotos de exames de sangue, laudos médicos, receitas e arquivos PDF (Formato JPG, PNG, PDF)</p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md mt-2">
            <button 
              type="button"
              id="btn-upload-file"
              className="flex-1 py-2.5 px-4 bg-white border border-gray-200 hover:border-gray-350 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-2 hover:scale-101 cursor-pointer transition-all shadow-3xs"
              onClick={(e) => {
                e.stopPropagation();
                triggerFileSelect();
              }}
            >
              <Upload className="w-4 h-4 text-blue-500" />
              Do Dispositivo
            </button>

            <button 
              type="button"
              id="btn-import-google-drive"
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:scale-101 cursor-pointer transition-all shadow-3xs"
              onClick={(e) => {
                e.stopPropagation();
                if (googleToken) {
                  setIsDriveModalOpen(true);
                } else {
                  handleGoogleSignIn();
                }
              }}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 361.3 313" fill="none">
                <polygon points="120.3,313 361.3,313 301,208 60,208" fill="#ffd043"/>
                <polygon points="120.3,313 0,105 60,0 180.5,208" fill="#1a73e8"/>
                <polygon points="301,208 180.5,0 301,0 361.3,105" fill="#15a952"/>
              </svg>
              Google Drive
            </button>
          </div>

          {/* Hidden inputs */}
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            className="hidden"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Image Preview & Scanning Effect */}
          <div className="relative border border-gray-150 rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center max-h-[380px] p-6 w-full text-center">
            {imagePreview.startsWith("data:application/pdf") ? (
              <div className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200/60 rounded-xl max-h-[360px] w-full">
                <FileText className="w-16 h-16 text-rose-500 mb-3 animate-pulse" />
                <span className="text-sm font-extrabold text-slate-800">Laudo / Documento em PDF</span>
                <span className="text-2xs text-gray-400 mt-1.5 max-w-[240px]">O scanner de IA analisará o conteúdo textual do seu PDF de exames ou receitas.</span>
              </div>
            ) : (
              <img 
                referrerPolicy="no-referrer"
                src={imagePreview} 
                alt="Anexo de exame" 
                className="max-h-[380px] object-contain max-w-full rounded-2xl"
              />
            )}
            
            {/* Real Scanning Laser Animation */}
            {isScanning && (
              <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-sky-400 to-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
            )}

            {isScanning && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white">
                <RefreshCw className="w-10 h-10 animate-spin text-blue-400" />
                <div className="text-center">
                  <p className="font-bold text-lg tracking-wide flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                    Analisando com Gemini AI
                  </p>
                  <p className="text-xs text-gray-300 mt-1 max-w-xs px-4">Lendo receitas, datas, assinatura do médico e resultados clínicos...</p>
                </div>
              </div>
            )}

            {!isScanning && !scanResult && (
              <div className="absolute bottom-4 inset-x-4 flex gap-2">
                <button
                  type="button"
                  id="btn-run-ia-scan"
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-101"
                  onClick={runAIScan}
                >
                  <BrainCircuit className="w-4 h-4" />
                  Escanear Prontuário com IA
                </button>
                <button
                  type="button"
                  id="btn-remove-scan"
                  className="py-3 px-4 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                  onClick={() => {
                    setSelectedFile(null);
                    setImagePreview(null);
                    setScanResult(null);
                  }}
                >
                  Descartar
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Extracted data form or instructional panel */}
          <div className="flex flex-col justify-between">
            {!scanResult && !isScanning ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-8 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <Sparkles className="w-10 h-10 text-yellow-500 animate-bounce mb-3" />
                <h3 className="font-semibold text-gray-800 mb-1">A imagem está pronta!</h3>
                <p className="text-sm text-gray-500 max-w-xs mb-4">Clique no botão azul para a Inteligência Artificial ler e preencher todos os dados para você.</p>
                <p className="text-xs text-gray-400">O Gemini irá extrair: Tipo de exame, data, médico, resultados observados e especialidade correspondente.</p>
              </div>
            ) : isScanning ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-8 bg-gray-50/30 rounded-2xl">
                <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin mb-4" />
                <h4 className="font-semibold text-gray-700">Decodificando texto manuscrito e impresso...</h4>
                <p className="text-xs text-gray-500 mt-1">Isso levará cerca de 3 segundos.</p>
              </div>
            ) : (
              /* Success form pre-filled by AI */
              <form onSubmit={handleSaveExam} className="space-y-4">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 border-b border-gray-100 pb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  Dados Extraídos pela IA
                </h3>

                <div className="grid grid-cols-1 gap-3 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Integrante da Família</label>
                    <select
                      required
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 font-medium text-gray-800"
                    >
                      <option value="">Selecione o integrante...</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.relationship})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Título do Exame/Receita</label>
                      <input
                        type="text"
                        required
                        value={scanResult.title}
                        onChange={(e) => setScanResult({ ...scanResult, title: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 font-semibold text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Data</label>
                      <input
                        type="text"
                        required
                        value={scanResult.date}
                        placeholder="Ex: 10/06/2026"
                        onChange={(e) => setScanResult({ ...scanResult, date: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Médico Responsável</label>
                      <input
                        type="text"
                        value={scanResult.doctor}
                        onChange={(e) => setScanResult({ ...scanResult, doctor: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Categoria / Especialidade</label>
                      <input
                        type="text"
                        required
                        value={scanResult.category}
                        onChange={(e) => setScanResult({ ...scanResult, category: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 text-gray-800 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Laboratório ou Hospital</label>
                    <input
                      type="text"
                      value={scanResult.facility}
                      onChange={(e) => setScanResult({ ...scanResult, facility: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Observações e Resultados Extraídos</label>
                    <textarea
                      rows={3}
                      value={scanResult.observations}
                      onChange={(e) => setScanResult({ ...scanResult, observations: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 text-gray-700 text-xs resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    id="btn-save-extracted-exam"
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-101 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Salvar no Histórico
                  </button>
                  <button
                    type="button"
                    className="py-3 px-4 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl font-medium transition-all"
                    onClick={() => {
                      setScanResult(null);
                    }}
                  >
                    Nova Foto
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Google Drive File Selector Modal */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden max-h-[85vh] animate-in fade-in-50 zoom-in-95 duration-150 text-left">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 361.3 313" fill="none">
                  <polygon points="120.3,313 361.3,313 301,208 60,208" fill="#ffd043"/>
                  <polygon points="120.3,313 0,105 60,0 180.5,208" fill="#1a73e8"/>
                  <polygon points="301,208 180.5,0 301,0 361.3,105" fill="#15a952"/>
                </svg>
                <div>
                  <h3 className="font-bold text-gray-900 tracking-tight text-base">Importar do Google Drive</h3>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Selecione uma imagem de exame ou documento PDF</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDriveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Connection Information Banner */}
            {googleUser && (
              <div className="px-6 py-2 bg-blue-50/50 border-b border-blue-100/40 flex items-center justify-between text-2xs font-bold text-blue-800">
                <div className="flex items-center gap-2">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName || "Google"}
                      className="w-5 h-5 rounded-full border border-blue-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-3xs uppercase">
                      {googleUser.displayName?.charAt(0) || "G"}
                    </div>
                  )}
                  <span>Conectado como <strong className="font-extrabold">{googleUser.email}</strong></span>
                </div>
                <button
                  type="button"
                  className="text-3xs text-blue-600 hover:text-blue-850 font-black uppercase tracking-wider hover:underline cursor-pointer"
                  onClick={async () => {
                    const { logout } = await import("../lib/auth");
                    await logout();
                    setGoogleUser(null);
                    setGoogleToken(null);
                    setIsDriveModalOpen(false);
                  }}
                >
                  Sair da Conta
                </button>
              </div>
            )}

            {/* Live Search Drive files */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar exames ou laudos por nome no seu Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-100 font-semibold text-gray-800"
                />
              </div>
            </div>

            {/* Live List Stream */}
            <div className="flex-1 overflow-y-auto p-4 min-h-[320px] max-h-[440px] bg-slate-50/20">
              {isDownloadingDriveFile ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                  <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                  <span className="font-bold text-gray-800 text-sm">Baixando arquivo do Google Drive com segurança...</span>
                  <p className="text-xs text-gray-400 mt-2 max-w-sm">Estamos transferindo o arquivo para que a IA possa extrair informações em instantes.</p>
                </div>
              ) : isFetchingDriveFiles ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                  <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin mb-3" />
                  <span className="text-sm font-bold text-gray-500">Buscando imagens e arquivos PDF de exames...</span>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                  <Cloud className="w-12 h-12 text-slate-300 mb-3" />
                  <span className="font-bold text-gray-800 text-sm">Nenhum exame recente no Drive</span>
                  <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                    {searchQuery 
                      ? "Nenhum arquivo encontrado com esse nome. Tente termos parciais ou outro arquivo." 
                      : "Carregue exames (.png, .jpg, .pdf) na sua conta do Google Drive primeiro para poder importá-los aqui."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3">
                  {driveFiles.map((file) => {
                    const isPdf = file.mimeType === "application/pdf";
                    const sizeInMB = file.size ? `${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB` : "Tamanho sob demanda";
                    const formattedDate = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    }) : "";

                    return (
                      <div
                        key={file.id}
                        onClick={() => handleSelectDriveFile(file)}
                        className="p-3 bg-white border border-gray-150 hover:border-blue-400 hover:bg-blue-50/5 rounded-xl cursor-pointer transition-all flex items-start gap-3 shadow-3xs group"
                      >
                        <div className="w-12 h-12 bg-slate-50 group-hover:bg-blue-50/50 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 group-hover:border-blue-100 overflow-hidden">
                          {file.thumbnailLink && !isPdf ? (
                            <img
                              src={file.thumbnailLink}
                              alt="Thumbnail"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : isPdf ? (
                            <FileText className="w-6 h-6 text-rose-500" />
                          ) : (
                            <Cloud className="w-6 h-6 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-bold text-gray-800 text-xs truncate group-hover:text-blue-700 transition-colors" title={file.name}>
                            {file.name}
                          </p>
                          <span className="text-[9px] font-black tracking-wide uppercase text-slate-400 block mt-1">
                            {isPdf ? "📄 PDF Documento" : "🖼️ Imagem Exame"}
                          </span>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500 select-none font-medium">
                            <span>{sizeInMB}</span>
                            <span>•</span>
                            <span>{formattedDate}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-gray-150 bg-gray-50/70 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDriveModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-250 hover:border-gray-350 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
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
