import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Only allow POST requests for this endpoint
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Utilize POST." });
  }

  try {
    const { member, consultations, exams } = req.body;

    if (!member) {
      return res.status(400).json({ error: "Dados do membro da família não fornecidos." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Chave de API do Gemini não configurada no servidor. Verifique as configurações no painel da Vercel.",
      });
    }

    // Initialize Gemini API Client
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

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

    return res.status(200).json({ summary: summaryText });
  } catch (error: any) {
    console.error("Erro ao gerar resumo de saúde com Gemini:", error);
    return res.status(500).json({
      error: "Falha ao gerar o resumo de saúde utilizando a Inteligência Artificial.",
      details: error.message || String(error),
    });
  }
}
