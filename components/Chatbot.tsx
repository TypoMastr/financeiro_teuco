import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState } from '../types';
import { PageHeader } from './common/PageLayout';
import { MessageSquare, Send, User, Paperclip, RotateCw } from './Icons';
import { getChatbotContextData } from '../services/api';
import { useToast } from './Notifications';

interface Message {
    sender: 'user' | 'ai';
    text: string;
}

const MessageContent: React.FC<{ text: string; setView: (view: ViewState) => void }> = ({ text, setView }) => {
    // Regex to find **bold** text or [attachment links](url)
    const parts = text.split(/(\*\*.*?\*\*)|(\[VISUALIZAR COMPROVANTE\]\(.*?\))/g);

    return (
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {parts.map((part, index) => {
                if (!part) return null;

                // Check for attachment link
                const attachmentMatch = part.match(/\[VISUALIZAR COMPROVANTE\]\((.*?)\)/);
                if (attachmentMatch) {
                    const url = attachmentMatch[1];
                    if (url) {
                        return (
                            <motion.button
                                key={index}
                                onClick={() => setView({ name: 'attachment-view', attachmentUrl: url, returnView: { name: 'chatbot' } })}
                                className="inline-flex items-center gap-2 mt-2 bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground font-semibold py-2 px-3 rounded-md text-sm hover:bg-muted dark:hover:bg-dark-muted transition-colors border border-border dark:border-dark-border"
                                whileTap={{ scale: 0.95 }}
                            >
                                <Paperclip className="h-4 w-4" />
                                Visualizar Comprovante
                            </motion.button>
                        );
                    }
                }

                // Check for bold text
                const boldMatch = part.match(/\*\*(.*?)\*\*/);
                if (boldMatch) {
                    return <strong key={index}>{boldMatch[1]}</strong>;
                }

                // Return plain text
                return part;
            })}
        </div>
    );
};


// Conditionally initialize GoogleGenAI to prevent crashing if API key is missing
let ai: GoogleGenAI | null = null;
const apiKey = process.env.API_KEY;

try {
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
    } else {
        console.error("API_KEY for Gemini is not configured. Chatbot functionality will be disabled.");
    }
} catch (error) {
    console.error("Failed to initialize GoogleGenAI, likely due to a missing API key:", error);
    ai = null; // Ensure ai is null if initialization fails
}


const systemInstruction = `
Você é o "ChatGPTeuco", um assistente financeiro amigável e com um estilo visual para o TEUCO.
Sua única fonte de conhecimento é um objeto JSON com os dados do sistema que será fornecido a cada pergunta.
Responda às perguntas do usuário baseando-se *exclusivamente* nos dados financeiros fornecidos. Seu objetivo é apoiar no controle financeiro e na gestão de membros, comunicando-se de forma respeitosa, acolhedora e culturalmente sensível.

**CONTEXTO DO CENTRO (TEUCO):**
- **Nome Completo:** Tenda Espiritualista de Umbanda Caboclo de Oxóssi (TEUCO).
- **Endereço:** Rua Maxwell, 386 - Andaraí, Rio de Janeiro.
- **Dirigente Principal:** Pai Carlinhos.
- **Site para Calendário:** Para perguntas sobre programação, giras e eventos, informe que a programação completa está em **www.teuco.com.br**, pois você só tem acesso aos dados financeiros.

**PERSONALIDADE E TOM DE VOZ:**
1.  **Tom Geral:** Seja sempre acolhedor, respeitoso, empático e positivo. Use frases curtas e claras, sem jargões técnicos.
2.  **Equilíbrio e Sutileza:** O seu papel principal é ser um assistente financeiro eficiente. A espiritualidade é um toque especial, não o foco principal.
    *   **Saudações Padrão:** Na maioria das vezes, inicie as conversas de forma direta e amigável, como "Olá! Em que posso ajudar hoje?".
    *   **Referências Espirituais (Uso Moderado):** *Apenas ocasionalmente*, para variar e criar uma conexão, você pode usar uma expressão leve e positiva da Umbanda. Não faça isso em todas as respostas para não soar repetitivo.
    *   **Encerramento:** Termine as respostas com "Axé 🙏" de forma natural, quando apropriado.
3.  **Contexto para Referências:** As referências espirituais se encaixam melhor em respostas sobre conquistas (ex: "Axé! Fechamos o mês no positivo!"), dificuldades (ex: "Com fé, vamos organizar essas pendências.") ou ao lidar com membros ("filhos de santo", "irmãos").
4.  **Restrições IMPORTANTES:** Mantenha as referências estritamente na **linha branca**. **NUNCA** mencione Candomblé, sacrifícios, amarrações ou qualquer tipo de magia que não seja para a caridade e o bem. O foco é sempre na luz.

**REGRAS DE COMUNICAÇÃO E FORMATAÇÃO:**
1.  **Geral:** Seja conciso, amigável e use emojis para tornar a leitura mais agradável.
2.  **Negrito:** Use **negrito** (com dois asteriscos) para destacar informações importantes como valores, totais, nomes, datas e status.
3.  **Layout Mobile:** Formate as respostas para telas estreitas, preferindo quebrar a informação em várias linhas (layout vertical).
    *   **Exemplo CORRETO:**
        💡 **Conta de Luz**
        ➝ **R$ 250,00**
        📅 06/09/2025
        ✅ Saída
4.  **Comunicação Financeira:** Seja direto e claro.
    *   "Entrada registrada: **R$ 100,00** (**João**)."
    *   "O saldo atual da conta **Principal** é de **R$ 2.350,00**."
5.  **Comunicação com Membros:** Seja respeitoso e evite julgamentos.
    *   Para pendências, use "contribuição em aberto" ou "pendente", nunca "está devendo". Ex: "A contribuição de **João** para **Setembro/2025** está pendente."
6.  **Links:** Para comprovantes, use o formato Markdown: [VISUALIZAR COMPROVANTE](URL_DO_COMPROVANTE)
7.  **Lógica:** Lembre-se que contas a pagar, mesmo que já tenham sido pagas, são **SAÍDAS** (despesas), não entradas.
8.  **Confirmação:** Antes de executar uma ação baseada em uma interpretação, confirme com o usuário. Ex: "Você confirma que deseja registrar a entrada de R$ 100,00 feita por Pedro? ✅"
`;

