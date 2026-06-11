import React, { useState, useRef } from "react";
import { Camera, Upload, Sparkles, BrainCircuit, RefreshCw, Save, CheckCircle, AlertTriangle, FileText } from "lucide-react";
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
          <p className="text-xs text-gray-500 max-w-sm mb-6">Suporta fotos de exames de sangue, laudos médicos, receitas e arquivos PDF (Formato JPG, PNG, PDF)</p>
          
          <div className="flex flex-wrap gap-3 justify-center">
            <button 
              type="button"
              id="btn-upload-file"
              className="py-2.5 px-4 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-sm font-medium text-gray-700 shadow-xs flex items-center gap-2 hover:bg-gray-50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                triggerFileSelect();
              }}
            >
              <Upload className="w-4 h-4 text-gray-500" />
              Escolher Arquivo
            </button>
            <button 
              type="button"
              id="btn-camera-capture"
              className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl text-sm font-medium text-white shadow-sm flex items-center gap-2 transition-all hover:scale-101"
              onClick={(e) => {
                e.stopPropagation();
                triggerCameraInput();
              }}
            >
              <Camera className="w-4 h-4" />
              Usar Câmera
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
          <input 
            type="file" 
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            capture="environment"
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
    </div>
  );
}
