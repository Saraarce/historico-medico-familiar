import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set high limit for base64 camera images from mobile
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  // Initialize Gemini API Client server-side
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", apiKeyConfigured: !!apiKey });
  });

  // Endpoint to generate an AI summary for a family member
  app.post("/api/generate-summary", async (req, res) => {
    try {
      const { member, consultations, exams } = req.body;

      if (!member) {
        return res.status(400).json({ error: "Dados do membro da família não fornecidos." });
      }

      if (!apiKey) {
        return res.status(500).json({
          error: "Chave de API do Gemini não configurada no servidor. Verifique as configurações.",
        });
      }

      const formattedConsultations = (consultations || [])
        .map((c: any) => `- Data: ${c.date} | Especialidade: ${c.specialty} | Médico: ${c.doctor} | Local: ${c.facility} | Motivo: ${c.reason} | Medicamentos/Recomendações: ${c.prescription || "Nenhuma"} | Notas: ${c.notes || "Sem observações"}`)
        .join("\n");

      const formattedExams = (exams || [])
        .map((e: any) => `- Data: ${e.date} | Exame: ${e.title} | Categoria: ${e.category} | Clínica: ${e.facility} | Médico Solicitante: ${e.doctor} | Observações/Resultados: ${e.observations}`)
        .join("\n");

      const prompt = `Você é um médico especialista sênior em medicina de família e privacidade/comunidade.
Gere uma Apresentação de Caso Clínico / Resumo Evolutivo condensado e de alta densidade técnica (usando terminologia médica formal, abreviações profissionais aceitas e formato markdown limpo) para o seguinte paciente:

Ficha e Identificação do Paciente:
- Nome: ${member.name}
- Parentesco: ${member.relationship}
- Data de Nascimento: ${member.birthDate}
- Grupo Sanguíneo: ${member.bloodType}
- Alergias Documentadas: ${member.allergies || "Sem registro (Nenhuma)"}
- Comorbidades diagnosticadas: ${member.comorbidities || "Nenhuma comorbidade registrada"}
- Terapêutica de Uso Ativo/Contínuo: ${member.medications || "Nenhum medicamento de uso contínuo registrado"}

Histórico de Consultas Clínicas Recentes:
${formattedConsultations || "Nenhuma consulta registrada até o momento."}

Histórico de Exames Clínicos e Laudos Recentes:
${formattedExams || "Nenhum exame clínico registrado até o momento."}

Instruções Clínicas para o Resumo:
1. O resumo deve ser puramente técnico, profissional, direto, no modelo de "Passagem de Caso" / "Evolução Médica" de alta eficiência. Use termos como "paciente apresenta histórico de...", "terapêutica contínua sob conformidade...", "sinais ou laudos sugerem...", etc.
2. Livre-se de qualquer tipo de linguagem acolhedora, calorosa, cordial ou sentimental. O leitor final é um médico que necessita revisar as condições, os exames anexos e as condutas do paciente de forma pragmática e célere no celular.
3. Estruture em Markdown limpo usando as seguintes seções estritas:
   - **Sumário Clínico & Status Atual**: Status das comorbidades, gravidade de sintomas declarados, conformidade e dosagem do esquema terapêutico contínuo.
   - **Achados e Tendências nos Exames/Consultas**: Avaliação objetiva dos exames e relatos de consultas recentes, destacando pontos críticos, alterações em relatórios ou tendências clínicas que merecem atenção diagnóstica.
   - **Plano de Conduta Sugerido**: De 2 a 3 diretrizes práticas de acompanhamento baseadas strictly em raciocínio médico (ex: novos exames de controle recomendados, frequência de reavaliação clínica, acompanhamento farmacogênico, etc.).
4. Seja extremamente direto, conciso e use terminologia de prontuário eletrónico de alta fidelidade. O texto deve caber em uma tela mobile sem exigir rolagem excessiva. Escreva estritamente em português (do Brasil).`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Você é um copiloto médico virtual altamente técnico e preciso. Suas avaliações são formuladas estritamente sob o tom de uma discussão de caso clínico de médico para médico, focadas em brevidade, terminologia do prontuário oficial e alto pragmatismo clínico.",
        }
      });

      const summaryText = response.text;
      if (!summaryText) {
        throw new Error("Resposta de resumo vazia do Gemini.");
      }

      return res.json({ summary: summaryText });
    } catch (error: any) {
      console.error("Erro ao gerar resumo de saúde com Gemini:", error);
      return res.status(500).json({
        error: "Falha ao gerar o resumo de saúde utilizando a Inteligência Artificial.",
        details: error.message || String(error),
      });
    }
  });

  // Endpoint to scan a medical exam photo using Gemini 3.5 Flash
  app.post("/api/scan-exam", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Nenhuma imagem foi enviada." });
      }

      if (!apiKey) {
        return res.status(500).json({
          error: "Chave de API do Gemini não configurada no servidor. Verifique as configurações.",
        });
      }

      // Universal regex to strip ANY base64 prefix safely (such as application/pdf or image/png)
      const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/\-+.]+;base64,/, "");
      const finalMimeType = mimeType || "image/jpeg";

      const prompt = `Analise esta imagem ou documento PDF de laudo médico, exame clínico, receita ou atestado. Extraia os detalhes clínicos relevantes em português e organize-os estruturadamente com base nos campos solicitados. Se algum campo original não estiver definido no documento, retorne uma string vazia ou use sua melhor inferência sensata de acordo com o contexto do laudo.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: finalMimeType,
            },
          },
          prompt,
        ],
        config: {
          systemInstruction: "Você é um assistente médico especialista em transcrição e digitalização de prontuários. Seu trabalho é extrair de forma precisa e confidencial informações de exames, receitas ou atestados enviados por imagem.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "O nome legível ou tipo do exame/receita/documento, por exemplo: 'Hemograma Completo', 'Receita de Amoxicilina', 'Ultrassonografia Abdominal'.",
              },
              date: {
                type: Type.STRING,
                description: "Data de realização ou emissão no formato DD/MM/AAAA se especificada na imagem. Se não encontrar, tente deduzir ou deixe vazio.",
              },
              doctor: {
                type: Type.STRING,
                description: "Nome do médico, pediatra ou profissional de saúde responsável, se disponível.",
              },
              facility: {
                type: Type.STRING,
                description: "Clínica, hospital ou laboratório onde foi realizado (ex: 'Sabin', 'Fleury', 'Hospital Municipal').",
              },
              observations: {
                type: Type.STRING,
                description: "Resumo interpretativo sucinto dos resultados relevantes, valores de referência ou dosagens prescritas (máximo de 2 parágrafos).",
              },
              category: {
                type: Type.STRING,
                description: "Uma única palavra sugerindo a especialidade médica conveniente, ex: 'Cardiologia', 'Pediatria', 'Clínico Geral', 'Ginecologia', 'Ortopedia', 'Dermatologia', 'Outros'.",
              },
            },
            required: ["title", "date", "doctor", "facility", "observations", "category"],
          },
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("Resposta de extração vazia do Gemini.");
      }

      const extractedData = JSON.parse(resultText);
      return res.json(extractedData);
    } catch (error: any) {
      console.error("Erro ao analisar imagem com Gemini:", error);
      return res.status(500).json({
        error: "Falha ao analisar a imagem do exame utilizando a Inteligência Artificial.",
        details: error.message || String(error),
      });
    }
  });

  // Handle Vite Asset Serving configuration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
