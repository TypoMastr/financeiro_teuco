import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewState, PayableBill, Payee, Category, Account, Transaction } from '../types';
// FIX: Added `addPayableBill` to the import list to resolve the module error.
import { payableBillsApi, payeesApi, categoriesApi, accountsApi, addPayableBill, payBill, getUnlinkedExpenses, linkExpenseToBill } from '../services/api';
import { PlusCircle, Edit, Trash, DollarSign, Search, ClipboardList, Repeat, Paperclip, X as XIcon, ArrowLeft, ClipboardPaste } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader, SubmitButton, DateField } from './common/PageLayout';
import { useToast } from './Notifications';

// --- Helper Functions ---
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('pt-BR');

const formatCurrencyForInput = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const parseCurrencyFromInput = (formattedValue: string): number => {
    const numericString = formattedValue.replace(/\D/g, '');
    return numericString ? parseInt(numericString, 10) / 100 : 0;
};

const FilterChip: React.FC<{ label: string, selected: boolean, onClick: () => void, onRemove?: () => void }> = ({ label, selected, onClick, onRemove }) => (
    <motion.button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 border flex items-center gap-1.5
        ${selected
            ? 'bg-primary/10 text-primary border-primary/20'
            : 'bg-secondary dark:bg-dark-secondary hover:bg-muted dark:hover:bg-dark-muted border-border dark:border-dark-border'
        }`}
        whileTap={{ scale: 0.95 }}
    >
        {label}
        {onRemove && <XIcon onClick={(e) => { e.stopPropagation(); onRemove(); }} className="h-3 w-3 text-muted-foreground hover:text-foreground"/>}
    </motion.button>
);


// --- Main Component ---
const AccountsPayable: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { componentState } = viewState;
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ bills: PayableBill[], payees: Payee[], categories: Category[], accounts: Account[] }>({ bills: [], payees: [], categories: [], accounts: [] });
    const isInitialLoad = useRef(true);

    const [filters, setFilters] = useState(componentState?.filters || {
        searchTerm: '',
        status: 'all' as 'all' | 'overdue' | 'pending' | 'paid',
    });

    const fetchData = useCallback(async (isUpdate = false) => {
        if (!isUpdate) {
            setLoading(true);
        }
        try {
            const [bills, payees, categories, accounts] = await Promise.all([
                payableBillsApi.getAll(), payeesApi.getAll(), categoriesApi.getAll(), accountsApi.getAll()
            ]);
            setData({ bills, payees, categories: categories.filter(c => c.type === 'expense'), accounts });
        } catch (error) {
            console.error("Failed to fetch accounts payable data", error);
        } finally {
             if (!isUpdate || isInitialLoad.current) {
                setLoading(false);
                isInitialLoad.current = false;
            }
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const { summary, filteredBills } = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const summaryData = {
            previousOverdue: { count: 0, amount: 0 },
            thisMonth: { openCount: 0, openAmount: 0, paidCount: 0, paidAmount: 0 },
            nextMonth: { count: 0, amount: 0 },
        };

        const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
        const nextMonthYear = nextMonthDate.getFullYear();
        const nextMonthMonth = nextMonthDate.getMonth();

        for (const bill of data.bills) {
            const dueDate = new Date(bill.dueDate + 'T12:00:00Z');
            const dueYear = dueDate.getFullYear();
            const dueMonth = dueDate.getMonth();

            if ((dueYear < currentYear || (dueYear === currentYear && dueMonth < currentMonth)) && bill.status !== 'paid') {
                summaryData.previousOverdue.count++;
                summaryData.previousOverdue.amount += bill.amount;
            }
            else if (dueYear === currentYear && dueMonth === currentMonth) {
                if (bill.status === 'paid') {
                    summaryData.thisMonth.paidCount++;
                    summaryData.thisMonth.paidAmount += bill.amount;
                } else {
                    summaryData.thisMonth.openCount++;
                    summaryData.thisMonth.openAmount += bill.amount;
                }
            }
            else if (dueYear === nextMonthYear && dueMonth === nextMonthMonth && bill.status !== 'paid') {
                summaryData.nextMonth.count++;
                summaryData.nextMonth.amount += bill.amount;
            }
        }
        
        const bills = data.bills.filter(bill => {
            const searchMatch = filters.searchTerm === '' || bill.description.toLowerCase().includes(filters.searchTerm.toLowerCase());
            
            if(filters.status === 'pending') return searchMatch && (bill.status === 'pending' || bill.status === 'overdue');
            if(filters.status !== 'all') return searchMatch && bill.status === filters.status;
            
            return searchMatch;
        });
        return { summary: summaryData, filteredBills: bills };
    }, [data.bills, filters]);

    const { overdue, pending, paid } = useMemo(() => {
        return {
            overdue: filteredBills.filter(b => b.status === 'overdue').sort((a,b) => a.dueDate.localeCompare(b.dueDate)),
            pending: filteredBills.filter(b => b.status === 'pending').sort((a,b) => a.dueDate.localeCompare(b.dueDate)),
            paid: filteredBills.filter(b => b.status === 'paid').sort((a,b) => (b.paidDate || '').localeCompare(a.paidDate || ''))
        }
    }, [filteredBills]);

    const payeeMap = useMemo(() => new Map(data.payees.map(p => [p.id, p.name])), [data.payees]);
    
    const currentView: ViewState = { name: 'accounts-payable', componentState: { filters } };

    const Section: React.FC<{ title: string; bills: PayableBill[]; emptyText: string; children: (bill: PayableBill) => React.ReactNode }> = ({ title, bills, emptyText, children }) => (
        <div>
            <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground mb-3">{title} ({bills.length})</h3>
            <div className="space-y-3 min-h-[8rem]">
              <AnimatePresence>
                {bills.length > 0 ? (
                    bills.map(children)
                ) : (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center py-8 text-muted-foreground bg-card dark:bg-dark-card rounded-lg border-2 border-dashed border-border dark:border-dark-border">{emptyText}</motion.div>
                )}
              </AnimatePresence>
            </div>
        </div>
    );

    const BillCard: React.FC<{ bill: PayableBill, statusColor: string }> = ({ bill, statusColor }) => (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ type: 'spring', stiffness: 150 }}
          className={`bg-card dark:bg-dark-card p-4 rounded-lg border-l-4 ${statusColor} border-y border-r border-border dark:border-dark-border`}
        >
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground dark:text-dark-foreground">{bill.description}</p>
                    <div className="flex items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1 flex-wrap">
                        <span>{payeeMap.get(bill.payeeId) || 'N/A'}</span>
                        {bill.recurringId && <span className="flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full"><Repeat className="h-3 w-3" />Recorrente</span>}
                        {bill.attachmentUrl && bill.status === 'paid' && <button onClick={() => setView({name: 'attachment-view', attachmentUrl: bill.attachmentUrl, returnView: currentView})} className="flex items-center gap-1 text-xs font-semibold text-primary"><Paperclip className="h-3 w-3"/> Ver Anexo</button>}
                    </div>
                </div>
                <div className="flex items-center gap-4 self-end sm:self-center flex-shrink-0">
                    <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(bill.amount)}</p>
                        <p className={`text-xs font-semibold ${bill.status === 'overdue' ? 'text-danger' : 'text-muted-foreground'}`}>{bill.status === 'paid' ? `Pago em: ${formatDate(bill.paidDate!)}` : `Vence em: ${formatDate(bill.dueDate)}`}</p>
                    </div>
                     {bill.status !== 'paid' && <button type="button" onClick={() => setView({ name: 'pay-bill-form', billId: bill.id, returnView: currentView })} className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md text-sm hover:opacity-90">Pagar</button>}
                </div>
            </div>
            {bill.status !== 'paid' && (
                <div className="flex justify-end items-center gap-2 mt-2 pt-2 border-t border-border dark:border-dark-border">
                    <button type="button" onClick={() => setView({ name: 'bill-form', billId: bill.id, returnView: currentView })} className="text-muted-foreground hover:text-primary text-xs font-semibold p-1">EDITAR</button>
                    <button type="button" onClick={() => setView({ name: 'delete-bill-confirmation', billId: bill.id, returnView: currentView })} className="text-muted-foreground hover:text-danger text-xs font-semibold p-1">EXCLUIR</button>
                </div>
            )}
        </motion.div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Contas a Pagar</h2>
                <button onClick={() => setView({ name: 'bill-form', returnView: currentView })} className="bg-primary text-primary-foreground font-bold py-2.5 px-5 text-sm rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
                    <PlusCircle className="h-5 w-5" /> Adicionar Conta
                </button>
            </div>

            <motion.div layout className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AnimatePresence>
                    {summary.previousOverdue.count > 0 && (
                         <motion.div 
                            layout
                            initial={{ opacity: 0, x: -20, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 250, damping: 25 }}
                            className="md:col-span-1 bg-danger/5 dark:bg-danger/10 p-4 rounded-lg border border-danger/20"
                          >
                             <h4 className="text-sm font-bold text-danger mb-2">Vencimentos Anteriores</h4>
                             <p className="text-2xl font-bold font-display text-danger">{formatCurrency(summary.previousOverdue.amount)}</p>
                             <p className="text-xs text-danger/80">{summary.previousOverdue.count} {summary.previousOverdue.count === 1 ? 'conta' : 'contas'} em aberto</p>
                         </motion.div>
                    )}
                </AnimatePresence>
                <motion.div 
                    layout
                    transition={{ type: 'spring', stiffness: 250, damping: 25 }}
                    className={`md:col-span-1 bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border space-y-3 ${summary.previousOverdue.count > 0 ? '' : 'md:col-start-1'}`}
                >
                    <h4 className="text-sm font-bold text-foreground dark:text-dark-foreground">Este Mês</h4>
                    <div>
                        <p className="text-xs text-muted-foreground">Em aberto</p>
                        <p className="text-xl font-bold text-warning">{formatCurrency(summary.thisMonth.openAmount)}</p>
                        <p className="text-xs text-muted-foreground">{summary.thisMonth.openCount} {summary.thisMonth.openCount === 1 ? 'conta' : 'contas'}</p>
                    </div>
                     <div>
                        <p className="text-xs text-muted-foreground">Pago</p>
                        <p className="text-xl font-bold text-success">{formatCurrency(summary.thisMonth.paidAmount)}</p>
                         <p className="text-xs text-muted-foreground">{summary.thisMonth.paidCount} {summary.thisMonth.paidCount === 1 ? 'conta' : 'contas'}</p>
                    </div>
                </motion.div>
                 <motion.div 
                    layout
                    transition={{ type: 'spring', stiffness: 250, damping: 25 }}
                    className="md:col-span-1 bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border"
                  >
                    <h4 className="text-sm font-bold text-foreground dark:text-dark-foreground mb-2">Próximo Mês</h4>
                    <p className="text-2xl font-bold font-display text-primary">{formatCurrency(summary.nextMonth.amount)}</p>
                    <p className="text-xs text-muted-foreground">{summary.nextMonth.count} {summary.nextMonth.count === 1 ? 'conta prevista' : 'contas previstas'}</p>
                </motion.div>
            </motion.div>

            <div className="space-y-3 bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input type="text" placeholder="Buscar por descrição..." className="w-full text-base p-2.5 pl-10 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all" value={filters.searchTerm} onChange={e => setFilters(f => ({...f, searchTerm: e.target.value}))}/>
                </div>
              <div className="flex flex-wrap items-center gap-2">
                 <FilterChip label="Todas" selected={filters.status === 'all'} onClick={() => setFilters(f => ({...f, status: 'all'}))} />
                 <FilterChip label="Pendentes" selected={filters.status === 'pending'} onClick={() => setFilters(f => ({...f, status: 'pending'}))} />
                 <FilterChip label="Vencidas" selected={filters.status === 'overdue'} onClick={() => setFilters(f => ({...f, status: 'overdue'}))} />
                 <FilterChip label="Pagas" selected={filters.status === 'paid'} onClick={() => setFilters(f => ({...f, status: 'paid'}))} />
              </div>
            </div>

            {loading ? <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div> : (
                <div className="space-y-8">
                    <Section title="Vencidas" bills={overdue} emptyText="Nenhuma conta vencida com os filtros atuais.">
                        {(bill) => <BillCard key={bill.id} bill={bill} statusColor="border-danger" />}
                    </Section>
                    <Section title="Pendentes" bills={pending} emptyText="Nenhuma conta pendente com os filtros atuais.">
                        {(bill) => <BillCard key={bill.id} bill={bill} statusColor="border-warning" />}
                    </Section>
                    <Section title="Pagas" bills={paid} emptyText="Nenhuma conta paga com os filtros atuais.">
                        {(bill) => <BillCard key={bill.id} bill={bill} statusColor="border-success" />}
                    </Section>
                </div>
            )}
        </div>
    );
};

// --- Form and Action Pages ---

const PaymentTypeButton: React.FC<{ type: string, currentType: string, setType: (type: string) => void, children: React.ReactNode }> = ({ type, currentType, setType, children }) => (
    <button
        type="button"
        onClick={() => setType(type)}
        className={`py-2 px-3 text-sm font-semibold rounded-md transition-all ${currentType === type ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}
    >
        {children}
    </button>
);

