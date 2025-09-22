import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ViewState, Account, Category, Payee, Tag, Project, Transaction, ReportData, Member, PayableBill, Stats } from '../types';
import { 
    accountsApi, categoriesApi, payeesApi, tagsApi, projectsApi, transactionsApi, 
    getAccountsWithBalance, getFinancialReport, getFutureIncomeTransactions, 
    getPaymentByTransactionId, getMembers, getPaymentsByTransaction,
    payableBillsApi, getDashboardStats, payBillWithTransactionData
} from '../services/api';
import { PageHeader, SubmitButton, DateField } from './common/PageLayout';
import { useToast } from './Notifications';
import { DollarSign, TrendingUp, TrendingDown, PlusCircle, Filter, FileText, ChevronRight, Briefcase, Paperclip, ClipboardPaste, Users, PieChart, Layers, Tag as TagIcon, Wallet, History, Sparkles, LoadingSpinner, AlertTriangle, Trash, Check, ChevronsUpDown, ArrowRightLeft } from './Icons';
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <ActionButton icon={<ArrowRightLeft className="h-5 w-5"/>} label="Transferir" onClick={() => setView({ name: 'transfer-form', returnView: currentView })} />
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
                    const amount = formatCurrency(link.amount);
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
                                            <span className="font-bold block text-sm">{formatCurrency(formState.amount)}</span>
                                            <span className="text-muted-foreground">Valor da Transação</span>
                                        </div>
                                         <div>
                                            <span className={`font-bold block text-sm ${linkedAmount === formState.amount ? 'text-success' : 'text-danger'}`}>{formatCurrency(linkedAmount)}</span>
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
                                                            <span className="text-sm font-mono">{formatCurrency(month.amount)}</span>
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
                                        {formatDate(b.dueDate)} - {b.description} ({formatCurrency(b.amount)})
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

