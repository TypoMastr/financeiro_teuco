import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewState, Account, Transaction, Category, Payee, Tag, Member, Project, PayableBill, Payment } from '../types';
// FIX: Removed unused 'linkTransactionToPayment' import which caused an error.
import { getMembers, getAccountsWithBalance, transactionsApi, categoriesApi, payeesApi, tagsApi, projectsApi, accountsApi, getFinancialReport, addIncomeTransactionAndPayment, getPayableBillsForLinking, getFutureIncomeSummary, getFutureIncomeTransactions, getPaymentByTransactionId, updateTransactionAndPaymentLink } from '../services/api';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { DollarSign, FileSearch, PlusCircle, Paperclip, X as XIcon, Briefcase, Tag as TagIcon, ArrowLeft, Search, TrendingUp, ChevronRight, Layers, UploadCloud, ClipboardPaste } from './Icons';
import { PageHeader, SubmitButton, DateField } from './common/PageLayout';
import { useToast } from './Notifications';

// --- Helper Functions ---
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatCurrencyForInput = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const parseCurrencyFromInput = (formattedValue: string): number => {
    const numericString = formattedValue.replace(/\D/g, '');
    return numericString ? parseInt(numericString, 10) / 100 : 0;
};


// --- Sub-components ---
const AccountBalanceCard: React.FC<{ account: Account, onClick: () => void }> = ({ account, onClick }) => (
    <motion.div 
        onClick={onClick}
        className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center gap-4 cursor-pointer group"
        whileHover={{ y: -3, boxShadow: '0 4px 15px -2px rgba(0,0,0,0.05)' }}
        transition={{ type: 'spring', stiffness: 200 }}
    >
        <div className="p-3 bg-primary/10 rounded-full">
            <DollarSign className="w-6 h-6 text-primary" />
        </div>
        <div>
            <h3 className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">{account.name}</h3>
            <p className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">{formatCurrency(account.currentBalance || 0)}</p>
        </div>
    </motion.div>
);

const TabButton: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-semibold relative transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
        {label}
        {isActive && <motion.div layoutId="financial-tab-indicator" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary" />}
    </button>
);

const TransactionRow: React.FC<{ transaction: Transaction, data: any, onClick: () => void, onViewAttachment: (url: string) => void }> = ({ transaction, data, onClick, onViewAttachment }) => {
    const { categories } = data;
    const isIncome = transaction.type === 'income';
    return (
        <motion.tr 
          layout 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          onClick={onClick} 
          className="border-b border-border/50 dark:border-dark-border/50 hover:bg-muted/50 dark:hover:bg-dark-muted/50 cursor-pointer transition-colors"
        >
            <td className="py-3 px-4 text-sm">
                <div className="flex items-center gap-2">
                    {transaction.attachmentUrl && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onViewAttachment(transaction.attachmentUrl!); }} className="text-muted-foreground hover:text-primary"><Paperclip className="h-4 w-4"/></button>
                    )}
                    <div>
                        <p className="font-semibold text-foreground dark:text-dark-foreground">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">{categories.find((c:Category) => c.id === transaction.categoryId)?.name || 'N/A'}</p>
                    </div>
                </div>
            </td>
            <td className="py-3 px-4 text-sm text-muted-foreground hidden sm:table-cell">{formatDate(transaction.date)}</td>
            <td className={`py-3 px-4 text-sm text-right font-semibold ${isIncome ? 'text-success' : 'text-danger'}`}>
                {isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}
            </td>
        </motion.tr>
    );
};

