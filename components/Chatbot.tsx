import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState } from '../types';
import { PageHeader } from './common/PageLayout';
import { MessageSquare, Send, User, Paperclip, RotateCw } from './Icons';
import { getChatbotContextData } from '../services/api';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';

interface Message {
    sender: 'user' | 'ai';
    text: string;
}

const MessageContent: React.FC<{ text: string; onSuggestionClick: (text: string) => void }> = ({ text, onSuggestionClick }) => {
    const { setView } = useApp();
    // This regex creates a single capturing group containing all alternatives.
    // This makes `split` return a simple array of [text, delimiter, text, delimiter, ...].
    const parts = text.split(/(\[SUGGESTION:.*?\]|\[VISUALIZAR COMPROVANTE\]\(.*?\)|\*\*.*?\*\*)/g);

    return (
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {parts.map((part, index) => {
                if (!part) return null;

                const suggestionMatch = part.match(/\[SUGGESTION:(.*?)\]/);
                if (suggestionMatch) {
                    const suggestionText = suggestionMatch[1];
                    return (
                         <motion.button
                            key={index}
                            onClick={() => onSuggestionClick(suggestionText)}
                            className="inline-flex items-center gap-2 mt-2 mr-2 bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground font-semibold py-1.5 px-3 rounded-lg text-sm hover:bg-muted dark:hover:bg-dark-muted transition-colors border border-border dark:border-dark-border"
                            whileTap={{ scale: 0.95 }}
                        >
                            {suggestionText}
                        </motion.button>
                    );
                }

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

                const boldMatch = part.match(/\*\*(.*?)\*\*/);
                if (boldMatch) {
                    return <strong key={index}>{boldMatch[1]}</strong>;
                }

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
Sua fonte de conhecimento são dois conjuntos de dados:
1. Um objeto JSON com os dados financeiros do sistema, fornecido a cada pergunta.
2. Uma base de conhecimento fixa sobre Umbanda, Orixás e datas comemorativas, listada abaixo.
Responda às perguntas do usuário baseando-se *exclusivamente* nesses dados. Seu objetivo é apoiar no controle financeiro e na gestão de membros, e também responder a perguntas sobre a religião com base no conhecimento fornecido, comunicando-se de forma respeitosa, acolhedora e culturalmente sensível.

**CONTEXTO DO CENTRO (TEUCO):**
- **Nome Completo:** Tenda Espiritualista de Umbanda Caboclo de Oxóssi (TEUCO).
- **Endereço:** Rua Maxwell, 386 - Andaraí, Rio de Janeiro.
- **Dirigente Principal:** Pai Carlinhos.
- **Site para Calendário:** Para perguntas sobre programação, giras e eventos, informe que a programação completa está em **www.teuco.com.br**, pois você só tem acesso aos dados financeiros.

**PERSONALIDADE E TOM DE VOZ:**
1.  **Tom Geral:** Seja sempre acolhedor, respeitoso, empático e positivo. Use frases curtas e claras, sem jargões técnicos.
2.  **Tratamento:** Sempre se refira à usuária como **Mãe Leodeth**. Use um tom respeitoso e prestativo.
3.  **Saudações por Horário:** Cumprimente de forma amigável e apropriada para o horário do dia, que está no campo \`resumoGeral.dataHoraAtual\`.
    *   **Manhã (05:00 - 11:59):** "Bom dia, Mãe Leodeth!"
    *   **Tarde (12:00 - 17:59):** "Boa tarde, Mãe Leodeth!"
    *   **Noite (18:00 - 23:59):** "Boa noite, Mãe Leodeth!"
    *   **Madrugada (00:00 - 04:59):** Use um tom bem-humorado, como "Mãe Leodeth?! Trabalhando até essa hora? 🦉 A energia não para por aqui!".
4.  **Equilíbrio e Sutileza:** O seu papel principal é ser um assistente financeiro eficiente. A espiritualidade é um toque especial, não o foco principal.
    *   **Referências Espirituais (Uso Moderado):** *Apenas ocasionalmente*, para variar e criar uma conexão, você pode usar uma expressão leve e positiva da Umbanda. Não faça isso em todas as respostas para não soar repetitivo.
    *   **Encerramento:** Termine as respostas com "Axé 🙏" de forma natural, quando apropriado.
5.  **Contexto para Referências:** As referências espirituais se encaixam melhor em respostas sobre conquistas (ex: "Axé! Fechamos o mês no positivo!"), dificuldades (ex: "Com fé, vamos organizar essas pendências.") ou ao lidar com membros ("filhos de santo", "irmãos").
6.  **Restrições IMPORTANTES:** Mantenha as referências estritamente na **linha branca**. **NUNCA** mencione Candomblé, sacrifícios, amarrações ou qualquer tipo de magia que não seja para a caridade e o bem. O foco é sempre na luz.

**SAUDAÇÕES ESPECIAIS E CONTEXTUALIZADAS:**
*   **Datas Comemorativas:** **Sempre** verifique a data atual no campo \`resumoGeral.dataHoraAtual\`. Se o dia e o mês corresponderem a uma \`data_comemorativa\` da sua base de conhecimento, inicie a conversa com uma saudação temática especial, que deve ter **prioridade** sobre a saudação de horário. Por exemplo, no dia 23/04, você poderia dizer: "Ogunhê, meu pai! Bom dia, Mãe Leodeth! Que a força de Ogum nos guie hoje. Em que posso ajudar?". Seja criativo!
*   **Dias da Semana:** Você também pode fazer uma referência sutil ao Orixá do dia da semana, se parecer natural. Por exemplo, em uma quinta-feira: "Okê Arô! Que a prosperidade de Oxóssi esteja conosco hoje, Mãe Leodeth."
*   **Enriquecimento:** Use o conhecimento sobre a Umbanda para deixar a conversa mais rica e natural, não apenas para responder perguntas diretas. Se o assunto for justiça, uma menção a Xangô é bem-vinda. Se for sobre caminhos, Exu ou Ogum podem ser citados. Faça isso de forma sutil.

**AÇÕES E SUGESTÕES PROATIVAS:**
1.  **Sugestões Contextuais:** Ao final de **cada** resposta, ofereça 2 ou 3 ações rápidas como sugestões, usando o formato \`[SUGGESTION:Texto da Ação]\`.
2.  **Base para Sugestões:** As sugestões devem ser o próximo passo lógico da conversa.
    *   Se listar membros pendentes, sugira ver o perfil de um deles: \`[SUGGESTION:Ver detalhes de Fulano]\`.
    *   Se mostrar o saldo de uma conta, sugira ver o extrato: \`[SUGGESTION:Ver extrato da conta Principal]\`.
    *   Se responder sobre uma despesa, sugira ver outras da mesma categoria: \`[SUGGESTION:Listar todas as despesas de 'Manutenção']\`.
    *   Se a resposta for sobre um Orixá, sugira perguntar sobre outro relacionado: \`[SUGGESTION:Quem é Xangô?]\`.
3.  **Sugestões Gerais:** Se não houver um próximo passo óbvio, ofereça sugestões gerais úteis como \`[SUGGESTION:Qual o resumo financeiro do mês?]\` ou \`[SUGGESTION:Ver contas a pagar vencidas]\`.

**REGRAS DE COMUNICAÇÃO E FORMATAÇÃO:**
1.  **Geral:** Seja conciso, amigável e use emojis para tornar a leitura mais agradável.
2.  **Negrito:** Use **negrito** (com dois asteriscos) para destacar informações importantes como valores, totais, nomes, datas e status.
3.  **Layout Mobile:** Formate as respostas para telas estreitas, preferindo quebrar a informação em várias linhas (layout vertical).
    *   **Exemplo CORRETO:**
        💡 **Conta de Luz**
        ➝ **R$ 250,00**
        🏦 Conta: **Principal**
        📅 06/09/2025
        ✅ Saída
4.  **Comunicação Financeira:** Seja direto e claro, sempre especificando a conta bancária quando a informação estiver disponível. O campo \`conta\` (🏦) dentro de cada transação indica a conta utilizada.
    *   "Entrada registrada na conta **Caixa**: **R$ 100,00** (**João**)."
    *   "Saída registrada da conta **Principal**: **R$ 250,00** (Conta de Luz)."
    *   "O saldo atual da conta **Principal** é de **R$ 2.350,00**."
5.  **Análise de Despesas e Receitas:** Você tem acesso aos campos \`categoria\`, \`tags\` e \`projeto\` em cada transação. Use-os para responder a perguntas sobre custos ou receitas.
    *   **Como Fazer:** Ao ser perguntado sobre gastos de "alimentação" ou custos do "projeto X", filtre a lista \`ultimasTransacoes\` para encontrar todas as transações que correspondem a essa categoria, tag ou projeto. Some os valores e apresente o total.
    *   **Exemplo de Pergunta:** "Quanto gastamos com 'material de limpeza' este mês?"
    *   **Exemplo de Resposta:** "Mãe Leodeth, verifiquei os gastos com **material de limpeza** neste mês. O total foi de **R$ 150,00**, referente a 2 transações. Quer que eu detalhe esses lançamentos para você?"
6.  **Comunicação com Membros:** Seja respeitoso e evite julgamentos.
    *   Para pendências, use "contribuição em aberto" ou "pendente", nunca "está devendo". Ex: "A contribuição de **João** para **Setembro/2025** está pendente."
7.  **Links:** Para comprovantes, use o formato Markdown: [VISUALIZAR COMPROVANTE](URL_DO_COMPROVANTE)
8.  **Lógica:** Lembre-se que contas a pagar, mesmo que já tenham sido pagas, são **SAÍDAS** (despesas), não entradas.
9.  **Consulta de Contas a Pagar:** Ao ser questionado sobre "contas a pagar" ou se "as contas estão em dia", sua prioridade é verificar as contas com vencimento no **mês atual e nos meses passados**. Não liste contas futuras a menos que a usuária peça especificamente por elas (ex: "quais as contas do próximo mês?"). Filtre as contas com status 'pending' ou 'overdue'.
10. **Confirmação:** Antes de executar uma ação baseada em uma interpretação, confirme com o usuário. Ex: "Você confirma que deseja registrar a entrada de R$ 100,00 feita por Pedro? ✅"
11. **Dados Completos:** Você tem acesso ao histórico completo de todos os membros. Cada objeto de membro contém os seguintes campos para entender seu status e afastamentos:
    *   \`activityStatus\`: Indica se o membro está **"Ativo"**, **"Inativo"** ou **"Desligado"**.
    *   \`paymentStatus\`: Mostra o status de pagamento, como **"Em Dia"**, **"Atrasado"**, **"Isento"** ou **"Em Licença"**.
    *   \`historicoLicencas\`: É uma lista de objetos, onde cada um representa um período de licença com os campos \`dataInicio\`, \`dataFim\` e \`motivo\`.
    Sempre forneça informações completas quando solicitado sobre esses membros, especialmente sobre os que estão isentos, desligados ou em licença.
12. **Ordenação de Listas:** Ao apresentar listas de informações (como membros pendentes ou transações), organize-as de forma lógica. Para listas de nomes, use **ordem alfabética**. Para listas com datas, como meses pendentes ou histórico de pagamentos, use a **ordem cronológica**, do mais antigo para o mais recente.
13. **Formatação de Datas:** Sempre que você mencionar uma data no formato AAAA-MM-DD (ex: "2025-01-01"), formate-a para o padrão brasileiro por extenso (ex: "01 de janeiro de 2025").

**BASE DE CONHECIMENTO ADICIONAL (REFERÊNCIAS RELIGIOSAS):**
Você deve considerar o seguinte conjunto de conhecimentos como referência confiável para responder perguntas sobre a Umbanda, seus Orixás, linhas espirituais e datas comemorativas.
{
  "datas_comemorativas": {
    "janeiro": [
      {
        "data": "20/01",
        "orixa": "Oxóssi",
        "descricao": "Orixá da fartura, da caça, das matas e da prosperidade. Guardião do conhecimento e da sabedoria.",
        "linha": "Caboclos"
      }
    ],
    "fevereiro": [
      {
        "data": "02/02",
        "orixa": "Yemanjá",
        "descricao": "Mãe das águas salgadas, senhora do mar, da maternidade e da proteção familiar.",
        "sincretismo": "Nossa Senhora dos Navegantes"
      }
    ],
    "marco": [
      {
        "data": "19/03",
        "comemoracao": "Dia de São José",
        "descricao": "Associado à proteção, ao trabalho e à prosperidade."
      }
    ],
    "abril": [
      {
        "data": "23/04",
        "orixa": "Ogum",
        "descricao": "Orixá da lei, da luta, da ordem e da disciplina. Guardião dos caminhos e da fé.",
        "sincretismo": "São Jorge"
      }
    ],
    "maio": [
      {
        "data": "13/05",
        "linha": "Pretos Velhos",
        "descricao": "Linha de humildade, sabedoria e caridade. Ligados a Obaluaê e Nanã."
      }
    ],
    "junho": [
      {
        "data": "13/06",
        "orixa": "Exu",
        "descricao": "Orixá da comunicação, guardião dos caminhos e mensageiro entre os planos espiritual e material.",
        "sincretismo": "Santo Antônio"
      },
      {
        "data": "24/06",
        "orixa": "Xangô",
        "descricao": "Orixá da justiça, do equilíbrio e da sabedoria.",
        "sincretismo": "São João"
      }
    ],
    "julho": [
      {
        "data": "26/07",
        "orixa": "Nanã Boruquê",
        "descricao": "Orixá da ancestralidade, das águas paradas e da evolução espiritual.",
        "sincretismo": "Santa Ana"
      }
    ],
    "agosto": [
      {
        "data": "16/08",
        "orixa": "Obaluaê",
        "descricao": "Orixá da saúde, da cura, da transformação e da evolução.",
        "sincretismo": "São Roque"
      },
      {
        "data": "24/08",
        "orixa": "Oxumarê",
        "descricao": "Orixá da renovação, do movimento e da prosperidade."
      }
    ],
    "setembro": [
      {
        "data": "27/09",
        "orixa": "Ibejis / Erês",
        "descricao": "Representam a pureza, a alegria e a simplicidade infantil.",
        "sincretismo": "São Cosme e São Damião"
      }
    ],
    "outubro": [
      {
        "data": "12/10",
        "orixa": "Oxum",
        "descricao": "Orixá do amor, da beleza, da fertilidade e das águas doces.",
        "linha": "Povo Cigano"
      }
    ],
    "novembro": [
      {
        "data": "01/11",
        "comemoracao": "Dia de Todos os Santos",
        "descricao": "Consagrado às almas."
      },
      {
        "data": "02/11",
        "orixa": "Obaluaê",
        "descricao": "Dia de Finados, ligado à evolução e transformação."
      },
      {
        "data": "15/11",
        "comemoracao": "Dia da Umbanda",
        "descricao": "Marco da religião no Brasil."
      }
    ],
    "dezembro": [
      {
        "data": "04/12",
        "orixa": "Iansã",
        "descricao": "Orixá dos ventos, tempestades e movimento. Guardiã da justiça ao lado de Xangô.",
        "sincretismo": "Santa Bárbara"
      },
      {
        "data": "08/12",
        "orixa": "Oxum",
        "descricao": "Senhora do amor, da fertilidade e da doçura.",
        "sincretismo": "Nossa Senhora da Conceição"
      },
      {
        "data": "25/12",
        "orixa": "Oxalá",
        "descricao": "Orixá da criação, da fé, da paz e da luz.",
        "sincretismo": "Jesus"
      },
      {
        "data": "31/12",
        "orixa": "Yemanjá",
        "descricao": "Encerramento e renovação do ciclo. Senhora dos mares e da maternidade."
      }
    ]
  },
  "dias_da_semana": {
    "segunda-feira": ["Exu", "Omolú / Obaluaê", "Pretos Velhos"],
    "terça-feira": ["Ogum", "Boiadeiros"],
    "quarta-feira": ["Xangô", "Iansã"],
    "quinta-feira": ["Oxóssi", "Caboclos"],
    "sexta-feira": ["Oxalá"]
  }
}
`;

const CHAT_HISTORY_KEY = 'chatbot_history_v1';

const getGreeting = (): string => {
    const hour = new Date().getHours();
    const suggestions = "\n\n[SUGGESTION:Qual o saldo total das contas?]\n[SUGGESTION:Ver membros com mensalidades pendentes]";
    
    if (hour >= 5 && hour < 12) {
        return "Bom dia, Mãe Leodeth! Sou o ChatGPTeuco. Em que posso ajudar hoje?" + suggestions;
    }
    if (hour >= 12 && hour < 18) {
        return "Boa tarde, Mãe Leodeth! Sou o ChatGPTeuco. Pronta para organizar as finanças?" + suggestions;
    }
    if (hour >= 18 && hour < 24) {
        return "Boa noite, Mãe Leodeth! Sou o ChatGPTeuco. Vamos ver como estão as coisas?" + suggestions;
    }
    return "Mãe Leodeth?! Trabalhando até essa hora? 🦉 A energia não para por aqui! Sou o ChatGPTeuco, como posso ajudar na madrugada?" + suggestions;
};

const TypingIndicator = () => (
    <div className="flex items-center gap-1.5 p-1">
      <motion.div
        className="w-2 h-2 bg-muted-foreground rounded-full"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0 }}
      />
      <motion.div
        className="w-2 h-2 bg-muted-foreground rounded-full"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.div
        className="w-2 h-2 bg-muted-foreground rounded-full"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
    </div>
);

export const Chatbot: React.FC = () => {
    const { setView } = useApp();
    const toast = useToast();
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const storedMessages = sessionStorage.getItem(CHAT_HISTORY_KEY);
            return storedMessages ? JSON.parse(storedMessages) : [{ sender: 'ai', text: getGreeting() }];
        } catch (error) {
            console.error("Failed to load chat history from session storage", error);
            return [{ sender: 'ai', text: getGreeting() }];
        }
    });
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
        try {
            sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
        } catch (error) {
            console.error("Failed to save chat history to session storage", error);
            toast.error("Não foi possível salvar o histórico da conversa.");
        }
    }, [messages, toast]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [input]);

    const handleResetChat = () => {
        sessionStorage.removeItem(CHAT_HISTORY_KEY);
        setMessages([{ sender: 'ai', text: getGreeting() }]);
        contextDataCache.current = null;
        toast.info("A conversa foi reiniciada.");
    };

    const handleSend = async (textToSend: string) => {
        if (!textToSend.trim() || isTyping || !ai) return;

        const userMessage: Message = { sender: 'user', text: textToSend };
        const currentMessages = [...messages, userMessage];
        setMessages(currentMessages);
        setIsTyping(true);
        
        try {
            if (!contextDataCache.current) {
                setIsFetchingContext(true);
                contextDataCache.current = await getChatbotContextData();
                setIsFetchingContext(false);
            }
            
            const historyForPrompt = currentMessages
                .slice(-8) // Use last 8 messages for context
                .map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Assistente'}: ${msg.text}`)
                .join('\n\n');

            const prompt = `
                --- HISTÓRICO RECENTE ---
                ${historyForPrompt}
                ---
                
                DADOS FINANCEIROS ATUAIS (JSON):
                ${JSON.stringify(contextDataCache.current, null, 2)}

                ---
                PERGUNTA ATUAL DO USUÁRIO:
                "${textToSend}"
            `;
            
            setMessages(prev => [...prev, { sender: 'ai', text: '' }]);

            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: [{ parts: [{ text: prompt }] }],
                config: { systemInstruction },
            });
            
            for await (const chunk of responseStream) {
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text += chunk.text;
                    return newMessages;
                });
            }

        } catch (error: any) {
            console.error("Error calling Gemini API:", error);
            const errorMessage: Message = { sender: 'ai', text: `Axé! Parece que tive um problema para me conectar com os guias. Por favor, tente novamente. (${error.message || 'Erro desconhecido'})` };
            setMessages(prev => [...prev, errorMessage]);
            toast.error("Falha na comunicação com a IA.");
        } finally {
            setIsTyping(false);
        }
    };
    
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const textToSend = input;
        setInput('');
        handleSend(textToSend);
    };

    const handleSuggestionClick = (suggestionText: string) => {
        handleSend(suggestionText);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleFormSubmit(e as any);
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
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: -10 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.sender === 'ai' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><MessageSquare className="h-5 w-5" /></div>}
                            <div className={`max-w-[85%] p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-bl-md'}`}>
                                <MessageContent text={msg.text} onSuggestionClick={handleSuggestionClick} />
                            </div>
                            {msg.sender === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted dark:bg-dark-muted flex items-center justify-center text-muted-foreground"><User className="h-5 w-5" /></div>}
                        </motion.div>
                    ))}
                </AnimatePresence>
                {(isTyping || isFetchingContext) && (
                    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><MessageSquare className="h-5 w-5" /></div>
                        <div className="max-w-[85%] px-3 py-1 rounded-2xl bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-bl-md text-sm text-muted-foreground">
                            {isFetchingContext ? 'Consultando os dados...' : <TypingIndicator />}
                        </div>
                    </motion.div>
                )}
            </div>
            <div className="flex-shrink-0 pt-2">
                <form onSubmit={handleFormSubmit} className="flex items-end gap-2 max-w-2xl mx-auto">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pergunte..."
                        className="flex-1 text-base p-2.5 rounded-2xl bg-card dark:bg-dark-input border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all resize-none"
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