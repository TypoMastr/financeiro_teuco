import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ViewState, Account, Category, Payee, Tag, Project, Transaction, ReportData, Member, PayableBill, Stats } from '../types';
import { 
    accountsApi, categoriesApi, payeesApi, tagsApi, projectsApi, transactionsApi, 
    getAccountsWithBalance, getFinancialReport, getFutureIncomeTransactions, 
    updateTransactionAndPaymentLink, getPaymentByTransactionId, getMembers,
    payableBillsApi, getDashboardStats, payBillWithTransactionData
} from '../services/api';
import { PageHeader, SubmitButton, DateField } from './common/PageLayout';
import { useToast } from './Notifications';
import { DollarSign, TrendingUp, TrendingDown, PlusCircle, Filter, FileText, ChevronRight, Briefcase, Paperclip, ClipboardPaste, Users, PieChart, Layers, Tag as TagIcon, Wallet, History, Sparkles, LoadingSpinner, AlertTriangle, Trash } from './Icons';
import { AISummary } from './AISummary';
import { GoogleGenAI, Type } from '@google/genai';

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


// --- Helper Functions ---
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T12:00:00Z');
    return date.toLocaleDateString('pt-BR');
};

// --- Animation Variants ---
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
};

// --- Reusable Expandable Card Component ---
const ExpandableCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div
      layout
      variants={itemVariants}
      className="bg-card dark:bg-dark-card rounded-lg border border-border dark:border-dark-border overflow-hidden"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="text-primary">{icon}</div>
          <h3 className="text-lg font-bold font-display text-foreground dark:text-dark-foreground">{title}</h3>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronRight className="h-5 w-5 text-muted-foreground transform rotate-90" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.section
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { opacity: 1, height: 'auto' },
              collapsed: { opacity: 0, height: 0 },
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0">{children}</div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
};


// --- Monthly Summary Component ---
type SummaryItem = { id: string; name: string; income: number; expense: number; total: number; };
type MonthlySummaryData = {
    categories: SummaryItem[];
    projects: SummaryItem[];
    tags: SummaryItem[];
};

