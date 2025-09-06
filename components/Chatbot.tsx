import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState } from '../types';
import { PageHeader } from './common/PageLayout';
import { MessageSquare, Send, User, Paperclip } from './Icons';
import { getChatbotContextData } from '../services/api';

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


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const systemInstruction = `
Você é o "ChatGPTeuco", um assistente financeiro amigável e com um estilo visual para uma pequena organização.
Sua única fonte de conhecimento é um objeto JSON com os dados do sistema que será fornecido a cada pergunta.
Responda às perguntas do usuário baseando-se *exclusivamente* nos dados fornecidos.

**REGRAS DE FORMATAÇÃO:**
1.  **Geral:** Seja conciso, amigável e use emojis para tornar a leitura mais agradável.
2.  **Negrito:** Use **negrito** (com dois asteriscos) para destacar informações importantes como valores, totais, nomes de categorias, contas, projetos, membros e beneficiários.
3.  **Layout Mobile:** Formate as respostas para telas estreitas. Prefira quebrar a informação em várias linhas (layout vertical) em vez de frases longas.
    *   **Exemplo ruim (muito longo):** O saldo total de todas as contas, incluindo a Conta Corrente e a Poupança, é de R$ 1.234,56.
    *   **Exemplo bom (vertical):**
        O saldo total combinado é:
        **R$ 1.234,56** 💰
4.  **Valores Monetários:** Sempre formate como R$ 1.234,56.
5.  **Datas:** Sempre formate como DD/MM/AAAA.
6.  **Listas de Transações:** Para listas de transações, use o seguinte formato EXATO para cada item, incluindo os emojis e a seta:
    [EMOJI] [Descrição da Transação]
    ➝ **R$ [Valor]** | 📅 [Data] | [✅ Entrada / ❌ Saída]

    **Exemplo de lista de transações:**
    🏡 Categoria: **Casa**

    💸 Doação para portão
    ➝ **R$ 100,00** | 📅 04/09/2025 | ✅ Entrada

    🔒 Cadeado
    ➝ **R$ 25,00** | 📅 04/09/2025 | ❌ Saída

7.  **Comprovantes:** As transações podem incluir um campo 'comprovanteUrl'. Se uma transação tiver este campo e o usuário pedir, adicione o link especial [VISUALIZAR COMPROVANTE](url_do_comprovante) na linha abaixo da transação. Não exiba a URL diretamente.
8.  **Informação Ausente:** Se a resposta não estiver nos dados, diga educadamente que você não tem essa informação. Não invente nada.

Hoje é ${new Date().toLocaleDateString('pt-BR')}.
`;


export const Chatbot: React.FC<{ setView: (view: ViewState) => void }> = ({ setView }) => {
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'ai', text: 'Olá! Eu sou o ChatGPTeuco. Como posso ajudar a analisar os dados financeiros hoje?' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const userMessage = inputValue.trim();
        if (!userMessage || isLoading) return;

        setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
        setInputValue('');
        setIsLoading(true);

        try {
            const contextData = await getChatbotContextData();
            const prompt = `
                PERGUNTA DO USUÁRIO: "${userMessage}"

                DADOS DO SISTEMA (JSON):
                ${JSON.stringify(contextData, null, 2)}
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                }
            });

            const aiResponse = response.text;
            setMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            setMessages(prev => [...prev, { sender: 'ai', text: 'Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto">
            <div className="px-4 pt-4 sm:px-0 sm:pt-0">
                <PageHeader title="ChatGPTeuco" onBack={() => setView({ name: 'overview' })} />
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {messages.map((msg, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.sender === 'ai' && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <MessageSquare className="w-5 h-5 text-primary" />
                            </div>
                        )}
                        <div className={`max-w-md p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-lg' : 'bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-bl-lg'}`}>
                            {msg.sender === 'ai' ? (
                                <MessageContent text={msg.text} setView={setView} />
                            ) : (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            )}
                        </div>
                         {msg.sender === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-muted dark:bg-dark-muted flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                        )}
                    </motion.div>
                ))}
                {isLoading && (
                     <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 justify-start"
                    >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="w-5 h-5 text-primary" />
                        </div>
                        <div className="max-w-md p-3 rounded-2xl bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-bl-lg">
                           <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                           </div>
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-background dark:bg-dark-background">
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        placeholder="Pergunte sobre os dados..."
                        className="flex-1 w-full p-3 rounded-full bg-card dark:bg-dark-card border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !inputValue} className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:scale-100 active:scale-95">
                        <Send className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};