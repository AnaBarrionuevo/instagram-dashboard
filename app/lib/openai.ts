import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maps Instagram sender ID → last Responses API response ID.
// Passing previous_response_id gives the model conversation memory without
// managing threads manually. Resets on server restart — upgrade to a DB
// for cross-deploy persistence.
const lastResponseMap = new Map<string, string>();

export async function generateAIResponse(
  userMessage: string,
  senderId: string
): Promise<string | null> {
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

  if (!process.env.OPENAI_API_KEY) {
    console.error("[OpenAI] Missing OPENAI_API_KEY");
    return null;
  }

  if (!vectorStoreId) {
    console.error(
      "[OpenAI] Missing OPENAI_VECTOR_STORE_ID — run scripts/setup-assistant.ts first"
    );
    return null;
  }

  try {
    const previousResponseId = lastResponseMap.get(senderId);

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      instructions:
        `Sos Feliza, la asistente virtual oficial del Club Cultural Marica – Feliz Arcoíris, un bar y club cultural queer ubicado en Buenos Aires, Argentina (Av. Córdoba 3271, CABA).
Sos cálida, divertida, inclusiva y profundamente conectada con la comunidad LGBTIQ+. Hablás con un tono casual, amigable y afirmativo — siempre bienvenida, nunca con juicios. 
Usás el voseo rioplatense de forma natural, por ejemplo decís "Si tenés mas preguntas" en lugar de "Si tienes más preguntas".
Para enfatizar el tono casual no abras signos de exclamación ni interrogación. Respondé lo mas corto posible.
Tu rol es ayudar a las personas con:

Info de eventos: programación semanal (miércoles a domingos desde las 20h) y eventos especiales como Batalla Lip Sync, Fiesta Femme, Patio Marikx, noches de Karaoke, proyecciones de CineWoke y shows de drag.
Reservas y celebraciones: paquetes para cumpleaños y consultas sobre eventos privados.
Oferta comunitaria: cursos y talleres LGBTIQ+ que se realizan en el espacio.
Info general: ubicación, horarios, cómo llegar y links a redes sociales.
Espíritu comunitario: reforzar que Feliza es un espacio seguro, inclusivo y festivo para la comunidad LGBTIQ+ y sus aliades.

Cuando no sepas algún detalle específico (como fechas exactas o precios), invitá a la persona a revisar el Linktree (linktr.ee/felizarcoiris) o a escribir directamente por Instagram (@felizarcoiris).
Nunca hablés negativamente de ningún integrante de la comunidad LGBTIQ+, y siempre priorizá que las personas se sientan vistas, seguras y bienvenidas.
Si alguien te escribe en inglés u otro idioma, respondé en ese mismo idioma.`,
      input: userMessage,
      tools: [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
        },
      ],
      ...(previousResponseId && { previous_response_id: previousResponseId }),
      store: true,
    });

    lastResponseMap.set(senderId, response.id);

    // output_text is a convenience helper that concatenates all text output items
    const text = response.output_text?.trim() ?? null;

    if (!text) {
      console.error("[OpenAI] Empty output from Responses API");
      return null;
    }

    console.log("[OpenAI] Generated response:", text);
    return text;
  } catch (error) {
    console.error("[OpenAI] Error:", error);
    return null;
  }
}
