import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, LoadingSpinner, Sparkles } from './Icons';
import { useToast } from './Notifications';

interface AISummaryProps {
  data: any;
  prompt: string;
}

// Conditionally initialize GoogleGenAI to prevent crashing if API key is missing
let ai: GoogleGenAI | null = null;
const apiKey = process.env.API_KEY;

try {
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
    } else {
        console.error("API_KEY for Gemini is not configured. AI Summary functionality will be disabled.");
    }
} catch (error) {
    console.error("Failed to initialize GoogleGenAI for AI Summary:", error);
    ai = null;
}

export const AISummary: React.FC<AISummaryProps> = ({ data, prompt: basePrompt }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleGenerateSummary = async () => {
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
  };

  const formattedSummary = summary?.split(/(\*\*.*?\*\*)/g).map((part, index) => {
      if (part?.startsWith('**') && part?.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
  });

  return (
    <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
                <Bot className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold font-display text-foreground dark:text-dark-foreground">Resumo da IA</h3>
        </div>
        <motion.button
            onClick={handleGenerateSummary}
            disabled={loading}
            className="flex items-center gap-2 bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground font-semibold py-2 px-4 rounded-full text-sm hover:bg-muted dark:hover:bg-dark-muted transition-colors border border-border dark:border-dark-border disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
        >
            {loading ? <LoadingSpinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            <span>{loading ? 'Analisando...' : 'Gerar Resumo'}</span>
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {summary && (
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
            >
                <div className="mt-4 pt-4 border-t border-border dark:border-dark-border text-sm text-foreground dark:text-dark-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {formattedSummary}
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