export const TransactionViewerPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { transactionId, returnView } = viewState as { name: 'transaction-view', transactionId: string, returnView: ViewState };
    const [loading, setLoading] = useState(true);
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [lookupData, setLookupData] = useState<{
        accounts: Account[],
        categories: Category[],
        payees: Payee[],
        projects: Project[],
        tags: Tag[]
    }>({ accounts: [], categories: [], payees: [], projects: [], tags: [] });
    const toast = useToast();

    useEffect(() => {
        const loadData = async () => {
            if (!transactionId) {
                toast.error("ID da transação não encontrado.");
                setView(returnView);
                return;
            }
            setLoading(true);
            try {
                const [trx, accs, cats, pys, projs, tgs] = await Promise.all([
                    transactionsApi.getAll().then(all => all.find(t => t.id === transactionId)),
                    accountsApi.getAll(),
                    categoriesApi.getAll(),
                    payeesApi.getAll(),
                    projectsApi.getAll(),
                    tagsApi.getAll()
                ]);

                if (!trx) {
                    toast.error("Transação não encontrada.");
                    setView(returnView);
                    return;
                }

                setTransaction(trx);
                setLookupData({ accounts: accs, categories: cats, payees: pys, projects: projs, tags: tgs });

            } catch (error) {
                toast.error("Erro ao carregar dados da transação.");
                setView(returnView);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [transactionId, returnView, setView, toast]);

    const getLookupName = (type: 'account' | 'category' | 'payee' | 'project', id?: string): string => {
        if (!id) return 'N/A';
        const map: Map<string, string> = new Map(
            type === 'account' ? lookupData.accounts.map(i => [i.id, i.name]) :
            type === 'category' ? lookupData.categories.map(i => [i.id, i.name]) :
            type === 'payee' ? lookupData.payees.map(i => [i.id, i.name]) :
            lookupData.projects.map(i => [i.id, i.name])
        );
        return map.get(id) || 'Desconhecido';
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    if (!transaction) {
        return null; // Should have been redirected by useEffect
    }

    const isIncome = transaction.type === 'income';

    const DetailItem: React.FC<{ label: string, value: string }> = ({ label, value }) => (
        <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-base font-semibold text-foreground dark:text-dark-foreground">{value}</p>
        </div>
    );

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Detalhes da Transação" onBack={() => setView(returnView)} />
            <motion.div 
                className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* Header with description and amount */}
                <div className="text-center pb-4 border-b border-border dark:border-dark-border">
                    <p className="text-lg font-bold text-foreground dark:text-dark-foreground">{transaction.description}</p>
                    <p className={`text-3xl font-bold font-display ${isIncome ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDate(transaction.date)}</p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <DetailItem label="Conta" value={getLookupName('account', transaction.accountId)} />
                    <DetailItem label="Categoria" value={getLookupName('category', transaction.categoryId)} />
                    <DetailItem label="Beneficiário/Pagador" value={getLookupName('payee', transaction.payeeId)} />
                    <DetailItem label="Projeto" value={getLookupName('project', transaction.projectId)} />
                </div>
                
                {/* Comments */}
                {transaction.comments && (
                    <div className="pt-4 border-t border-border dark:border-dark-border">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Observações</p>
                        <p className="text-base text-foreground dark:text-dark-foreground whitespace-pre-wrap bg-background dark:bg-dark-background/60 p-3 rounded-md">
                            {transaction.comments}
                        </p>
                    </div>
                )}
                
                {/* Attachment */}
                {transaction.attachmentUrl && (
                     <div className="pt-4 border-t border-border dark:border-dark-border">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Anexo</p>
                         <motion.button
                            onClick={() => setView({ name: 'attachment-view', attachmentUrl: transaction.attachmentUrl!, returnView: viewState })}
                            className="inline-flex items-center gap-2 bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground font-semibold py-2 px-3 rounded-md text-sm hover:bg-muted dark:hover:bg-dark-muted transition-colors"
                            whileTap={{ scale: 0.95 }}
                        >
                            <Paperclip className="h-4 w-4" />
                            Visualizar Comprovante
                        </motion.button>
                    </div>
                )}
            </motion.div>
        </div>
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
    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

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

// FIX: Added the missing TransferFormPage component to handle fund transfers between accounts.
export const TransferFormPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { returnView = { name: 'financial' } } = viewState as { name: 'transfer-form', returnView: ViewState };
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();
    
    const [accounts, setAccounts] = useState<Account[]>([]);
    
    const [formState, setFormState] = useState({
        fromAccountId: '',
        toAccountId: '',
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        description: '',
    });
    
    const [amountStr, setAmountStr] = useState('R$ 0,00');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const accs = await accountsApi.getAll();
            setAccounts(accs);
            if (accs.length >= 2) {
                setFormState(s => ({ ...s, fromAccountId: accs[0].id, toAccountId: accs[1].id }));
            } else if (accs.length === 1) {
                setFormState(s => ({ ...s, fromAccountId: accs[0].id }));
            }
            setLoading(false);
        };
        loadData();
    }, []);
    
    const formatCurrencyForInput = (value: number): string => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const parseCurrencyFromInput = (formattedValue: string): number => {
        const numericString = formattedValue.replace(/\D/g, '');
        return numericString ? parseInt(numericString, 10) / 100 : 0;
    };
    
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = parseCurrencyFromInput(value);
        setFormState(prev => ({ ...prev, amount: numericValue }));
        setAmountStr(formatCurrencyForInput(numericValue));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formState.fromAccountId === formState.toAccountId) {
            toast.error('A conta de origem e destino não podem ser as mesmas.');
            return;
        }
        setIsSubmitting(true);
        try {
            const transferId = crypto.randomUUID();
            const date = new Date(formState.date + 'T12:00:00Z').toISOString();

            const categories = await categoriesApi.getAll();
            let transferCategory = categories.find(c => c.name.toLowerCase() === 'transferência');
            if (!transferCategory) {
                transferCategory = await categoriesApi.add({ name: 'Transferência', type: 'both' });
            }
            
            const fromAccountName = accounts.find(a => a.id === formState.fromAccountId)?.name || 'Conta desconhecida';
            const toAccountName = accounts.find(a => a.id === formState.toAccountId)?.name || 'Conta desconhecida';

            await transactionsApi.add({
                description: `Transferência para ${toAccountName}${formState.description ? ': ' + formState.description : ''}`,
                amount: formState.amount,
                date: date,
                type: 'expense',
                accountId: formState.fromAccountId,
                categoryId: transferCategory.id,
                transferId: transferId
            } as any);

            await transactionsApi.add({
                description: `Transferência de ${fromAccountName}${formState.description ? ': ' + formState.description : ''}`,
                amount: formState.amount,
                date: date,
                type: 'income',
                accountId: formState.toAccountId,
                categoryId: transferCategory.id,
                transferId: transferId
            } as any);

            toast.success("Transferência realizada com sucesso!");
            setView(returnView);
        } catch (error: any) {
            toast.error(`Falha ao realizar transferência: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Nova Transferência" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                 <div>
                    <label className={labelClass}>Descrição (Opcional)</label>
                    <input type="text" value={formState.description} onChange={e => setFormState(f => ({...f, description: e.target.value}))} className={inputClass}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Origem</label>
                        <select value={formState.fromAccountId} onChange={e => setFormState(f => ({...f, fromAccountId: e.target.value}))} required className={inputClass}>
                            <option value="">Selecione...</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className={labelClass}>Destino</label>
                        <select value={formState.toAccountId} onChange={e => setFormState(f => ({...f, toAccountId: e.target.value}))} required className={inputClass}>
                            <option value="">Selecione...</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Valor</label><input type="text" value={amountStr} onChange={handleAmountChange} required className={inputClass}/></div>
                    <DateField id="date" label="Data" value={formState.date} onChange={date => setFormState(f => ({ ...f, date }))} required />
                </div>
            </div>
             <div className="flex justify-center"><SubmitButton isSubmitting={isSubmitting} text="Confirmar Transferência" /></div>
        </form>
    );
};