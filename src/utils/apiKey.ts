import { Preferences } from "@capacitor/preferences";

export async function saveApiKey(apiKey: string) {
    await Preferences.set({
        key: "GEMINI_API_KEY",
        value: apiKey,
    });
}

export async function loadApiKey(): Promise<string | null> {
    const { value } = await Preferences.get({ key: "GEMINI_API_KEY" });
    return value;
}