// FIX: Destructured the `setView` prop to make it available within the component scope.
export const Chatbot: React.FC<{ setView: (view: ViewState) => void }> = ({ setView }) => {
    const toast = useToast();
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'ai', text: 'Olá! Eu sou o ChatGPTeuco. Como posso ajudar a analisar os dados financeiros hoje?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isFetchingContext, setIsFetchingContext] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const contextDataCache = useRef<any>(null);

    const scrollToBottom = () => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages, isTyping]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [input]);

    const handleResetChat = () => {
        setMessages([{ sender: 'ai', text: 'Olá! Eu sou o ChatGPTeuco. Como posso ajudar a analisar os dados financeiros hoje?' }]);
        contextDataCache.current = null;
        toast.info("A conversa foi reiniciada.");
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping || !ai) return;

        const userMessage: Message = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);
        
        try {
            if (!contextDataCache.current) {
                setIsFetchingContext(true);
                contextDataCache.current = await getChatbotContextData();
                setIsFetchingContext(false);
            }

            const prompt = `
                DADOS FINANCEIROS ATUAIS (JSON):
                ${JSON.stringify(contextDataCache.current, null, 2)}

                ---
                PERGUNTA DO USUÁRIO:
                "${userMessage.text}"
            `;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ parts: [{ text: prompt }] }],
                config: { systemInstruction },
            });
            
            const aiMessage: Message = { sender: 'ai', text: response.text };
            setMessages(prev => [...prev, aiMessage]);

        } catch (error: any) {
            console.error("Error calling Gemini API:", error);
            const errorMessage: Message = { sender: 'ai', text: `Axé! Parece que tive um problema para me conectar com os guias. Por favor, tente novamente. (${error.message || 'Erro desconhecido'})` };
            setMessages(prev => [...prev, errorMessage]);
            toast.error("Falha na comunicação com a IA.");
        } finally {
            setIsTyping(false);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e as any);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-2xl mx-auto">
            <PageHeader title="ChatGPTeuco" onBack={() => setView({ name: 'overview' })} action={
                <motion.button onClick={handleResetChat} className="p-2.5 rounded-full bg-card dark:bg-dark-card border border-border dark:border-dark-border" whileTap={{ scale: 0.9, rotate: 90 }}>
                    <RotateCw className="h-5 w-5"/>
                </motion.button>
            }/>
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-4 p-2">
                <AnimatePresence>
                    {messages.map((msg, index) => (
                        <motion.div
                            key={index}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.sender === 'ai' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><MessageSquare className="h-5 w-5" /></div>}
                            <div className={`max-w-[85%] p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-bl-md'}`}>
                                <MessageContent text={msg.text} setView={setView} />
                            </div>
                            {msg.sender === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted dark:bg-dark-muted flex items-center justify-center text-muted-foreground"><User className="h-5 w-5" /></div>}
                        </motion.div>
                    ))}
                </AnimatePresence>
                {(isTyping || isFetchingContext) && (
                    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><MessageSquare className="h-5 w-5" /></div>
                        <div className="max-w-[85%] p-3 rounded-2xl bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-bl-md text-sm text-muted-foreground">
                            {isFetchingContext ? 'Consultando os dados do terreiro...' : 'Digitando...'}
                        </div>
                    </motion.div>
                )}
            </div>
            <div className="flex-shrink-0 sticky bottom-0 left-0 right-0 z-10 pt-2 px-2 bg-background dark:bg-dark-background">
                <form onSubmit={handleSend} className="flex items-end gap-2 max-w-2xl mx-auto">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pergunte..."
                        className="flex-1 text-sm p-2.5 rounded-lg bg-card dark:bg-dark-input border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all resize-none"
                        rows={1}
                        disabled={!ai}
                    />
                    <motion.button
                        type="submit"
                        disabled={!input.trim() || isTyping || !ai}
                        className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground transition-all"
                        whileTap={{ scale: 0.9 }}
                    >
                        <Send className="h-5 w-5" />
                    </motion.button>
                </form>
            </div>
        </div>
    );
};