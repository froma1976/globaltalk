import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

export const getAiClient = () => {
    if (!ai) {
        const API_KEY = import.meta.env.VITE_API_KEY;

        if (!API_KEY) {
            throw new Error(
                "La API KEY no está configurada. Añádela como variable VITE_API_KEY en Vercel."
            );
        }

        ai = new GoogleGenAI({
            apiKey: API_KEY,
        });
    }

    return ai;
};
