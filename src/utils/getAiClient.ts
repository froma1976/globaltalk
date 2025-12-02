import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

export const getAiClient = (): GoogleGenAI => {
    if (!ai) {
        const API_KEY = import.meta.env.VITE_API_KEY;

        if (!API_KEY) {
            throw new Error("VITE_API_KEY no está configurada en el entorno.");
        }

        ai = new GoogleGenAI({ apiKey: API_KEY });
    }
    return ai;
};
