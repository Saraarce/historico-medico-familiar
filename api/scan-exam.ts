import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Only allow POST requests for this endpoint
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Utilize POST." });
  }

  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Nenhuma imagem foi enviada." });
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

    // Remove any base64 prefix
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
    return res.status(200).json(extractedData);
  } catch (error: any) {
    console.error("Erro ao analisar imagem com Gemini:", error);
    return res.status(500).json({
      error: "Falha ao analisar a imagem do exame utilizando a Inteligência Artificial.",
      details: error.message || String(error),
    });
  }
}