const MonthlySummarySection: React.FC<{
  summary: MonthlySummaryData;
  setView: (view: ViewState) => void;
}> = ({ summary, setView }) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'projects' | 'tags'>('categories');

  const tabs = [
    { key: 'categories' as const, label: 'Categorias', icon: <Layers className="h-4 w-4" />, data: summary.categories },
    { key: 'projects' as const, label: 'Projetos', icon: <Briefcase className="h-4 w-4" />, data: summary.projects },
    { key: 'tags' as const, label: 'Tags', icon: <TagIcon className="h-4 w-4" />, data: summary.tags },
  ];

  const activeData = tabs.find(tab => tab.key === activeTab)?.data || [];

  return (
    <div className="space-y-3">
      <div className="flex justify-center bg-muted/50 dark:bg-dark-muted/50 p-1 rounded-lg">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-2 text-sm font-semibold rounded-md transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === tab.key ? 'bg-card dark:bg-dark-card shadow' : ''}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
        >
            {activeData.length > 0 ? activeData.map(item => {
                const total = item.income + item.expense;
                const incomePercent = total > 0 ? (item.income / total) * 100 : 0;
                const expensePercent = total > 0 ? (item.expense / total) * 100 : 0;
                const filterType = activeTab === 'categories' ? 'category' : activeTab === 'projects' ? 'project' : 'tag';

                return (
                    <div 
                        key={item.id}
                        onClick={() => setView({ name: 'financial-detail', filterType, filterId: item.id, filterName: item.name })}
                        className="bg-background dark:bg-dark-background/60 p-3 rounded-lg cursor-pointer hover:bg-muted dark:hover:bg-dark-muted"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-sm">{item.name}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                        </div>
                        <div className="w-full bg-muted dark:bg-dark-muted h-2 rounded-full flex overflow-hidden">
                           <div className="bg-success" style={{ width: `${incomePercent}%` }}></div>
                           <div className="bg-danger" style={{ width: `${expensePercent}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center mt-2 text-xs">
                            <span className="text-success font-semibold">+{formatCurrency(item.income)}</span>
                            <span className="text-danger font-semibold">-{formatCurrency(item.expense)}</span>
                        </div>
                    </div>
                );
            }) : <p className="text-center text-sm text-muted-foreground py-4">Nenhuma atividade registrada este mês.</p>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};


// --- Main Financial Page ---
export const Financial: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [dataForMaps, setDataForMaps] = useState<{ categories: Category[], payees: Payee[], projects: Project[], tags: Tag[] }>({ categories: [], payees: [], projects: [], tags: [] });
    const isInitialLoad = useRef(true);
    const [aiSummaryData, setAiSummaryData] = useState<any>(null);

    const fetchData = useCallback(async (isUpdate = false) => {
        if (!isUpdate && isInitialLoad.current) setLoading(true);
        try {
            const [accs, transactions, cats, pys, projs, tgs, bills, stats, collaboratorsResponse] = await Promise.all([
                getAccountsWithBalance(),
                transactionsApi.getAll(),
                categoriesApi.getAll(),
                payeesApi.getAll(),
                projectsApi.getAll(),
                tagsApi.getAll(),
                payableBillsApi.getAll(),
                getDashboardStats(),
                fetch('https://teuco.com.br/colaboradores/partials/resumo.php').catch(e => null)
            ]);
            setAccounts(accs);
            setAllTransactions(transactions);
            setDataForMaps({ categories: cats, payees: pys, projects: projs, tags: tgs });
            
             // --- Prepare data for AI Summary ---
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            const thisMonthTransactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate >= startOfMonth && tDate <= endOfMonth;
            });
            const monthlyIncome = thisMonthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const monthlyExpense = thisMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

            let collaboratorsData = null;
            if (collaboratorsResponse && collaboratorsResponse.ok) {
                const data = await collaboratorsResponse.json();
                const parseCurrency = (value: string | number) => typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value || 0;
                collaboratorsData = {
                    totalArrecadadoMes: parseCurrency(data.total_arrecadado_mes),
                    projecaoProximoMes: parseCurrency(data.projecao_proximo_mes),
                };
            }

            setAiSummaryData({
                contasBancarias: accs.map(a => ({ nome: a.name, saldo: a.currentBalance })),
                resumoDoMes: {
                    receitasDoMes: monthlyIncome,
                    despesasDoMes: monthlyExpense,
                },
                contasAPagar: {
                    totalVencido: bills.filter(b => b.status === 'overdue').reduce((acc, b) => acc + b.amount, 0),
                    vencemEsteMes: bills.filter(b => b.status === 'pending' && new Date(b.dueDate).getMonth() === now.getMonth()).reduce((acc, b) => acc + b.amount, 0),
                },
                resumoMembros: {
                    valorTotalPendente: stats.totalOverdueAmount + stats.currentMonthPendingAmount,
                    percentualInadimplencia: stats.overduePercentage,
                },
                resumoColaboradores: collaboratorsData,
                projecoes: {
                    receitasProjetadas: stats.nextMonthProjectedRevenue,
                    despesasProjetadas: stats.projectedExpenses,
                },
                dataHoraAtual: new Date().toISOString()
            });


        } catch (error) {
            console.error("Failed to fetch financial data", error);
        } finally {
            if (!isUpdate || isInitialLoad.current) {
                setLoading(false);
                isInitialLoad.current = false;
            }
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(true), 60000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const totalBalance = useMemo(() => accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0), [accounts]);
    const recentTransactions = useMemo(() => allTransactions.sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5), [allTransactions]);
    const categoryMap = useMemo(() => new Map(dataForMaps.categories.map(c => [c.id, c.name])), [dataForMaps.categories]);

    const monthlySummary = useMemo<MonthlySummaryData>(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const thisMonthTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startOfMonth && tDate <= endOfMonth;
        });

        const categorySummary: { [key: string]: Omit<SummaryItem, 'id' | 'name'> } = {};
        const projectSummary: { [key: string]: Omit<SummaryItem, 'id' | 'name'> } = {};
        const tagSummary: { [key: string]: Omit<SummaryItem, 'id' | 'name'> } = {};

        thisMonthTransactions.forEach(t => {
            if (t.categoryId) {
                if (!categorySummary[t.categoryId]) categorySummary[t.categoryId] = { income: 0, expense: 0, total: 0 };
                categorySummary[t.categoryId][t.type] += t.amount;
                categorySummary[t.categoryId].total += t.amount;
            }
            if (t.projectId) {
                if (!projectSummary[t.projectId]) projectSummary[t.projectId] = { income: 0, expense: 0, total: 0 };
                projectSummary[t.projectId][t.type] += t.amount;
                projectSummary[t.projectId].total += t.amount;
            }
            if (t.tagIds) {
                t.tagIds.forEach(tagId => {
                    if (!tagSummary[tagId]) tagSummary[tagId] = { income: 0, expense: 0, total: 0 };
                    tagSummary[tagId][t.type] += t.amount;
                    tagSummary[tagId].total += t.amount;
                });
            }
        });
        
        const mapAndSort = (summaryObj: any, map: Map<string, string>) => Object.entries(summaryObj)
            .map(([id, data]) => ({ id, name: map.get(id) || 'Desconhecido', ...(data as any) }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        return {
            categories: mapAndSort(categorySummary, categoryMap),
            projects: mapAndSort(projectSummary, new Map(dataForMaps.projects.map(p => [p.id, p.name]))),
            tags: mapAndSort(tagSummary, new Map(dataForMaps.tags.map(t => [t.id, t.name]))),
        };
    }, [allTransactions, dataForMaps, categoryMap]);
    
    const currentView: ViewState = { name: 'financial' };

    const financialHealthPrompt = `
    Você é o "ChatGPTeuco", um assistente financeiro sênior para a tesouraria do TEUCO. Sua missão é fornecer uma visão panorâmica e estratégica ("bird's eye view") da saúde financeira da organização com base nos dados consolidados fornecidos em JSON.

    **Analise os seguintes pontos-chave:**

    1.  **Liquidez e Saldo (dados de \`contasBancarias\`):**
        *   Qual é o saldo total somando todas as contas?
        *   Existe alguma conta com saldo negativo ou perigosamente baixo?

    2.  **Fluxo de Caixa do Mês (\`resumoDoMes\`):**
        *   Compare as receitas e despesas do mês atual. O resultado é positivo ou negativo?

    3.  **Contas a Pagar (\`contasAPagar\`):**
        *   Qual é o valor total de contas já vencidas? Isso é um ponto de atenção?
        *   Qual é o valor total de contas que ainda vencem neste mês? Estamos preparados para cobrir esses custos com o saldo atual?

    4.  **Saúde das Mensalidades (\`resumoMembros\`):**
        *   Qual é o valor total pendente de mensalidades?
        *   Qual a porcentagem de membros com pendências? Isso representa um risco para a arrecadação?

    5.  **Receitas de Colaboradores (\`resumoColaboradores\`):**
        *   Como está a arrecadação de colaboradores este mês em comparação com a projeção para o próximo?

    6.  **Projeções Futuras (\`projecoes\`):**
        *   Compare o total de receitas projetadas com as despesas projetadas. A previsão é de superávit ou déficit?

    **Sua Resposta:**

    Estruture sua resposta em duas partes, usando um tom profissional, mas encorajador:

    *   **Diagnóstico Financeiro:** Um parágrafo conciso resumindo a situação atual. Comece com uma frase de impacto (ex: "A saúde financeira deste mês apresenta um cenário de atenção..." ou "Temos um panorama financeiro estável este mês..."). Destaque os pontos mais críticos (positivos e negativos) da sua análise.
    *   **Recomendações Estratégicas:** Uma lista curta (2 a 3 itens) com ações práticas e diretas. As recomendações devem ser baseadas nos problemas identificados.
        *   Se houver muitas contas vencidas: "Priorizar a quitação dos R$ X em contas vencidas para evitar juros."
        *   Se a inadimplência estiver alta: "Iniciar uma comunicação amigável com os X membros com mensalidades em aberto para entender a situação."
        *   Se as despesas estiverem superando as receitas: "Revisar os gastos nas categorias que mais impactaram o mês."

    **Formato:** Use **negrito** para valores e números importantes. Mantenha a linguagem clara e direta. Encerre com "Axé 🙏".
    `;

    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-center sm:justify-between gap-4">
                <div className="hidden sm:flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><DollarSign className="h-6 w-6 text-primary"/></div>
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground dark:text-dark-foreground">Financeiro</h2>
                </div>
                 <motion.button onClick={() => setView({ name: 'transaction-form', returnView: currentView })} className="bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-full flex items-center gap-2 active:scale-95 transition-transform shadow-btn dark:shadow-dark-btn flex-shrink-0" whileTap={{scale:0.98}}>
                    <PlusCircle className="h-5 w-5"/>
                    <span>Nova Transação</span>
                </motion.button>
            </div>
            
            <motion.div variants={itemVariants} className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border text-center">
                <p className="text-sm font-medium text-muted-foreground">SALDO TOTAL</p>
                <p className={`text-3xl font-bold font-display ${totalBalance < 0 ? 'text-danger' : 'text-foreground dark:text-dark-foreground'}`}>{formatCurrency(totalBalance)}</p>
            </motion.div>
            
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                <ExpandableCard title="Contas" icon={<Wallet className="h-5 w-5" />} defaultOpen={true}>
                    <div className="space-y-2">
                    {accounts.map(acc => (
                        <div key={acc.id} onClick={() => setView({ name: 'transaction-history', accountId: acc.id })} className="bg-background dark:bg-dark-background/60 p-3 rounded-lg flex justify-between items-center cursor-pointer hover:bg-muted dark:hover:bg-dark-muted">
                            <p className="font-semibold text-sm">{acc.name}</p>
                            <div className="flex items-center gap-2">
                                <p className={`font-semibold font-mono text-sm ${acc.currentBalance! < 0 ? 'text-danger' : ''}`}>{formatCurrency(acc.currentBalance!)}</p>
                                <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                            </div>
                        </div>
                    ))}
                    </div>
                </ExpandableCard>

                {aiSummaryData && (
                    <motion.div variants={itemVariants}>
                        <AISummary
                            data={aiSummaryData}
                            prompt={financialHealthPrompt}
                        />
                    </motion.div>
                )}

                 <ExpandableCard title="Resumo do Mês" icon={<PieChart className="h-5 w-5" />} defaultOpen={true}>
                    <MonthlySummarySection summary={monthlySummary} setView={setView} />
                </ExpandableCard>
            
                 <ExpandableCard title="Transações Recentes" icon={<History className="h-5 w-5" />} defaultOpen={true}>
                     <div className="space-y-2">
                     {recentTransactions.map(t => (
                        <div key={t.id} onClick={() => setView({ name: 'transaction-form', transactionId: t.id, returnView: currentView })} className="bg-background dark:bg-dark-background/60 p-3 rounded-lg flex justify-between items-center cursor-pointer hover:bg-muted dark:hover:bg-dark-muted">
                            <div>
                                <p className="font-semibold text-sm">{t.description}</p>
                                <p className="text-xs text-muted-foreground">{categoryMap.get(t.categoryId) || 'N/A'}</p>
                            </div>
                            <p className={`font-semibold text-sm ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>{formatCurrency(t.amount)}</p>
                        </div>
                     ))}
                     </div>
                     <button onClick={() => setView({ name: 'transaction-history', accountId: 'all' })} className="w-full text-center text-primary font-semibold py-2 text-sm mt-2">Ver todas</button>
                </ExpandableCard>

                <ExpandableCard title="Ações Rápidas" icon={<Users className="h-5 w-5" />} defaultOpen={true}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <ActionButton icon={<Filter className="h-5 w-5"/>} label="Relatório" onClick={() => setView({ name: 'financial-report-form', returnView: currentView })} />
                        <ActionButton icon={<TrendingUp className="h-5 w-5"/>} label="Rendas Futuras" onClick={() => setView({ name: 'future-income-view', returnView: currentView })} />
                        <ActionButton icon={<Briefcase className="h-5 w-5"/>} label="Lote Manual" onClick={() => setView({ name: 'batch-transaction-form', returnView: currentView })} />
                        <ActionButton icon={<Briefcase className="h-5 w-5"/>} label="Importar OFX" onClick={() => setView({ name: 'ofx-import-form', returnView: currentView })}/>
                    </div>
                </ExpandableCard>
            </motion.div>
        </div>
    );
};

const ActionButton: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void }> = ({ icon, label, onClick }) => (
    <button onClick={onClick} className="bg-background dark:bg-dark-background/60 p-4 rounded-lg flex flex-col items-center justify-center text-center gap-2 hover:bg-muted dark:hover:bg-dark-muted transition-colors">
        <div className="text-primary">{icon}</div>
        <span className="text-xs font-semibold">{label}</span>
    </button>
);

export const TransactionFormPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
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

    const [isPayment, setIsPayment] = useState(false);
    const [paymentLink, setPaymentLink] = useState({ memberId: '', referenceMonth: '' });
    const [allMembers, setAllMembers] = useState<Member[]>([]);

    const [data, setData] = useState<{ accounts: Account[], categories: Category[], payees: Payee[], tags: Tag[], projects: Project[], bills: PayableBill[] }>({
        accounts: [], categories: [], payees: [], tags: [], projects: [], bills: []
    });
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [linkedBillId, setLinkedBillId] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);


    const formatCurrencyForInput = (value: number): string => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const parseCurrencyFromInput = (formattedValue: string): number => {
        const numericString = formattedValue.replace(/[R$\s.]/g, '').replace(',', '.');
        return parseFloat(numericString) || 0;
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
            const today = new Date().toLocaleDateString('pt-BR');
            const prompt = `
                Analise a entrada do usuário para uma transação financeira e extraia os detalhes.
                A data de hoje é ${today}. Se o usuário mencionar apenas um dia (ex: "dia 15"), assuma que é do mês e ano atuais.
    
                Use as listas a seguir para encontrar os IDs correspondentes. Combine os nomes e retorne o ID exato.
    
                Contas disponíveis: ${JSON.stringify(data.accounts.map(({ id, name }) => ({ id, name })))}
                Categorias disponíveis (para o tipo '${formState.type}'): ${JSON.stringify(filteredCategories.map(({ id, name }) => ({ id, name })))}
                Beneficiários disponíveis: ${JSON.stringify(data.payees.map(({ id, name }) => ({ id, name })))}
                Contas a pagar em aberto: ${JSON.stringify(linkableBills.map(b => ({ id: b.id, description: b.description, dueDate: b.dueDate, amount: b.amount, isEstimate: b.isEstimate })))}
    
                Entrada do usuário: "${formState.description}"
    
                Analise a entrada e retorne os dados estruturados. Se a descrição do usuário corresponder a uma das contas a pagar (ex: "conta de luz setembro" com uma conta de "Light" com vencimento em setembro), retorne o 'id' da conta no campo 'billId'. Dê preferência a contas com o mesmo mês/ano. Se for uma estimativa, o valor pode ser diferente.
            `;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    standardizedDescription: { type: Type.STRING, description: 'Descrição limpa e padronizada (ex: "Conta de Luz - Setembro/2024").' },
                    amount: { type: Type.NUMBER, description: 'Valor numérico.' },
                    date: { type: Type.STRING, description: 'Data no formato AAAA-MM-DD.' },
                    categoryId: { type: Type.STRING, description: 'ID da categoria correspondente, ou null.' },
                    accountId: { type: Type.STRING, description: 'ID da conta correspondente, ou null.' },
                    payeeId: { type: Type.STRING, description: 'ID do beneficiário correspondente, ou null.' },
                    comments: { type: Type.STRING, description: 'Informações extras relevantes.' },
                    billId: { type: Type.STRING, description: 'ID da conta a pagar correspondente, ou null.' },
                }
            };
    
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema },
            });
    
            const result = JSON.parse(response.text);

            if (result.billId && linkableBills.some(b => b.id === result.billId)) {
                handleBillLinkChange(result.billId); // Sets bill's data first
                const matchedBill = linkableBills.find(b => b.id === result.billId)!;
                
                // Now, override with AI-extracted values
                setFormState(prev => ({
                    ...prev,
                    description: result.standardizedDescription || prev.description, // Use AI description
                    amount: result.amount || prev.amount, // Use AI amount
                    date: result.date || prev.date,
                    comments: result.comments || prev.comments,
                    accountId: result.accountId || prev.accountId, 
                }));
                setAmountStr(formatCurrencyForInput(result.amount || matchedBill.amount));
                toast.success(`Conta "${matchedBill.description}" vinculada pela IA!`);

            } else {
                setFormState(prev => ({
                    ...prev,
                    description: result.standardizedDescription || prev.description,
                    amount: result.amount || prev.amount,
                    date: result.date || prev.date,
                    categoryId: result.categoryId || prev.categoryId,
                    accountId: result.accountId || prev.accountId,
                    payeeId: result.payeeId || prev.payeeId,
                    comments: result.comments || prev.comments,
                }));
                setAmountStr(formatCurrencyForInput(result.amount || formState.amount));
                toast.success("Formulário preenchido pela IA!");
            }
    
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
            const [accs, cats, pys, tgs, projs, members, billsData] = await Promise.all([
                accountsApi.getAll(), categoriesApi.getAll(), payeesApi.getAll(), tagsApi.getAll(), projectsApi.getAll(), getMembers(), payableBillsApi.getAll()
            ]);
            setData({ accounts: accs, categories: cats, payees: pys, tags: tgs, projects: projs, bills: billsData });
            setAllMembers(members.filter(m => m.activityStatus === 'Ativo'));
            
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
                    
                    const payment = await getPaymentByTransactionId(trx.id);
                    if (payment) {
                        setIsPayment(true);
                        setPaymentLink({ memberId: payment.memberId, referenceMonth: payment.referenceMonth });
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
            const payload = { ...formState, date: new Date(formState.date + 'T12:00:00Z').toISOString() };
            
            if (!isEdit && linkedBillId) {
                const { warning } = await payBillWithTransactionData(linkedBillId, payload);
                if (warning) toast.info(warning);
                toast.success('Transação adicionada e conta paga com sucesso!');
            } else if (isEdit && transactionId) {
                if (isPayment) {
                    await updateTransactionAndPaymentLink(transactionId, payload, paymentLink);
                } else {
                    await transactionsApi.update(transactionId, payload);
                }
                toast.success('Transação atualizada com sucesso!');
            } else {
                await transactionsApi.add(payload as any);
                toast.success('Transação adicionada com sucesso!');
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

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
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
                        <DateField id="date" label="Data" value={formState.date} onChange={date => setFormState(f => ({ ...f, date }))} required />
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
                    {formState.type === 'expense' && (
                        <div>
                            <label className={labelClass}>Vincular a Conta a Pagar (Opcional)</label>
                            <select value={linkedBillId} onChange={e => handleBillLinkChange(e.target.value)} className={inputClass} disabled={isEdit && !!formState.payableBillId}>
                                <option value="">Nenhuma</option>
                                {linkableBills.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {formatDate(b.dueDate)} - {b.description} ({formatCurrency(b.amount)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    { isPayment && (
                        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 space-y-2">
                            <p className="text-sm font-semibold text-primary">Vinculado ao pagamento de mensalidade:</p>
                            <div className="text-sm">
                                <p><strong>Membro:</strong> {allMembers.find(m => m.id === paymentLink.memberId)?.name}</p>
                                <p><strong>Mês Ref:</strong> {new Date(paymentLink.referenceMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
                            </div>
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

export const ReportFiltersPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { returnView } = viewState as { name: 'financial-report-form', returnView: ViewState };
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(1)).toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        type: '' as 'income' | 'expense' | '',
        accountId: '',
        categoryId: ''
    });
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    useEffect(() => {
        const load = async () => {
            const [accs, cats] = await Promise.all([accountsApi.getAll(), categoriesApi.getAll()]);
            setAccounts(accs);
            setCategories(cats);
        };
        load();
    }, []);

    const handleGenerate = async () => {
        const reportFilters = {
            startDate: filters.startDate,
            endDate: filters.endDate,
            type: filters.type || undefined,
            categoryId: filters.categoryId || undefined,
            accountIds: filters.accountId ? [filters.accountId] : accounts.map(a => a.id),
        };
        const transactions = await getFinancialReport(reportFilters);
        const allData = { categories, payees: [], accounts };
        const report: ReportData = {
            type: 'financial',
            data: { transactions, allData },
            generatedAt: new Date().toISOString(),
            title: `Relatório de ${new Date(filters.startDate+'T12:00:00Z').toLocaleDateString('pt-BR')} a ${new Date(filters.endDate+'T12:00:00Z').toLocaleDateString('pt-BR')}`
        };
        setView({ name: 'report-view', report });
    };

    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Filtros do Relatório" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DateField id="startDate" label="Data de Início" value={filters.startDate} onChange={date => setFilters(f => ({ ...f, startDate: date }))} />
                    <DateField id="endDate" label="Data de Fim" value={filters.endDate} onChange={date => setFilters(f => ({ ...f, endDate: date }))} />
                </div>
                <div><label className={labelClass}>Conta</label><select value={filters.accountId} onChange={e => setFilters(f => ({...f, accountId: e.target.value}))} className={inputClass}><option value="">Todas</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div><label className={labelClass}>Tipo</label><select value={filters.type} onChange={e => setFilters(f => ({...f, type: e.target.value as any}))} className={inputClass}><option value="">Todos</option><option value="income">Receita</option><option value="expense">Despesa</option></select></div>
                <div><label className={labelClass}>Categoria</label><select value={filters.categoryId} onChange={e => setFilters(f => ({...f, categoryId: e.target.value}))} className={inputClass}><option value="">Todas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
            <div className="flex justify-center">
                <motion.button 
                    type="button"
                    onClick={handleGenerate}
                    className="bg-primary text-primary-foreground font-bold py-3 px-6 rounded-full hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30 text-base"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Gerar Relatório
                </motion.button>
            </div>
        </div>
    );
};

export const FutureIncomePage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { returnView } = viewState as { name: 'future-income-view', returnView: ViewState };
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getFutureIncomeTransactions().then(data => {
            setTransactions(data);
            setLoading(false);
        });
    }, []);

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Receitas Futuras" onBack={() => setView(returnView)} />
             <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border text-center">
                <p className="text-sm font-medium text-muted-foreground">TOTAL A RECEBER</p>
                <p className="text-3xl font-bold font-display text-success">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="space-y-3">
                {transactions.length > 0 ? transactions.map(t => (
                    <div key={t.id} className="bg-card dark:bg-dark-card p-3 rounded-lg border border-border dark:border-dark-border flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{t.description}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(t.date)}</p>
                        </div>
                        <p className="font-semibold text-success">{formatCurrency(t.amount)}</p>
                    </div>
                )) : (
                    <p className="text-center text-muted-foreground py-10">Nenhuma receita futura registrada.</p>
                )}
            </div>
        </div>
    );
};