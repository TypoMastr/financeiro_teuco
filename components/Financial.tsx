import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ViewState, Account, Category, Payee, Tag, Project, Transaction, ReportData, Member, PayableBill, Stats } from '../types';
import { 
    accountsApi, categoriesApi, payeesApi, tagsApi, projectsApi, transactionsApi, 
    getAccountsWithBalance, getFinancialReport, getFutureIncomeTransactions, 
    getPaymentByTransactionId, getMembers, getPaymentsByTransaction,
    payableBillsApi, getDashboardStats, payBillWithTransactionData
} from '../services/api';
import { useToast } from './Notifications';
import { DollarSign, TrendingUp, TrendingDown, PlusCircle, Filter, FileText, ChevronRight, Briefcase, Paperclip, ClipboardPaste, Users, PieChart, Layers, Tag as TagIcon, Wallet, History, Sparkles, LoadingSpinner, AlertTriangle, Trash, Check, ChevronsUpDown, ArrowRightLeft } from './Icons';
import { AISummary } from './AISummary';
import { GoogleGenAI, Type } from '@google/genai';
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


// --- Helper Functions ---
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
}> = ({ summary }) => {
  const { setView } = useApp();
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
export const Financial: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [thisMonthTransactions, setThisMonthTransactions] = useState<Transaction[]>([]);
    const [dataForMaps, setDataForMaps] = useState<{ categories: Category[], payees: Payee[], projects: Project[], tags: Tag[] }>({ categories: [], payees: [], projects: [], tags: [] });
    const isInitialLoad = useRef(true);
    const [aiSummaryData, setAiSummaryData] = useState<any>(null);

    const fetchData = useCallback(async (isUpdate = false) => {
        if (!isUpdate && isInitialLoad.current) setLoading(true);
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

            const [accs, transactions, cats, pys, projs, tgs, stats, collaboratorsResponse] = await Promise.all([
                getAccountsWithBalance(),
                getFinancialReport({ startDate: startOfMonth, endDate: endOfMonth }),
                categoriesApi.getAll(),
                payeesApi.getAll(),
                projectsApi.getAll(),
                tagsApi.getAll(),
                getDashboardStats(),
                fetch('https://teuco.com.br/colaboradores/partials/resumo.php').catch(e => null)
            ]);
            setAccounts(accs);
            setThisMonthTransactions(transactions);
            setDataForMaps({ categories: cats, payees: pys, projects: projs, tags: tgs });
            
             // --- Prepare data for AI Summary ---
            const monthlyIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const monthlyExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

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
                    totalVencido: stats.totalOverdueAmount, // From getDashboardStats
                    vencemEsteMes: stats.projectedExpenses, // From getDashboardStats
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
    const recentTransactions = useMemo(() => thisMonthTransactions.slice(0, 5), [thisMonthTransactions]);
    const categoryMap = useMemo(() => new Map(dataForMaps.categories.map(c => [c.id, c.name])), [dataForMaps.categories]);

    const monthlySummary = useMemo<MonthlySummaryData>(() => {
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
    }, [thisMonthTransactions, dataForMaps, categoryMap]);
    
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
                    <MonthlySummarySection summary={monthlySummary} />
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