export const BillFormPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { billId, returnView = { name: 'accounts-payable' } } = viewState;
    const isEdit = !!billId;
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ bill?: PayableBill, payees: Payee[], categories: Category[] }>({ payees: [], categories: [] });
    const [formData, setFormData] = useState({ description: '', payeeId: '', categoryId: '', amount: 0, firstDueDate: new Date().toISOString().slice(0, 10), notes: '', installments: 2 });
    const [amountStr, setAmountStr] = useState('R$ 0,00');
    const [paymentType, setPaymentType] = useState('single');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const [payees, categories, allBills] = await Promise.all([payeesApi.getAll(), categoriesApi.getAll(), isEdit ? payableBillsApi.getAll() : []]);
            const bill = isEdit ? allBills.find(b => b.id === billId) : undefined;
            setData({ bill, payees, categories: categories.filter(c => c.type === 'expense') });
            if (bill) {
                setFormData({ description: bill.description, payeeId: bill.payeeId, categoryId: bill.categoryId, amount: bill.amount, firstDueDate: bill.dueDate, notes: bill.notes || '', installments: bill.installmentInfo?.total || 2 });
                setAmountStr(formatCurrencyForInput(bill.amount));
                if (bill.recurringId) setPaymentType('monthly');
                else if (bill.installmentInfo) setPaymentType('installments');
                else setPaymentType('single');
            }
            setLoading(false);
        };
        loadData();
    }, [billId, isEdit]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = parseCurrencyFromInput(value);
        setFormData(prev => ({...prev, amount: numericValue }));
        setAmountStr(formatCurrencyForInput(numericValue));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (isEdit && billId) {
                await payableBillsApi.update(billId, { description: formData.description, payeeId: formData.payeeId, categoryId: formData.categoryId, amount: formData.amount, dueDate: formData.firstDueDate, notes: formData.notes });
            } else {
                await addPayableBill({ ...formData, paymentType: paymentType as any, installments: paymentType === 'installments' ? formData.installments : undefined });
            }
            toast.success(`Conta ${isEdit ? 'atualizada' : 'adicionada'} com sucesso!`);
            setView(returnView);
        } catch (error) {
            console.error(error);
            toast.error("Falha ao salvar a conta.");
            setIsSubmitting(false);
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title={isEdit ? "Editar Conta" : "Nova Conta"} onBack={() => setView(returnView)} />
            
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                <div><label className={labelClass}>Descrição</label><input type="text" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} required className={inputClass} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Beneficiário</label><select value={formData.payeeId} onChange={e => setFormData(f => ({ ...f, payeeId: e.target.value }))} required className={inputClass}><option value="">Selecione...</option>{data.payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                    <div><label className={labelClass}>Categoria</label><select value={formData.categoryId} onChange={e => setFormData(f => ({ ...f, categoryId: e.target.value }))} required className={inputClass}><option value="">Selecione...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
                <div><label className={labelClass}>Valor</label><input type="text" value={amountStr} onChange={handleAmountChange} required className={inputClass} /></div>
                {!isEdit && (<div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 dark:bg-dark-muted/50 rounded-lg">
                    <PaymentTypeButton type="single" currentType={paymentType} setType={setPaymentType}>Único</PaymentTypeButton>
                    <PaymentTypeButton type="installments" currentType={paymentType} setType={setPaymentType}>Parcelado</PaymentTypeButton>
                    <PaymentTypeButton type="monthly" currentType={paymentType} setType={setPaymentType}>Mensal</PaymentTypeButton>
                </div>)}
                <div className={`grid ${paymentType === 'installments' && !isEdit ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    <div>
                      <DateField
                        id="firstDueDate"
                        label={paymentType === 'installments' ? '1º Vencimento' : 'Vencimento'}
                        value={formData.firstDueDate}
                        onChange={date => setFormData(f => ({ ...f, firstDueDate: date }))}
                        required
                      />
                    </div>
                    {paymentType === 'installments' && !isEdit && (
                        <div>
                            <label className={labelClass}>Nº de Parcelas</label>
                            <input type="number" min="2" value={formData.installments} onChange={e => setFormData(f => ({...f, installments: Number(e.target.value)}))} required className={inputClass} />
                        </div>
                    )}
                </div>
                <div><label className={labelClass}>Notas</label><textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputClass}></textarea></div>
            </motion.div>
            <div className="flex justify-center"><SubmitButton isSubmitting={isSubmitting} text="Salvar" /></div>
        </form>
    );
};

export const PayBillPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { billId, returnView = { name: 'accounts-payable' } } = viewState;
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ bill?: PayableBill, accounts: Account[] }>({ accounts: [] });
    const [activeTab, setActiveTab] = useState('create');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [createFormData, setCreateFormData] = useState({ accountId: '', paidAmount: 0, paymentDate: new Date().toISOString().slice(0, 10), attachmentUrl: '', attachmentFilename: '' });
    const [paidAmountStr, setPaidAmountStr] = useState('R$ 0,00');
    const [unlinkedExpenses, setUnlinkedExpenses] = useState<Transaction[]>([]);
    const [selectedTrxId, setSelectedTrxId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    useEffect(() => {
        const loadData = async () => {
            if (!billId) { setView(returnView); return; }
            setLoading(true);
            const [accounts, allBills] = await Promise.all([accountsApi.getAll(), payableBillsApi.getAll()]);
            const bill = allBills.find(b => b.id === billId);
            setData({ bill, accounts });
            if (bill) {
                setCreateFormData(f => ({ ...f, paidAmount: bill.amount, accountId: accounts[0]?.id || '' }));
                setPaidAmountStr(formatCurrencyForInput(bill.amount));
            }
            setLoading(false);
        };
        loadData();
    }, [billId, returnView, setView]);
    
    useEffect(() => {
        if (activeTab === 'link') {
            getUnlinkedExpenses().then(setUnlinkedExpenses);
        }
    }, [activeTab]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCreateFormData(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
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
                    const fileName = `colado-${Date.now()}.${fileExtension}`;
                    const file = new File([blob], fileName, { type: supportedType });

                    setCreateFormData(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
                    toast.success('Anexo colado com sucesso!');
                    found = true;
                    break;
                }
            }
            if (!found) {
                toast.info('Nenhuma imagem ou PDF encontrado na área de transferência.');
            }
        } catch (err) {
            console.error('Falha ao colar:', err);
            toast.error('Não foi possível ler a área de transferência. Verifique as permissões do navegador.');
        }
    };
    
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = parseCurrencyFromInput(value);
        setCreateFormData(prev => ({...prev, paidAmount: numericValue }));
        setPaidAmountStr(formatCurrencyForInput(numericValue));
    };

    const handleSubmit = async () => {
        if (!billId) return;
        setIsSubmitting(true);
        try {
            if (activeTab === 'create') {
                await payBill(billId, { ...createFormData });
            } else if (selectedTrxId) {
                await linkExpenseToBill(billId, selectedTrxId);
            }
            toast.success("Pagamento processado com sucesso!");
            setView(returnView);
        } catch (error) {
            console.error(error);
            toast.error("Falha ao processar pagamento.");
            setIsSubmitting(false);
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    const { bill, accounts } = data;
    if (!bill) { setView(returnView); return null; }

    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

    return (
        <div className="space-y-6 max-w-lg mx-auto">
             <PageHeader title={`Pagar: ${bill.description}`} onBack={() => setView(returnView)} />
             
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-card dark:bg-dark-card p-4 sm:p-6 rounded-lg border border-border dark:border-dark-border">
                <div className="border-b border-border dark:border-dark-border mb-4">
                    <div className="flex">
                        <button onClick={() => setActiveTab('create')} className={`flex-1 text-center py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'create' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Novo Pagamento</button>
                        <button onClick={() => setActiveTab('link')} className={`flex-1 text-center py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'link' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Vincular Despesa</button>
                    </div>
                </div>
                 {activeTab === 'create' ? (
                    <div className="space-y-4">
                        <div><label className={labelClass}>Conta de Débito</label><select value={createFormData.accountId} onChange={e => setCreateFormData(f => ({ ...f, accountId: e.target.value }))} required className={inputClass}><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className={labelClass}>Valor Pago</label><input type="text" value={paidAmountStr} onChange={handleAmountChange} required className={inputClass} /></div>
                            <DateField
                              id="paymentDate"
                              label="Data do Pagamento"
                              value={createFormData.paymentDate}
                              onChange={date => setCreateFormData(f => ({ ...f, paymentDate: date }))}
                              required
                            />
                        </div>
                         <div>
                            <label className={labelClass}>Anexar Comprovante</label>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} flex-1 text-left ${createFormData.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}><Paperclip className="h-4 w-4" />{createFormData.attachmentFilename || 'Escolher arquivo...'}</button>
                                <button type="button" onClick={handlePasteAttachment} className="p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border text-muted-foreground hover:text-primary transition-colors">
                                    <ClipboardPaste className="h-5 w-5" />
                                </button>
                            </div>
                         </div>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm text-muted-foreground mb-4">Selecione uma despesa para marcar esta conta como paga.</p>
                        <div className="max-h-64 overflow-y-auto space-y-2 p-2 bg-background dark:bg-dark-background rounded-lg border border-border dark:border-dark-border">
                            {unlinkedExpenses.length > 0 ? unlinkedExpenses.map(trx => (
                                <div key={trx.id} onClick={() => setSelectedTrxId(trx.id)} className={`p-3 rounded-md cursor-pointer border-2 ${selectedTrxId === trx.id ? 'border-primary bg-primary/10' : 'border-transparent bg-muted/50 dark:bg-dark-muted/50'}`}>
                                    <div className="flex justify-between items-center"><p className="font-semibold">{trx.description}</p><p className="font-bold text-lg">{formatCurrency(trx.amount)}</p></div>
                                    <p className="text-xs text-muted-foreground">{new Date(trx.date).toLocaleDateString('pt-BR')}</p>
                                </div>
                            )) : <p className="text-center text-sm text-muted-foreground p-4">Nenhuma despesa não vinculada encontrada.</p>}
                        </div>
                    </div>
                )}
            </motion.div>
            <div className="flex justify-center gap-3">
                <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="bg-primary text-primary-foreground font-semibold text-sm py-2.5 px-6 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50">{isSubmitting ? 'Processando...' : (activeTab === 'create' ? 'Confirmar Pagamento' : 'Vincular Despesa')}</button>
            </div>
        </div>
    );
};

export const DeleteBillConfirmationPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { billId, returnView = { name: 'accounts-payable' } } = viewState;
    const [bill, setBill] = useState<PayableBill | null>(null);
    const [deleteAll, setDeleteAll] = useState(false);
    const toast = useToast();
    
    useEffect(() => {
        if (billId) {
            payableBillsApi.getAll().then(bills => {
                setBill(bills.find(b => b.id === billId) || null);
            });
        }
    }, [billId]);

    const handleConfirm = async () => {
        if (!bill) return;
        try {
            if (deleteAll && bill.installmentGroupId) {
                await payableBillsApi.deleteInstallmentGroup(bill.installmentGroupId);
            } else {
                await payableBillsApi.remove(bill.id);
            }
            toast.success("Conta excluída com sucesso.");
            setView(returnView);
        } catch (error) {
            toast.error("Erro ao excluir conta.");
            setView(returnView);
        }
    };

    if (!bill) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const isInstallment = !!bill.installmentInfo && !!bill.installmentGroupId;

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Confirmar Exclusão" onBack={() => setView(returnView)} />

            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4 text-center">
                <p className="text-foreground dark:text-dark-foreground">Você tem certeza que deseja excluir a conta "<strong>{bill.description}</strong>"?</p>
                <p className="text-sm text-muted-foreground mt-2">Esta ação não pode ser desfeita.</p>
                {isInstallment && (
                    <div className="mt-4 p-3 bg-danger-strong/40 dark:bg-dark-danger-strong/40 rounded-md">
                        <label className="flex items-center justify-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={deleteAll} onChange={(e) => setDeleteAll(e.target.checked)} className="h-4 w-4 rounded border-border dark:border-dark-border text-destructive focus:ring-destructive"/>
                            <span className="font-semibold text-sm text-destructive-foreground-dark dark:text-red-300">Excluir todas as {bill.installmentInfo?.total} parcelas.</span>
                        </label>
                    </div>
                )}
            </motion.div>
            <div className="flex justify-center gap-3">
                <button type="button" onClick={() => setView(returnView)} className="bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground font-semibold text-sm py-2 px-5 rounded-full hover:bg-muted dark:hover:bg-dark-muted transition-colors">Cancelar</button>
                <button type="button" onClick={handleConfirm} className="bg-destructive text-destructive-foreground font-semibold text-sm py-2 px-5 rounded-full hover:bg-destructive/90 transition-opacity">Excluir</button>
            </div>
        </div>
    );
};

export default AccountsPayable;
