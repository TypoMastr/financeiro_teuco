import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ViewState, Account, Category, Payee, Tag, Project, Transaction, Member, PayableBill } from '../types';
import { 
    accountsApi, categoriesApi, payeesApi, tagsApi, projectsApi, transactionsApi, 
    getMembers, getPaymentsByTransaction,
    payableBillsApi, payBillWithTransactionData
} from '../services/api';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { DateField } from './common/FormControls';
import { useToast } from './Notifications';
import { Paperclip, ClipboardPaste, Sparkles, LoadingSpinner, AlertTriangle, Trash, Check, ChevronsUpDown } from './Icons';
import { GoogleGenAI } from '@google/genai';
import { useApp } from '../contexts/AppContext';

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

const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T12:00:00Z');
    return date.toLocaleDateString('pt-BR');
};

export const TransactionFormPage: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { transactionId, returnView = { name: 'financial' } } = viewState as { name: 'transaction-form', transactionId?: string, returnView?: ViewState };
    const isEdit = !!transactionId;
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formState, setFormState] = useState({
        description: '', amount: 0, date: new Date().toISOString().slice(0, 10), type: 'expense' as 'income' | 'expense',
        accountId: '', categoryId: '', payeeId: '', tagIds: [] as string[], projectId: '', comments: '',
        attachmentUrl: '', attachmentFilename: '', payableBillId: undefined as string | undefined
    });
    const [amountStr, setAmountStr] = useState('R$ 0,00');
    
    // States for multiple payment linking
    const [membersWithDues, setMembersWithDues] = useState<Member[]>([]);
    const [selectedPayments, setSelectedPayments] = useState<Map<string, { memberId: string, amount: number }>>(new Map());
    const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
    const [isLinkingPayments, setIsLinkingPayments] = useState(false);

    const [data, setData] = useState<{ accounts: Account[], categories: Category[], payees: Payee[], tags: Tag[], projects: Project[], bills: PayableBill[] }>({
        accounts: [], categories: [], payees: [], tags: [], projects: [], bills: []
    });
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [linkedBillId, setLinkedBillId] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);


    const formatCurrencyForInput = (value: number): string => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const parseCurrencyFromInput = (formattedValue: string): number => {
        const numericString = formattedValue.replace(/\D/g, '');
        return numericString ? parseInt(numericString, 10) / 100 : 0;
    };
    
    const filteredCategories = useMemo(() => data.categories.filter(c => c.type === formState.type || c.type === 'both'), [data.categories, formState.type]);

    const linkableBills = useMemo(() => {
        return data.bills
            .filter(b => b.status !== 'paid' || !b.transactionId)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }, [data.bills]);

    const handleBillLinkChange = (billId: string) => {
        setLinkedBillId(billId);
        if (billId) {
            const selectedBill = linkableBills.find(b => b.id === billId);
            if (selectedBill) {
                setFormState(prev => ({
                    ...prev,
                    description: selectedBill.description,
                    amount: selectedBill.amount,
                    payeeId: selectedBill.payeeId,
                    categoryId: selectedBill.categoryId,
                    comments: selectedBill.notes || '',
                    payableBillId: selectedBill.id,
                }));
                setAmountStr(formatCurrencyForInput(selectedBill.amount));
            }
        } else {
            // Unlink and reset form fields
            setFormState(prev => ({
                ...prev, description: '', amount: 0, payeeId: '', categoryId: '', comments: '', payableBillId: undefined,
            }));
            setAmountStr(formatCurrencyForInput(0));
        }
    };

    const handleAIFill = async () => {
        if (!ai) {
            toast.error("A funcionalidade de IA não está configurada.");
            return;
        }
        if (!formState.description) {
            toast.info("Digite uma descrição para a IA analisar.");
            return;
        }
    
        setIsAiProcessing(true);
        try {
            const recentTransactions = await transactionsApi.getRecent(30);
            const examples = recentTransactions.map(t => {
                const category = data.categories.find(c => c.id === t.categoryId)?.name || 'N/A';
                const payee = data.payees.find(p => p.id === t.payeeId)?.name || 'N/A';
                const account = data.accounts.find(a => a.id === t.accountId)?.name || 'N/A';
                const comments = t.comments ? `, Observações: "${t.comments}"` : '';
                return `- Descrição: "${t.description}", Categoria: "${category}", Beneficiário: "${payee}", Conta: "${account}"${comments}`;
            }).join('\n');

            const today = new Date().toLocaleDateString('pt-BR');
            const prompt = `
                Você é um assistente financeiro inteligente. Sua tarefa é extrair detalhes de uma descrição de texto livre e preencher um formulário.
                Aprenda com os padrões das transações passadas do usuário para fazer melhores previsões para categoria, beneficiário e conta.

                **Exemplos de Transações Recentes (Aprenda com estes):**
                ${examples}

                **Sua Tarefa:**
                1. Analise a nova entrada do usuário abaixo. A data de hoje é ${today}.
                2. **Interpretação de Datas:** Interprete termos relativos como "hoje", "ontem", "anteontem". Calcule a data absoluta no formato AAAA-MM-DD para o campo 'date'. Se o usuário mencionar apenas um dia (ex: "dia 15"), assuma que é do mês e ano atuais.
                3. **Descrição Padronizada:** Padronize a descrição (ex: "conta de luz" para "Conta de Luz - Setembro/2024").
                4. **Observações Detalhadas:** Crie um texto para o campo 'comments' que resuma a transação. Se o usuário usou um termo relativo de data, não o repita; em vez disso, inclua a data por extenso. Ex: "Pagamento realizado na quarta-feira, 12 de setembro de 2024."
                5. **Vincular Contas a Pagar:** Analise se a descrição corresponde a alguma conta a pagar em aberto. Se houver uma correspondência forte (ex: "luz setembro" com uma conta de "Light" com vencimento em setembro), retorne o 'id' da conta no campo 'billId'.
                
                **REGRAS ESPECIAIS AO VINCULAR UMA CONTA A PAGAR:**
                - Se você vincular uma conta ('billId'), a 'standardizedDescription' DEVE incluir a data de vencimento original. Ex: "Conta de Luz - Set/2024 (Venc. 15/09/2024)".
                - Nas 'comments', calcule e adicione a diferença entre a data do pagamento (que você extraiu) e o vencimento da conta. Ex: "... Pagamento realizado com 3 dias de atraso." ou "... Pagamento adiantado em 5 dias."

                Use as listas a seguir para encontrar os IDs correspondentes.
                Contas disponíveis: ${JSON.stringify(data.accounts.map(({ id, name }) => ({ id, name })))}
                Categorias disponíveis (para o tipo '${formState.type}'): ${JSON.stringify(filteredCategories.map(({ id, name }) => ({ id, name })))}
                Beneficiários disponíveis: ${JSON.stringify(data.payees.map(({ id, name }) => ({ id, name })))}
                Contas a pagar em aberto: ${JSON.stringify(linkableBills.map(b => ({ id: b.id, description: b.description, dueDate: b.dueDate, amount: b.amount, isEstimate: b.isEstimate })))}
    
                Nova Entrada do Usuário: "${formState.description}"
    
                Análise a entrada e retorne uma série de objetos JSON, um por linha, para cada campo que você identificar.
                Cada JSON DEVE ter a estrutura: {"field": "nomeDoCampo", "value": "valorDoCampo"}.
                Os campos possíveis para "field" são: "standardizedDescription", "amount", "date", "categoryId", "accountId", "payeeId", "comments", "billId".
                Comece a enviar os campos assim que os identificar.
            `;
            
            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
    
            let accumulatedText = '';
            let processedFields = new Set();
    
            const processLine = async (line: string) => {
                if (line.trim() === '') return;
                try {
                    const update = JSON.parse(line);
                    const { field, value } = update;
    
                    if (processedFields.has(field)) return;
                    processedFields.add(field);
    
                    await new Promise(resolve => setTimeout(resolve, 150));
    
                    if (field === 'billId' && value && linkableBills.some(b => b.id === value)) {
                        handleBillLinkChange(value);
                        const matchedBill = linkableBills.find(b => b.id === value)!;
                        toast.success(`Conta "${matchedBill.description}" vinculada pela IA!`);
                    } else if (field === 'amount') {
                        setFormState(prev => ({ ...prev, amount: value }));
                        setAmountStr(formatCurrencyForInput(value));
                    } else if (field === 'standardizedDescription') {
                        setFormState(prev => ({ ...prev, description: value }));
                    } else if (field === 'date' || field === 'categoryId' || field === 'accountId' || field === 'payeeId' || field === 'comments') {
                        setFormState(prev => ({ ...prev, [field]: value }));
                    }
                } catch (e) {
                    console.warn("Could not parse streamed JSON line:", line, e);
                }
            };
    
            for await (const chunk of responseStream) {
                accumulatedText += chunk.text;
                const lines = accumulatedText.split('\n');
                accumulatedText = lines.pop() || '';
    
                for (const line of lines) {
                    await processLine(line);
                }
            }
    
            if (accumulatedText.trim()) {
                await processLine(accumulatedText);
            }
            
            toast.success("Formulário preenchido pela IA!");
    
        } catch (error) {
            console.error("AI form fill error:", error);
            toast.error("A IA não conseguiu analisar a descrição.");
        } finally {
            setIsAiProcessing(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const [accs, cats, pys, tgs, projs, membersData, billsData] = await Promise.all([
                accountsApi.getAll(), categoriesApi.getAll(), payeesApi.getAll(), tagsApi.getAll(), projectsApi.getAll(), getMembers(), payableBillsApi.getAll()
            ]);
            setData({ accounts: accs, categories: cats, payees: pys, tags: tgs, projects: projs, bills: billsData });
            setMembersWithDues(membersData.filter(m => m.totalDue > 0).sort((a,b) => a.name.localeCompare(b.name)));
            
            if (isEdit && transactionId) {
                const transactions = await transactionsApi.getAll();
                const trx = transactions.find(t => t.id === transactionId);
                if (trx) {
                    setFormState({
                        description: trx.description, amount: trx.amount, date: trx.date.slice(0, 10), type: trx.type,
                        accountId: trx.accountId, categoryId: trx.categoryId, payeeId: trx.payeeId || '', tagIds: trx.tagIds || [],
                        projectId: trx.projectId || '', comments: trx.comments || '',
                        attachmentUrl: trx.attachmentUrl || '', attachmentFilename: trx.attachmentFilename || '',
                        payableBillId: trx.payableBillId
                    });
                    setAmountStr(formatCurrencyForInput(trx.amount));
                    if(trx.payableBillId) setLinkedBillId(trx.payableBillId);
                    
                    const payments = await getPaymentsByTransaction(trx.id);
                    if (payments && payments.length > 0) {
                        const initialSelected = new Map();
                        payments.forEach(p => {
                            const key = `${p.memberId}_${p.referenceMonth}`;
                            initialSelected.set(key, { memberId: p.memberId, amount: p.amount });
                        });
                        setSelectedPayments(initialSelected);
                        setIsLinkingPayments(true);
                    }
                }
            } else if (accs.length > 0) {
                setFormState(s => ({ ...s, accountId: accs[0].id }));
            }
            setLoading(false);
        };
        loadData();
    }, [isEdit, transactionId]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = parseCurrencyFromInput(value);
        setFormState(prev => ({ ...prev, amount: numericValue }));
        setAmountStr(formatCurrencyForInput(numericValue));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
        }
    };

    const handlePasteAttachment = async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], `colado-${Date.now()}.${imageType.split('/')[1]}`, { type: imageType });
                    setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
                    toast.success('Anexo colado com sucesso!');
                    return;
                }
            }
            toast.info('Nenhuma imagem encontrada na área de transferência.');
        } catch (err) {
            toast.error('Falha ao colar da área de transferência.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // New logic to generate/update comment based on linked payments
            const paymentLinks = Array.from(selectedPayments.values()).map(p => ({
                memberId: p.memberId,
                referenceMonth: Array.from(selectedPayments.keys()).find(key => selectedPayments.get(key) === p)!.split('_')[1],
                amount: p.amount,
            }));

            // Separate user comments from previously auto-generated ones
            const oldAutoCommentRegex = /Pagamento referente às mensalidades de:[\s\S]*/g;
            const userComments = (formState.comments || '').replace(oldAutoCommentRegex, '').trim();
            
            let finalComments = userComments;

            // Only generate a new comment if linking is active and multiple payments are selected
            if (isLinkingPayments && paymentLinks.length > 1) {
                const memberMap = new Map(membersWithDues.map(m => [m.id, m.name]));
                const details = paymentLinks.map(link => {
                    const memberName = memberMap.get(link.memberId) || 'Membro desconhecido';
                    const rawMonthName = new Date(link.referenceMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                    const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
                    const amount = formatCurrencyForInput(link.amount);
                    return `${memberName}\n${monthName}\n${amount}`;
                }).join('\n\n');

                const generatedComment = `Pagamento referente às mensalidades de:\n${details}`;
                
                // Combine user's original comments with the new auto-generated one
                finalComments = [userComments, generatedComment].filter(Boolean).join('\n\n');
            }
            
            const payload = { 
                ...formState, 
                comments: finalComments, // Use the final constructed comments
                date: new Date(formState.date + 'T12:00:00Z').toISOString() 
            };
            
            let newTransactionId = transactionId;
            let transactionDate = payload.date;
            
            if (!isEdit && linkedBillId) {
                const { warning } = await payBillWithTransactionData(linkedBillId, payload);
                if (warning) toast.info(warning);
                toast.success('Transação adicionada e conta paga com sucesso!');
            } else if (isEdit && transactionId) {
                const { data: updatedTrx, warning } = await transactionsApi.update(transactionId, payload);
                if (warning) toast.info(warning);
                transactionDate = updatedTrx.date;
                toast.success('Transação atualizada com sucesso!');
            } else {
                const { data: newTrx } = await transactionsApi.add(payload as any);
                newTransactionId = newTrx.id;
                transactionDate = newTrx.date;
                toast.success('Transação adicionada com sucesso!');
            }

            if (newTransactionId && formState.type === 'income') {
                await transactionsApi.setMultiplePaymentLinks(newTransactionId, paymentLinks, transactionDate);
            }
            setView(returnView);
        } catch (error: any) {
            toast.error(`Falha ao salvar: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTransaction = async () => {
        if (!transactionId) return;
        setIsSubmitting(true);
        try {
            await transactionsApi.remove(transactionId);
            toast.success('Transação excluída com sucesso!');
            setView(returnView);
        } catch (error: any) {
            toast.error(`Falha ao excluir: ${error.message}`);
        } finally {
            setIsSubmitting(false);
            setIsDeleteModalOpen(false);
        }
    };

    const handlePaymentSelection = (memberId: string, month: string, amount: number) => {
        const key = `${memberId}_${month}`;
        setSelectedPayments(prev => {
            const newMap = new Map(prev);
            if (newMap.has(key)) {
                newMap.delete(key);
            } else {
                newMap.set(key, { memberId, amount });
            }
            return newMap;
        });
    };

    const linkedAmount = useMemo(() => {
        return Array.from(selectedPayments.values()).reduce((sum, p) => sum + p.amount, 0);
    }, [selectedPayments]);
    
    const handleToggleLinking = (checked: boolean) => {
        setIsLinkingPayments(checked);
        if (!checked) {
            setSelectedPayments(new Map()); // Clear selections when hiding
        }
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
                <PageHeader title={isEdit ? "Editar Transação" : "Nova Transação"} onBack={() => setView(returnView)} />
                <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                    <div className="flex bg-muted/50 dark:bg-dark-muted/50 p-1 rounded-lg">
                        <button type="button" onClick={() => setFormState(f => ({ ...f, type: 'expense', categoryId: '' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.type === 'expense' ? 'bg-destructive text-destructive-foreground shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Despesa</button>
                        <button type="button" onClick={() => setFormState(f => ({ ...f, type: 'income', categoryId: '' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.type === 'income' ? 'bg-success text-white shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Receita</button>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className={labelClass}>Descrição</label>
                            <button type="button" onClick={handleAIFill} disabled={isAiProcessing || !formState.description} className="flex items-center gap-1.5 text-xs font-semibold text-primary disabled:opacity-50 disabled:cursor-not-allowed">
                                {isAiProcessing ? <LoadingSpinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                                Preencher com IA
                            </button>
                        </div>
                        <input type="text" value={formState.description} onChange={e => setFormState(f => ({...f, description: e.target.value}))} required className={inputClass}/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Valor</label><input type="text" value={amountStr} onChange={handleAmountChange} required className={inputClass}/></div>
                        <DateField id="date" label="" value={formState.date} onChange={date => setFormState(f => ({ ...f, date }))} required smallLabel/>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Conta</label><select value={formState.accountId} onChange={e => setFormState(f => ({...f, accountId: e.target.value}))} required className={inputClass}><option value="">Selecione...</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                        <div><label className={labelClass}>Categoria</label><select value={formState.categoryId} onChange={e => setFormState(f => ({...f, categoryId: e.target.value}))} required className={inputClass}><option value="">Selecione...</option>{filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    </div>
                    <div>
                        <label className={labelClass}>Beneficiário/Pagador (Opcional)</label>
                        <select value={formState.payeeId} onChange={e => setFormState(f => ({...f, payeeId: e.target.value}))} className={inputClass}>
                            <option value="">Nenhum</option>{data.payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    
                    {isEdit && formState.type === 'income' && (
                        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="link-payments-toggle"
                                    checked={isLinkingPayments}
                                    onChange={(e) => handleToggleLinking(e.target.checked)}
                                    className="h-4 w-4 rounded border-border dark:border-dark-border text-primary focus:ring-primary"
                                />
                                <label htmlFor="link-payments-toggle" className="text-sm font-semibold text-primary cursor-pointer">
                                    Vincular Pagamentos
                                </label>
                            </div>
                            <AnimatePresence>
                            {isLinkingPayments && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-3 overflow-hidden"
                                >
                                     <div className="flex justify-around text-center text-xs p-2 bg-background dark:bg-dark-background rounded-md">
                                        <div>
                                            <span className="font-bold block text-sm">{formatCurrencyForInput(formState.amount)}</span>
                                            <span className="text-muted-foreground">Valor da Transação</span>
                                        </div>
                                         <div>
                                            <span className={`font-bold block text-sm ${linkedAmount === formState.amount ? 'text-success' : 'text-danger'}`}>{formatCurrencyForInput(linkedAmount)}</span>
                                            <span className="text-muted-foreground">Valor Vinculado</span>
                                        </div>
                                    </div>
                                     <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                        {membersWithDues.map(member => (
                                             <div key={member.id}>
                                                <button type="button" onClick={() => setExpandedMembers(prev => { const next = new Set(prev); if (next.has(member.id)) { next.delete(member.id); } else { next.add(member.id); } return next; })} className="w-full flex justify-between items-center p-2 bg-background dark:bg-dark-background rounded-md font-semibold text-sm">
                                                    {member.name}
                                                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground"/>
                                                </button>
                                                {expandedMembers.has(member.id) && member.overdueMonths.map(month => {
                                                    const key = `${member.id}_${month.month}`;
                                                    const isSelected = selectedPayments.has(key);
                                                    return (
                                                        <div key={key} onClick={() => handlePaymentSelection(member.id, month.month, month.amount)} className="flex items-center justify-between p-2 pl-4 cursor-pointer hover:bg-muted dark:hover:bg-dark-muted rounded-md">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-4 h-4 rounded border-2 ${isSelected ? 'bg-primary border-primary' : 'border-border dark:border-dark-border'} flex items-center justify-center`}>
                                                                   {isSelected && <Check className="h-3 w-3 text-white"/>}
                                                                </div>
                                                                <span className="text-sm">{new Date(month.month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                                                            </div>
                                                            <span className="text-sm font-mono">{formatCurrencyForInput(month.amount)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                     </div>
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </div>
                    )}
                    
                    {formState.type === 'expense' && (
                        <div>
                            <label className={labelClass}>Vincular a Conta a Pagar (Opcional)</label>
                            <select value={linkedBillId} onChange={e => handleBillLinkChange(e.target.value)} className={inputClass} disabled={isEdit && !!formState.payableBillId}>
                                <option value="">Nenhuma</option>
                                {linkableBills.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {formatDate(b.dueDate)} - {b.description} ({formatCurrencyForInput(b.amount)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                     <div><label className={labelClass}>Observações</label><textarea value={formState.comments} onChange={e => setFormState(f => ({...f, comments: e.target.value}))} className={inputClass} rows={2}/></div>
                     <div><label className={labelClass}>Anexo</label>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <div className="flex gap-2">
                            <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} flex-1 text-left ${formState.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}>
                                <Paperclip className="h-4 w-4" />{formState.attachmentFilename || 'Escolher arquivo...'}
                            </button>
                            <button type="button" onClick={handlePasteAttachment} className="p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border text-muted-foreground hover:text-primary transition-colors">
                                <ClipboardPaste className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center items-center gap-4">
                    {isEdit && (
                        <motion.button
                            type="button"
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="bg-destructive/10 text-destructive font-semibold py-3 px-6 rounded-full hover:bg-destructive/20 transition-colors"
                            whileTap={{ scale: 0.98 }}
                        >
                            Excluir
                        </motion.button>
                    )}
                    <SubmitButton isSubmitting={isSubmitting} text="Salvar" />
                </div>
            </form>
            <DeleteConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteTransaction}
                description={formState.description}
            />
        </>
    );
};

const DeleteConfirmationModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; description: string }> = ({ isOpen, onClose, onConfirm, description }) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="bg-card dark:bg-dark-card rounded-xl p-6 w-full max-w-md shadow-lg border border-border dark:border-dark-border"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
                        </div>
                        <h3 className="mt-4 text-xl font-bold font-display text-foreground dark:text-dark-foreground">Excluir Transação?</h3>
                        <div className="mt-2">
                            <p className="text-sm text-muted-foreground">
                                Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
                            </p>
                            <p className="mt-2 text-sm font-semibold bg-muted dark:bg-dark-muted p-3 rounded-md">"{description}"</p>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-center gap-4">
                        <button type="button" onClick={onClose} className="inline-flex justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-semibold text-foreground dark:text-dark-foreground shadow-sm hover:bg-muted dark:hover:bg-dark-muted">
                            Cancelar
                        </button>
                        <button type="button" onClick={onConfirm} className="inline-flex justify-center rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm hover:bg-destructive/90">
                            Sim, Excluir
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);