const AnalysisListItem: React.FC<{ item: any, onClick: () => void }> = ({ item, onClick }) => {
    const total = item.income + item.expense;
    const incomePercentage = total > 0 ? (item.income / total) * 100 : 0;

    if (item.total === 0) {
        return (
            <div
                onClick={onClick}
                className="p-3 rounded-md cursor-pointer hover:bg-muted/50 dark:hover:bg-dark-muted/50 transition-colors group"
            >
                <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-muted-foreground/70">{item.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">Nenhuma atividade</span>
                </div>
            </div>
        );
    }
    
    return (
        <motion.div 
            onClick={onClick} 
            className="p-3 rounded-md cursor-pointer hover:bg-muted/50 dark:hover:bg-dark-muted/50 transition-all group"
            whileTap={{ scale: 0.98 }}
        >
            <div className="flex justify-between items-center text-sm mb-2">
                <span className="font-semibold text-foreground dark:text-dark-foreground">{item.name}</span>
                <span className="font-mono font-semibold text-right flex items-center gap-1">
                  {formatCurrency(item.income - item.expense)}
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"/>
                </span>
            </div>
            <div className="w-full bg-danger/20 dark:bg-danger/10 rounded-full h-2 overflow-hidden">
                <div 
                    className="bg-success h-2 rounded-full" 
                    style={{ width: `${incomePercentage}%` }}
                />
            </div>
             <div className="flex justify-between items-center text-xs mt-1 text-muted-foreground">
                <span className="text-success font-medium">+{formatCurrency(item.income)}</span>
                <span className="text-danger font-medium">-{formatCurrency(item.expense)}</span>
            </div>
        </motion.div>
    );
};

