import { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useToast } from '../components/Notifications';

// Conditionally initialize GoogleGenAI
let ai: GoogleGenAI | null = null;
const apiKey = process.env.API_KEY;

try {
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
    } else {
        console.error("API_KEY for Gemini is not configured. AI features will be disabled.");
    }
} catch (error) {
    console.error("Failed to initialize GoogleGenAI, likely due to a missing API key:", error);
    ai = null;
}

export const useAI = () => {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const generateSummary = useCallback(async (data: any, basePrompt: string) => {
        if (!ai) {
            toast.error("A funcionalidade de resumo por IA não está disponível.");
            return;
        }
        setLoading(true);
        setSummary(null);
        try {
            const fullPrompt = `${basePrompt}\n\nAqui estão os dados em formato JSON para sua análise:\n${JSON.stringify(data, null, 2)}`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
            });

            setSummary(response.text);
        } catch (error) {
            console.error("Error generating AI summary:", error);
            toast.error("Não foi possível gerar o resumo.");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    return { summary, loading, generateSummary };
};
