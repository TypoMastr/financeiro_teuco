import React, { useState, useEffect, useRef } from 'react';
import { ViewState, PayableBill, Payee, Category, Transaction } from '../types';
import { payableBillsApi, payeesApi, categoriesApi, addPayableBill, getUnlinkedExpenses, linkExpenseToBill } from '../services/api';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { DateField } from './common/FormControls';
import { useToast } from './Notifications';
import { Paperclip } from './Icons';
import { useApp } from '../contexts/AppContext';

const formatCurrencyForInput = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const parseCurrencyFromInput = (formattedValue: string): number => {
    const numericString = formattedValue.replace(/\D/g, '');
    return numericString ? parseInt(numericString, 10) / 100 : 0;
};

const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Data inválida';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T12:00:00Z');
    if (isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleDateString('pt-BR');
};
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });


export const BillFormPage: React.FC<{
    viewState: ViewState;
}> = ({ viewState }) => {
    const { setView } = useApp();
    const { billId, returnView } = viewState as { name: 'bill-form', billId?: string, returnView: ViewState };
    const isEdit = !!billId;
    const [loading, setLoading] = useState(true);
    const [bill, setBill] = useState<PayableBill | null>(null);
    const [data, setData] = useState<{ payees: Payee[], categories: Category[], unlinkedExpenses: Transaction[] }>({ payees: [], categories: [], unlinkedExpenses: [] });
    const toast = useToast();
    const [formState, setFormState] = useState({
        description: '', payeeId: '', categoryId: '', amount: 0, firstDueDate: new Date().toISOString().slice(0, 10),
        notes: '', paymentType: 'single' as 'single' | 'installments' | 'monthly', installments: 2, isEstimate: false,
        attachmentUrl: '', attachmentFilename: ''
    });
    const [amountStr, setAmountStr] = useState('R$ 0,00');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [linkedExpenseId, setLinkedExpenseId] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const [payees, categories, allBills, expenses] = await Promise.all([payeesApi.getAll(), categoriesApi.getAll(), isEdit ? payableBillsApi.getAll() : [], getUnlinkedExpenses()]);
            setData({ payees, categories: categories.filter(c => c.type === 'expense' || c.type === 'both'), unlinkedExpenses: expenses });
            if (isEdit && billId) {
                const currentBill = allBills.find(b => b.id === billId);
                if (currentBill) {
                    setBill(currentBill);
                    setFormState({
                        description: currentBill.description, payeeId: currentBill.payeeId, categoryId: currentBill.categoryId,
                        amount: currentBill.amount, firstDueDate: currentBill.dueDate.slice(0, 10), notes: currentBill.notes || '',
                        paymentType: currentBill.installmentInfo ? 'installments' : (currentBill.recurringId ? 'monthly' : 'single'),
                        installments: currentBill.installmentInfo?.total || 2, isEstimate: currentBill.isEstimate || false,
                        attachmentUrl: currentBill.attachmentUrl || '', attachmentFilename: currentBill.attachmentFilename || ''
                    });
                    setAmountStr(formatCurrencyForInput(currentBill.amount));
                }
            }
            setLoading(false);
        };
        loadData();
    }, [billId, isEdit]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
             if (isEdit && billId && linkedExpenseId) {
                await linkExpenseToBill(billId, linkedExpenseId);
                toast.success('Conta vinculada com sucesso!');
                setView(returnView);
                return;
            }

            if (isEdit && billId) {
                const { isEstimate, notes, firstDueDate, paymentType, installments, ...restOfState } = formState;

                const finalNotes = isEstimate 
                    ? `[ESTIMATE] ${(notes || '').replace(/\[ESTIMATE\]\s*/, '').trim()}`.trim() 
                    : (notes || '').replace(/\[ESTIMATE\]\s*/, '').trim();

                const payload = {
                    ...restOfState,
                    dueDate: firstDueDate,
                    notes: finalNotes,
                    isEstimate: isEstimate
                };
                
                const { data: updatedBill, warning } = await payableBillsApi.update(billId, payload);
                if (warning) toast.info(warning);

            } else {
                await addPayableBill(formState);
            }
            toast.success(`Conta ${isEdit ? 'atualizada' : 'adicionada'} com sucesso!`);
            setView(returnView);
        } catch (error: any) {
            console.error("Failed to save bill:", error);
            const errorMessage = error?.message || (typeof error === 'string' ? error : 'Ocorreu um erro desconhecido.');
            toast.error(`Falha ao salvar conta: ${errorMessage}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title={isEdit ? "Editar Conta" : "Nova Conta a Pagar"} onBack={() => setView(returnView)} />
            <div className="space-y-4 bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border">
                {isEdit && bill?.status === 'paid' && !bill.transactionId && (
                     <div className="p-4 bg-warning/10 rounded-lg space-y-2">
                        <p className="text-sm font-semibold text-warning/80">Esta conta está paga mas não foi vinculada a nenhuma despesa.</p>
                        <div><label className={labelClass}>Vincular à despesa existente</label>
                            <select value={linkedExpenseId} onChange={e => setLinkedExpenseId(e.target.value)} className={inputClass}>
                                <option value="">Selecione uma despesa...</option>
                                {data.unlinkedExpenses.map(t => <option key={t.id} value={t.id}>{formatDate(t.date)} - {t.description} - {formatCurrency(t.amount)}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div><label className={labelClass}>Descrição</label><input type="text" value={formState.description} onChange={e => setFormState(f => ({...f, description: e.target.value}))} required className={inputClass} disabled={!!linkedExpenseId}/></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Beneficiário</label><select value={formState.payeeId} onChange={e => setFormState(f => ({...f, payeeId: e.target.value}))} required className={inputClass} disabled={!!linkedExpenseId}><option value="">Selecione...</option>{data.payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                    <div><label className={labelClass}>Categoria</label><select value={formState.categoryId} onChange={e => setFormState(f => ({...f, categoryId: e.target.value}))} required className={inputClass} disabled={!!linkedExpenseId}><option value="">Selecione...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Valor</label><input type="text" value={amountStr} onChange={handleAmountChange} required className={inputClass} disabled={!!linkedExpenseId}/></div>
                    <DateField id="firstDueDate" label={isEdit ? "Vencimento" : "1º Vencimento"} value={formState.firstDueDate} onChange={date => setFormState(f => ({ ...f, firstDueDate: date }))} required smallLabel />
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <input type="checkbox" id="isEstimate" checked={formState.isEstimate} onChange={e => setFormState(f => ({ ...f, isEstimate: e.target.checked }))} className="h-4 w-4 rounded border-border dark:border-dark-border text-primary focus:ring-primary" disabled={!!linkedExpenseId}/>
                    <label htmlFor="isEstimate" className="text-sm font-medium text-muted-foreground">Este valor é uma estimativa</label>
                </div>

                {isEdit && bill?.status === 'paid' && (
                    <div><label className={labelClass}>Anexo</label>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} text-left ${formState.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}>
                            <Paperclip className="h-4 w-4" />{formState.attachmentFilename || 'Escolher arquivo...'}
                        </button>
                    </div>
                )}

                {!isEdit && (
                    <div>
                        <label className={labelClass}>Tipo de Pagamento</label>
                        <div className="flex bg-muted/50 dark:bg-dark-muted/50 p-1 rounded-lg">
                            <button type="button" onClick={() => setFormState(f => ({ ...f, paymentType: 'single' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.paymentType === 'single' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Único</button>
                            <button type="button" onClick={() => setFormState(f => ({ ...f, paymentType: 'installments' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.paymentType === 'installments' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Parcelado</button>
                            <button type="button" onClick={() => setFormState(f => ({ ...f, paymentType: 'monthly' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.paymentType === 'monthly' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Mensal</button>
                        </div>
                    </div>
                )}
                {formState.paymentType === 'installments' && !isEdit && (
                    <div><label className={labelClass}>Número de Parcelas</label><input type="number" value={formState.installments} min="2" onChange={e => setFormState(f => ({...f, installments: parseInt(e.target.value)}))} className={inputClass}/></div>
                )}

                <div><label className={labelClass}>Notas</label><textarea value={formState.notes} onChange={e => setFormState(f => ({...f, notes: e.target.value}))} className={inputClass} rows={2} disabled={!!linkedExpenseId}/></div>
            </div>
            <div className="flex justify-center"><SubmitButton isSubmitting={isSubmitting} text={linkedExpenseId ? 'Salvar e Vincular' : 'Salvar'} /></div>
        </form>
    );
};