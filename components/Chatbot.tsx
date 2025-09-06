import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState } from '../types';
import { PageHeader } from './common/PageLayout';
// FIX: Add X icon to imports to resolve "Cannot find name 'X'" error.
import { MessageSquare, Send, User, Paperclip, RotateCw, Mic, X } from './Icons';
import { getChatbotContextData } from '../services/api';
import { useToast } from './Notifications';

// FIX: Add type declarations for the non-standard Web Speech API to resolve TypeScript errors.
// This prevents "Cannot find name 'SpeechRecognition'" and related property access errors on `window`.
interface SpeechRecognition {
    stop(): void;
    start(): void;
    lang: string;
    interimResults: boolean;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
}

interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
}

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

Hoje é ${new Date().toLocaleString('pt-BR')}.
`;

const SESSION_STORAGE_KEY = 'chatbot_messages_history';

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });
    
export const Chatbot: React.FC<{ setView: (view: ViewState) => void }> = ({ setView }) => {
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const storedMessages = sessionStorage.getItem(SESSION_STORAGE_KEY);
            return storedMessages 
                ? JSON.parse(storedMessages) 
                : [{ sender: 'ai', text: 'Olá! Eu sou o ChatGPTeuco. Como posso ajudar a analisar os dados financeiros hoje?' }];
        } catch (error) {
            console.error("Failed to parse messages from sessionStorage", error);
            return [{ sender: 'ai', text: 'Olá! Eu sou o ChatGPTeuco. Como posso ajudar a analisar os dados financeiros hoje?' }];
        }
    });
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const toast = useToast();

    // Multimodal and Voice State
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [imageData, setImageData] = useState<{ mimeType: string, data: string } | null>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        try {
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
        } catch (error) {
            console.error("Failed to save messages to sessionStorage", error);
        }
        scrollToBottom();
    }, [messages]);

    const handleClearChat = () => {
        setMessages([{ sender: 'ai', text: 'Olá! Eu sou o ChatGPTeuco. Como posso ajudar a analisar os dados financeiros hoje?' }]);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        toast.info("A conversa foi reiniciada.");
    };
    
    const speak = (text: string) => {
        // Remove markdown for cleaner speech
        const cleanText = text.replace(/\*\*|\[.*?\]\(.*?\)/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'pt-BR';
        speechSynthesis.speak(utterance);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const userMessage = inputValue.trim();
        if ((!userMessage && !imageData) || isLoading || !ai) return;

        const currentMessages = [...messages];
        if (userMessage) {
            currentMessages.push({ sender: 'user', text: userMessage });
        }
        setMessages(currentMessages);
        setInputValue('');
        setIsLoading(true);

        try {
            const contextData = await getChatbotContextData();
            const prompt = `
                PERGUNTA DO USUÁRIO: "${userMessage || 'Analise esta imagem.'}"

                DADOS DO SISTEMA (JSON):
                ${JSON.stringify(contextData, null, 2)}
            `;
            
            const contents = { parts: [] as any[] };
            if (imageData) {
                contents.parts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.data } });
            }
            if (userMessage) {
                contents.parts.push({ text: prompt });
            }
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: contents,
                config: {
                    systemInstruction: systemInstruction,
                }
            });

            const aiResponse = response.text;
            setMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
            speak(aiResponse);

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            const errorText = 'Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.';
            setMessages(prev => [...prev, { sender: 'ai', text: errorText }]);
            speak(errorText);
        } finally {
            setIsLoading(false);
            setImageData(null);
            setImagePreviewUrl(null);
        }
    };
    
    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64Data = await fileToBase64(file);
            setImageData({ mimeType: file.type, data: base64Data });
            setImagePreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        setImageData(null);
        setImagePreviewUrl(null);
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleToggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                toast.error('Seu navegador não suporta reconhecimento de voz.');
                return;
            }
            const recognition = new SpeechRecognition();
            recognition.lang = 'pt-BR';
            recognition.interimResults = false;
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInputValue(transcript);
                // Automatically send message after speech ends
                setTimeout(() => handleSendMessage(), 100);
            };
            recognition.onerror = (event) => {
                toast.error(`Erro de reconhecimento: ${event.error}`);
                setIsListening(false);
            };
            recognition.start();
            recognitionRef.current = recognition;
        }
    };


    if (!apiKey) {
        return (
            <div className="flex flex-col h-full max-w-3xl mx-auto">
                <div className="px-4 pt-4 sm:px-0 sm:pt-0">
                    <PageHeader title="ChatGPTeuco" onBack={() => setView({ name: 'overview' })} />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-bold text-foreground dark:text-dark-foreground">Chat Indisponível</h3>
                    <p className="text-muted-foreground mt-2">
                        A funcionalidade de chat com IA não está disponível no momento devido a um problema de configuração do ambiente.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto">
            <div className="px-4 pt-4 sm:px-0 sm:pt-0">
                <PageHeader
                    title="ChatGPTeuco"
                    onBack={() => setView({ name: 'overview' })}
                    action={
                        <motion.button
                            onClick={handleClearChat}
                            className="bg-card dark:bg-dark-card p-2.5 rounded-full border border-border dark:border-dark-border text-muted-foreground hover:text-primary transition-colors"
                            whileTap={{ scale: 0.9 }}
                            aria-label="Nova conversa"
                        >
                            <RotateCw className="h-5 w-5" />
                        </motion.button>
                    }
                />
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
                 {imagePreviewUrl && (
                    <div className="relative inline-block mb-2">
                        <img src={imagePreviewUrl} alt="Preview" className="h-20 w-20 object-cover rounded-md" />
                        <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 bg-card dark:bg-dark-card text-muted-foreground rounded-full p-0.5 border border-border dark:border-dark-border">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}
                {isListening && <div className="text-center text-sm text-primary mb-2 font-semibold animate-pulse">Ouvindo...</div>}
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                     <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImageChange} className="hidden" />
                     <button type="button" onClick={() => imageInputRef.current?.click()} className="w-12 h-12 bg-card dark:bg-dark-card text-muted-foreground rounded-full flex items-center justify-center border border-border dark:border-dark-border transition-colors hover:bg-muted dark:hover:bg-dark-muted" aria-label="Anexar imagem">
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        placeholder="Pergunte ou anexe uma imagem..."
                        className="flex-1 w-full p-3 rounded-full bg-card dark:bg-dark-card border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        disabled={isLoading}
                    />
                     <button type="button" onClick={handleToggleListening} className={`w-12 h-12 rounded-full flex items-center justify-center border border-border dark:border-dark-border transition-all ${isListening ? 'bg-red-500 text-white' : 'bg-card dark:bg-dark-card text-muted-foreground'}`} aria-label="Usar microfone">
                        <Mic className="w-5 h-5" />
                    </button>
                    <button type="submit" disabled={isLoading || (!inputValue && !imageData)} className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:scale-100 active:scale-95">
                        <Send className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};