const MemberSearchableSelect: React.FC<{
    members: Member[];
    selectedMemberId: string;
    onSelect: (memberId: string) => void;
}> = ({ members, selectedMemberId, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filteredMembers = useMemo(() => 
        members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [members, searchTerm]
    );

    const selectedMemberName = members.find(m => m.id === selectedMemberId)?.name || "Selecione...";
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className="relative" ref={wrapperRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all flex justify-between items-center text-left">
                <span className={selectedMemberId ? '' : 'text-muted-foreground'}>{selectedMemberName}</span>
                <svg className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
            {isOpen && (
                <div 
                    className="absolute z-[60] w-full mt-1 bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-lg shadow-lg"
                >
                    <div className="p-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                            <input type="text" placeholder="Buscar membro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full pl-8 pr-2 py-1.5 bg-background dark:bg-dark-background border-none focus:ring-0 text-sm"
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredMembers.map(member => (
                            <div key={member.id} onClick={() => { onSelect(member.id); setIsOpen(false); }} className="px-4 py-2 text-sm hover:bg-muted dark:hover:bg-dark-muted cursor-pointer">
                                {member.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main Component ---
const Financial: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { componentState } = viewState;
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>({ accounts: [], transactions: [], categories: [], payees: [], tags: [], projects: [], members: [] });
    const [activeTab, setActiveTab] = useState<'category' | 'project' | 'tag'>(componentState?.activeTab || 'category');
    const [futureIncomeSummary, setFutureIncomeSummary] = useState({ count: 0, totalAmount: 0 });
    const isInitialMount = useRef(true);

    const fetchData = useCallback(async (isUpdate = false) => {
        if (!isUpdate && isInitialMount.current) {
            setLoading(true);
        }
        const [accs, trxs, cats, pys, tgs, projs, membs, futureSummary] = await Promise.all([
            getAccountsWithBalance(), 
            transactionsApi.getAll(), 
            categoriesApi.getAll(), 
            payeesApi.getAll(), 
            tagsApi.getAll(), 
            projectsApi.getAll(),
            getMembers(),
            getFutureIncomeSummary()
        ]);
        setData({
            accounts: accs,
            transactions: trxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            categories: cats,
            payees: pys,
            tags: tgs,
            projects: projs,
            members: membs
        });
        setFutureIncomeSummary(futureSummary);
        if (isInitialMount.current) {
            setLoading(false);
            isInitialMount.current = false;
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const analysisData = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const currentMonthTransactions = data.transactions.filter((t: Transaction) => {
            const tDate = new Date(t.date);
            return tDate >= startOfMonth && tDate <= endOfMonth;
        });
        
        const calculateSummary = (items: any[], type: string) => {
            return items.map(item => {
                const filteredTransactions = currentMonthTransactions.filter((t: Transaction) => {
                    if (type === 'category') return t.categoryId === item.id;
                    if (type === 'project') return t.projectId === item.id;
                    if (type === 'tag') return t.tagIds?.includes(item.id);
                    return false;
                });
                const income = filteredTransactions.filter((t: Transaction) => t.type === 'income').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
                const expense = filteredTransactions.filter((t: Transaction) => t.type === 'expense').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
                return { ...item, income, expense, total: income + expense };
            }).sort((a, b) => {
                const aHasActivity = a.total > 0;
                const bHasActivity = b.total > 0;
                if (aHasActivity && !bHasActivity) return -1;
                if (!aHasActivity && bHasActivity) return 1;
                return b.total - a.total;
            });
        };
        return {
            category: calculateSummary(data.categories, 'category'),
            project: calculateSummary(data.projects, 'project'),
            tag: calculateSummary(data.tags, 'tag'),
        };
    }, [data]);
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const summaryContent = analysisData[activeTab];

    const currentView: ViewState = { name: 'financial', componentState: { activeTab } };

    return (
        <motion.div className="space-y-6" initial={{opacity:0}} animate={{opacity:1}}>
            <h2 className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Financeiro</h2>
            
            <motion.button onClick={() => setView({ name: 'transaction-form', returnView: currentView })} className="sm:hidden w-full text-center bg-primary text-primary-foreground font-semibold py-2.5 px-4 rounded-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-btn dark:shadow-dark-btn" whileTap={{scale:0.98}}>
                <PlusCircle className="h-5 w-5"/> Nova Transação
            </motion.button>
            
            <motion.div className="flex flex-col lg:flex-row gap-8" variants={{ visible: { transition: { staggerChildren: 0.07 } } }} initial="hidden" animate="visible">
                <motion.div className="w-full lg:w-2/5 xl:w-1/3 space-y-6 flex flex-col" variants={{hidden:{opacity:0, y:20}, visible:{opacity:1, y:0}}}>
                    <div className="lg:order-1">
                        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground mb-4">Saldos</h3>
                        <motion.div className="space-y-3" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
                            {data.accounts.map((acc: Account) => (<AccountBalanceCard key={acc.id} account={acc} onClick={() => setView({ name: 'transaction-history', accountId: acc.id })}/>))}
                             {futureIncomeSummary.count > 0 && (
                                <motion.div 
                                    onClick={() => setView({ name: 'future-income-view', returnView: currentView })}
                                    className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center gap-4 cursor-pointer group"
                                    whileHover={{ y: -3, boxShadow: '0 4px 15px -2px rgba(0,0,0,0.05)' }}
                                    transition={{ type: 'spring', stiffness: 200 }}
                                >
                                    <div className="p-3 bg-blue-500/10 rounded-full">
                                        <TrendingUp className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground group-hover:text-blue-500 transition-colors">Previsão de Receitas</h3>
                                        <p className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">{formatCurrency(futureIncomeSummary.totalAmount)}</p>
                                        <p className="text-xs text-muted-foreground">{futureIncomeSummary.count} {futureIncomeSummary.count === 1 ? 'transação futura' : 'transações futuras'}</p>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    </div>
                    
                    <div className="lg:order-2">
                        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground mb-4">Análise do Mês Atual</h3>
                        <div className="bg-card dark:bg-dark-card rounded-lg border border-border dark:border-dark-border">
                            <div className="p-2 border-b-2 border-border dark:border-dark-border flex justify-around">
                                <TabButton label="Categorias" isActive={activeTab === 'category'} onClick={() => setActiveTab('category')} />
                                <TabButton label="Projetos" isActive={activeTab === 'project'} onClick={() => setActiveTab('project')} />
                                <TabButton label="Tags" isActive={activeTab === 'tag'} onClick={() => setActiveTab('tag')} />
                            </div>
                            <div>
                                <div className="p-2 h-[280px] overflow-y-auto custom-scrollbar">
                                    {summaryContent.length > 0 ? (
                                        <motion.div className="space-y-1" variants={{ visible: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="visible">
                                            {summaryContent.map((item: any) => (
                                                <AnalysisListItem key={item.id} item={item} onClick={() => setView({name: 'financial-detail', filterType: activeTab, filterId: item.id, filterName: item.name})} />
                                            ))}
                                        </motion.div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <p className="text-center text-sm text-muted-foreground py-4">Nenhum dado para exibir.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div className="w-full lg:w-3/5 xl:w-2/3 flex flex-col gap-6" variants={{hidden:{opacity:0, y:20}, visible:{opacity:1, y:0}}}>
                    <div className="hidden sm:flex flex-col gap-3">
                        <motion.button onClick={() => setView({ name: 'transaction-form', returnView: currentView })} className="w-full text-center bg-primary text-primary-foreground font-semibold py-2.5 px-4 rounded-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-btn dark:shadow-dark-btn" whileTap={{scale:0.98}}><PlusCircle className="h-5 w-5"/> Nova Transação</motion.button>
                        <div className="grid grid-cols-2 gap-3">
                             <motion.button onClick={() => setView({ name: 'batch-transaction-form', returnView: currentView })} className="w-full text-center bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 border border-border dark:border-dark-border hover:bg-muted dark:hover:bg-dark-muted" whileTap={{scale:0.98}}><Layers className="h-4 w-4" /> Lote</motion.button>
                             <motion.button onClick={() => setView({ name: 'ofx-import-form', returnView: currentView })} className="w-full text-center bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 border border-border dark:border-dark-border hover:bg-muted dark:hover:bg-dark-muted" whileTap={{scale:0.98}}><UploadCloud className="h-4 w-4" /> OFX</motion.button>
                        </div>
                        <motion.button onClick={() => setView({ name: 'financial-report-form', returnView: currentView })} className="w-full text-center bg-card dark:bg-dark-card text-primary font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 border-2 border-primary/50 hover:border-primary hover:bg-primary/5" whileTap={{scale:0.98}}><FileSearch className="h-4 w-4" /> Relatórios</motion.button>
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground mb-4">Últimas Transações</h3>
                        <div className="bg-card dark:bg-dark-card rounded-lg border border-border dark:border-dark-border overflow-hidden min-h-[450px] flex flex-col">
                            {data.transactions.length > 0 ? (
                                <>
                                <table className="w-full">
                                    <motion.tbody>
                                        <AnimatePresence>
                                            {data.transactions.slice(0, 10).map((t: Transaction) => <TransactionRow key={t.id} transaction={t} data={data} onClick={() => setView({ name: 'transaction-form', transactionId: t.id, returnView: currentView })} onViewAttachment={(url) => setView({ name: 'attachment-view', attachmentUrl: url, returnView: currentView })}/>)}
                                        </AnimatePresence>
                                    </motion.tbody>
                                </table>
                                <div className="p-4 mt-auto">
                                    <button 
                                      onClick={() => setView({ name: 'transaction-history', accountId: 'all' })}
                                      className="w-full text-center text-primary font-semibold py-2.5 px-4 rounded-md transition-colors bg-primary/10 hover:bg-primary/20 text-sm"
                                    >
                                        Ver Histórico Completo
                                    </button>
                                </div>
                                </>
                            ) : (
                                <div className="flex-grow flex items-center justify-center">
                                    <p className="text-center text-muted-foreground">Nenhuma transação registrada.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="sm:hidden grid grid-cols-2 gap-3">
                         <motion.button onClick={() => setView({ name: 'batch-transaction-form', returnView: currentView })} className="w-full text-center bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 border border-border dark:border-dark-border" whileTap={{scale:0.98}}><Layers className="h-4 w-4" /> Lote</motion.button>
                         <motion.button onClick={() => setView({ name: 'ofx-import-form', returnView: currentView })} className="w-full text-center bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 border border-border dark:border-dark-border" whileTap={{scale:0.98}}><UploadCloud className="h-4 w-4" /> OFX</motion.button>
                    </div>
                    <motion.button onClick={() => setView({ name: 'financial-report-form', returnView: currentView })} className="sm:hidden w-full text-center bg-card dark:bg-dark-card text-primary font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 border-2 border-primary/50 hover:border-primary hover:bg-primary/5" whileTap={{scale:0.98}}><FileSearch className="h-4 w-4" /> Relatórios</motion.button>
                </motion.div>
            </motion.div>
        </motion.div>
    );
};

export const TransactionFormPage: React.FC<{
    viewState: ViewState;
    setView: (view: ViewState) => void;
}> = ({ viewState, setView }) => {
    const { transactionId, returnView = { name: 'financial' } } = viewState;
    const isEdit = !!transactionId;
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>({ categories: [], payees: [], tags: [], projects: [], accounts: [], members: [] });
    const [transaction, setTransaction] = useState<Transaction | undefined>(undefined);
    const toast = useToast();
    
    const [formState, setFormState] = useState<{
        type: 'income' | 'expense';
        description: string;
        amount: number;
        date: string;
        accountId: string;
        categoryId: string;
        payeeId: string;
        tagIds: string[];
        projectId: string;
        comments: string;
        payableBillId: string | undefined;
        attachmentUrl: string | undefined;
        attachmentFilename: string | undefined;
    }>({
        type: 'expense', description: '', amount: 0, date: new Date().toISOString().slice(0, 10),
        accountId: '', categoryId: '', payeeId: '', tagIds: [] as string[], projectId: '',
        comments: '', payableBillId: undefined, attachmentUrl: undefined, attachmentFilename: undefined,
    });
    const [amountStr, setAmountStr] = useState('R$ 0,00');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [linkToBill, setLinkToBill] = useState(false);
    const [availableBills, setAvailableBills] = useState<PayableBill[]>([]);
    
    // State for linking/editing membership payment
    const [paymentLink, setPaymentLink] = useState<{ memberId: string; referenceMonth: string; } | null>(null);
    const [showPaymentLinkUI, setShowPaymentLinkUI] = useState(false);

    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true);
            const [cats, pys, tgs, projs, accs, membs, allTransactions] = await Promise.all([
                categoriesApi.getAll(), payeesApi.getAll(), tagsApi.getAll(), projectsApi.getAll(), accountsApi.getAll(), getMembers(), transactionsApi.getAll()
            ]);
            setData({ categories: cats, payees: pys, tags: tgs, projects: projs, accounts: accs, members: membs });
            if (isEdit && transactionId) {
                const trx = allTransactions.find(t => t.id === transactionId);
                setTransaction(trx);
                if (trx && trx.type === 'income') {
                    const payment = await getPaymentByTransactionId(trx.id);
                    if (payment) {
                        setPaymentLink({ memberId: payment.memberId, referenceMonth: payment.referenceMonth });
                        setShowPaymentLinkUI(true);
                    }
                }
            }
            setLoading(false);
        };
        loadAllData();
    }, [transactionId, isEdit]);

    useEffect(() => {
        if (transaction) {
            setFormState({
                type: transaction.type, description: transaction.description, amount: transaction.amount,
                date: transaction.date.slice(0, 10), accountId: transaction.accountId, categoryId: transaction.categoryId,
                payeeId: transaction.payeeId || '', tagIds: transaction.tagIds || [], projectId: transaction.projectId || '',
                comments: transaction.comments || '', payableBillId: transaction.payableBillId,
                attachmentUrl: transaction.attachmentUrl, attachmentFilename: transaction.attachmentFilename,
            });
            setAmountStr(formatCurrencyForInput(transaction.amount));
            setLinkToBill(!!transaction.payableBillId);
        }
    }, [transaction]);
    
    useEffect(() => {
        if (formState.type === 'expense' && linkToBill) {
            getPayableBillsForLinking().then(setAvailableBills);
        }
    }, [formState.type, linkToBill]);

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
        if (!navigator.clipboard?.read) {
            toast.error('Seu navegador não suporta esta funcionalidade.');
            return;
        }
        try {
            const clipboardItems = await navigator.clipboard.read();
            let found = false;
            for (const item of clipboardItems) {
                const supportedType = item.types.find(type => type.startsWith('image/') || type === 'application/pdf');

                if (supportedType) {
                    const blob = await item.getType(supportedType);
                    let fileExtension = supportedType.split('/')[1];
                    if (fileExtension === 'jpeg') fileExtension = 'jpg';
                    
                    const fileName = `colado-${Date.now()}.${fileExtension}`;
                    const file = new File([blob], fileName, { type: supportedType });
                    
                    setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
                    toast.success('Anexo colado com sucesso!');
                    found = true;
                    break;
                }
            }
            if (!found) {
                toast.info('Nenhuma imagem ou PDF encontrado na área de transferência.');
            }
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                 toast.error('A permissão para ler a área de transferência foi negada.');
            } else {
                toast.error('Falha ao colar. A função pode exigir uma conexão segura (HTTPS).');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSave = { ...formState, date: new Date(formState.date + 'T12:00:00Z').toISOString() };
            
            if (isEdit && transaction) {
                 if (paymentLink) {
                    await updateTransactionAndPaymentLink(transaction.id, dataToSave, paymentLink);
                } else {
                    await transactionsApi.update(transaction.id, dataToSave);
                }
            } else {
                 if (formState.type === 'income' && showPaymentLinkUI && paymentLink) {
                    // FIX: Removed `accountId` from the paymentLink spread, as it belongs to transaction data.
                    await addIncomeTransactionAndPayment(
                        dataToSave,
                        { ...paymentLink, attachmentUrl: formState.attachmentUrl, attachmentFilename: formState.attachmentFilename }
                    );
                } else {
                    await transactionsApi.add(dataToSave);
                }
            }
            toast.success(`Transação ${isEdit ? 'atualizada' : 'adicionada'} com sucesso!`);
            setView(returnView);
        } catch (error) {
            console.error("Failed to save transaction:", error);
            toast.error("Falha ao salvar transação.");
            setIsSubmitting(false);
        }
    };
    
    useEffect(() => {
        if (formState.payableBillId) {
            const bill = availableBills.find(b => b.id === formState.payableBillId);
            if(bill) {
                setFormState(f => ({ ...f, description: bill.description, amount: bill.amount, categoryId: bill.categoryId, payeeId: bill.payeeId }));
                setAmountStr(formatCurrencyForInput(bill.amount));
            }
        }
    }, [formState.payableBillId, availableBills]);

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    const filteredCategories = data.categories.filter((c: Category) => c.type === formState.type);

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title={isEdit ? "Editar Transação" : "Nova Transação"} onBack={() => setView(returnView)} />

             <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="space-y-4 bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border">
                <div className="flex bg-muted/50 dark:bg-dark-muted/50 p-1 rounded-lg">
                    <button type="button" onClick={() => setFormState(f => ({ ...f, type: 'expense' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.type === 'expense' ? 'bg-destructive text-destructive-foreground shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Despesa</button>
                    <button type="button" onClick={() => setFormState(f => ({ ...f, type: 'income' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.type === 'income' ? 'bg-success text-white shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Receita</button>
                </div>
                <div><label className={labelClass}>Descrição</label><input type="text" value={formState.description} onChange={e => setFormState(f => ({ ...f, description: e.target.value }))} required className={inputClass} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Valor</label><input type="text" value={amountStr} onChange={handleAmountChange} required className={inputClass} /></div>
                    <DateField id="date" label="Data" value={formState.date} onChange={date => setFormState(f => ({ ...f, date: date }))} required />
                </div>

                {formState.type === 'expense' && (
                    <div className="space-y-2 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={linkToBill} onChange={e => setLinkToBill(e.target.checked)} className="h-4 w-4 rounded border-border dark:border-dark-border text-primary focus:ring-primary" />
                            <span className="text-sm font-medium">Vincular a uma conta a pagar</span>
                        </label>
                        {linkToBill && (
                            <div>
                                <select value={formState.payableBillId} onChange={e => setFormState(f => ({...f, payableBillId: e.target.value}))} className={inputClass}>
                                    <option value="">Selecione uma conta...</option>
                                    {availableBills.map(b => <option key={b.id} value={b.id}>{b.description} - {formatCurrency(b.amount)}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                )}
                
                {formState.type === 'income' && (
                    <div className="space-y-2 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showPaymentLinkUI} onChange={e => {
                                setShowPaymentLinkUI(e.target.checked);
                                if(e.target.checked && !paymentLink) {
                                    setPaymentLink({ memberId: '', referenceMonth: new Date().toISOString().slice(0, 7) });
                                }
                            }} className="h-4 w-4 rounded border-border dark:border-dark-border text-primary focus:ring-primary" />
                            <span className="text-sm font-medium">{isEdit ? 'Editar vínculo com mensalidade' : 'Esta transação é uma mensalidade'}</span>
                        </label>
                        {showPaymentLinkUI && paymentLink && (
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50 dark:border-dark-border/50 mt-2">
                                <div><label className={labelClass}>Membro</label><MemberSearchableSelect members={data.members} selectedMemberId={paymentLink.memberId} onSelect={(id) => setPaymentLink(f=> f ? ({...f, memberId: id}) : null)} /></div>
                                <div><label className={labelClass}>Mês de Referência</label><input type="month" value={paymentLink.referenceMonth} onChange={e => setPaymentLink(f => f ? ({ ...f, referenceMonth: e.target.value }) : null)} className={inputClass} /></div>
                            </div>
                        )}
                    </div>
                )}


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Conta</label><select value={formState.accountId} onChange={e => setFormState(f => ({ ...f, accountId: e.target.value }))} required className={inputClass}><option value="">Selecione...</option>{data.accounts.map((a: Account) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    <div><label className={labelClass}>Categoria</label><select value={formState.categoryId} disabled={linkToBill && !!formState.payableBillId} onChange={e => setFormState(f => ({ ...f, categoryId: e.target.value }))} required className={inputClass}><option value="">Selecione...</option>{filteredCategories.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>

                <div>
                    <label className={labelClass}>Anexar Comprovante</label>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} flex-1 text-left ${formState.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}>
                            <Paperclip className="h-4 w-4" />
                            {formState.attachmentFilename || 'Escolher arquivo...'}
                        </button>
                        <button type="button" onClick={handlePasteAttachment} className="p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border text-muted-foreground hover:text-primary transition-colors">
                            <ClipboardPaste className="h-5 w-5" />
                        </button>
                    </div>
                    {formState.attachmentUrl && formState.attachmentFilename?.match(/\.(jpeg|jpg|gif|png)$/i) && (
                        <img src={formState.attachmentUrl} alt="Preview" className="mt-2 h-20 w-20 object-cover rounded-md"/>
                    )}
                </div>
            </motion.div>
            <div className="flex justify-center"><SubmitButton isSubmitting={isSubmitting} text="Salvar" /></div>
        </form>
    );
};


export const ReportFiltersPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { returnView = { name: 'financial' } } = viewState;
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>({ categories: [], tags: [], payees: [], projects: [], accounts: [] });
    const [filters, setFilters] = useState({ type: '', categoryId: '', payeeId: '', tagIds: [] as string[], projectId: '', accountIds: [] as string[], startDate: '', endDate: '' });

    useEffect(() => {
        const loadData = async () => {
            const [cats, tgs, pys, projs, accs] = await Promise.all([categoriesApi.getAll(), tagsApi.getAll(), payeesApi.getAll(), projectsApi.getAll(), accountsApi.getAll()]);
            setData({ categories: cats, tags: tgs, payees: pys, projects: projs, accounts: accs });
            setLoading(false);
        };
        loadData();
    }, []);

    const handleGenerate = async () => {
        const activeFilters = Object.entries(filters).reduce((acc, [key, value]) => { if (value && (!Array.isArray(value) || value.length > 0)) acc[key] = value; return acc; }, {} as any);
        const reportData = await getFinancialReport(activeFilters);
        setView({
            name: 'report-view', report: { type: 'financial', data: { transactions: reportData, allData: { categories: data.categories, payees: data.payees, tags: data.tags, accounts: data.accounts, projects: data.projects } }, generatedAt: new Date().toISOString(), title: "Relatório Financeiro Personalizado" }
        });
    };

    const handleMultiSelectChange = (field: 'accountIds' | 'tagIds', value: string) => {
        setFilters(f => {
            const currentValues = f[field] as string[];
            const newValues = currentValues.includes(value) ? currentValues.filter(id => id !== value) : [...currentValues, value];
            return { ...f, [field]: newValues };
        });
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Gerar Relatório" onBack={() => setView(returnView)} />
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="space-y-4 bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DateField id="startDate" label="Data Início" value={filters.startDate} onChange={date => setFilters(f=>({...f, startDate: date}))}/>
                    <DateField id="endDate" label="Data Fim" value={filters.endDate} onChange={date => setFilters(f=>({...f, endDate: date}))}/>
                </div>
                 <div><label className={labelClass}>Tipo</label><select className={inputClass} value={filters.type} onChange={e => setFilters(f=>({...f, type: e.target.value}))}><option value="">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option></select></div>
                <div><label className={labelClass}>Categoria</label><select className={inputClass} value={filters.categoryId} onChange={e => setFilters(f=>({...f, categoryId: e.target.value}))}><option value="">Todas</option>{data.categories.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className={labelClass}>Projeto</label><select className={inputClass} value={filters.projectId} onChange={e => setFilters(f => ({ ...f, projectId: e.target.value }))}><option value="">Todos</option>{data.projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                
                <div>
                  <label className={labelClass}>Contas</label>
                  <div className="flex flex-wrap gap-2 p-2 bg-background dark:bg-dark-background rounded-lg border border-border dark:border-dark-border">
                    {data.accounts.map((acc: Account) => (
                      <button key={acc.id} type="button" onClick={() => handleMultiSelectChange('accountIds', acc.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filters.accountIds.includes(acc.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary dark:bg-dark-secondary hover:bg-muted dark:hover:bg-dark-muted border-border dark:border-dark-border'}`}>
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
                 <div>
                  <label className={labelClass}>Tags</label>
                  <div className="flex flex-wrap gap-2 p-2 bg-background dark:bg-dark-background rounded-lg border border-border dark:border-dark-border">
                    {data.tags.map((tag: Tag) => (
                      <button key={tag.id} type="button" onClick={() => handleMultiSelectChange('tagIds', tag.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filters.tagIds.includes(tag.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary dark:bg-dark-secondary hover:bg-muted dark:hover:bg-dark-muted border-border dark:border-dark-border'}`}>
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
            </motion.div>
            <div className="flex justify-center"><button onClick={handleGenerate} className="bg-primary text-primary-foreground font-semibold py-2.5 px-6 rounded-md hover:opacity-90 transition-opacity">Gerar Relatório</button></div>
        </div>
    );
};

export const FutureIncomePage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { returnView = { name: 'financial' } } = viewState;
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        getFutureIncomeTransactions().then(data => {
            setTransactions(data);
            setLoading(false);
        });
    }, []);

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Previsão de Receitas" onBack={() => setView(returnView)} />
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-card dark:bg-dark-card p-4 sm:p-6 rounded-lg border border-border dark:border-dark-border">
             {loading ? <div className="h-40 rounded-lg bg-muted animate-pulse"></div> : (
                <div className="space-y-2">
                    {transactions.length > 0 ? transactions.map(trx => (
                        <div key={trx.id} onClick={() => setView({ name: 'transaction-form', transactionId: trx.id, returnView: { name: 'future-income-view', returnView } })} className="p-3 rounded-md bg-muted/50 dark:bg-dark-muted/50 cursor-pointer hover:bg-muted dark:hover:bg-dark-muted transition-colors">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold">{trx.description}</p>
                                <p className="font-bold text-lg text-success">{formatCurrency(trx.amount)}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">Previsto para: {formatDate(trx.date)}</p>
                        </div>
                    )) : <p className="text-center text-sm text-muted-foreground p-4">Nenhuma receita futura encontrada.</p>}
                </div>
            )}
            </motion.div>
        </div>
    );
};

export default Financial;
