import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Member, Payment, Transaction, ViewState, Account, ActivityStatus, Leave } from '../types';
import { getMemberById, getPaymentsByMember, deletePayment, addIncomeTransactionAndPayment, accountsApi, getPaymentDetails, updatePaymentAndTransaction, leavesApi } from '../services/api';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ArrowLeft, Edit, Mail, Phone, Calendar, DollarSign, ChevronDown, Paperclip, MessageSquare, Trash, X as XIcon, Save, ClipboardPaste, AlertTriangle, Briefcase, Info, Receipt } from './Icons';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { DateField } from './common/FormControls';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';


const formatPhone = (phone: string) => {
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
    return phone;
};

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const infoItemVariants: Variants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
};

const InfoItem: React.FC<{ label: string, value?: string, icon: React.ReactNode }> = ({ label, value, icon }) => (
    <motion.div variants={infoItemVariants} className="flex items-start gap-4 py-3 border-b border-border/70 dark:border-dark-border/70 last:border-b-0">
        <div className="text-muted-foreground mt-0.5">{icon}</div>
        <div className="flex-1">
            <p className="font-semibold text-base text-foreground dark:text-dark-foreground">{value || 'Não informado'}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        </div>
    </motion.div>
);

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
  exit: { y: 20, opacity: 0 }
};

const ConfirmationModal: React.FC<{
    payment: Payment;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ payment, onClose, onConfirm }) => (
     <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
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
                    <Trash className="h-6 w-6 text-destructive" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-xl font-bold font-display text-foreground dark:text-dark-foreground">Excluir Pagamento?</h3>
                <div className="mt-2 text-sm text-muted-foreground">
                    <p>
                        Tem certeza que deseja remover o pagamento de <span className="font-semibold">{formatCurrency(payment.amount)}</span> referente a <span className="font-semibold">{new Date(payment.referenceMonth + '-02').toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}</span>?
                    </p>
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
);

const MemberProfile: React.FC<{ viewState: ViewState; }> = ({ viewState }) => {
    const { setView } = useApp();
    const { id: memberId, componentState } = viewState as { name: 'member-profile', id: string, componentState?: any };
    if (!memberId) {
        setView({ name: 'members' });
        return null;
    }
    
    const [member, setMember] = useState<Member | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [loading, setLoading] = useState(true);
    const [openYear, setOpenYear] = useState(componentState?.openYear || new Date().getFullYear().toString());
    const isInitialLoad = useRef(true);
    const toast = useToast();
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);
    const [isLeavesExpanded, setIsLeavesExpanded] = useState(false);
    const [leaveToDelete, setLeaveToDelete] = useState<Leave | null>(null);
    const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
    const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);


    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const updateExpandedState = () => setIsInfoExpanded(mediaQuery.matches);
        
        if (typeof componentState?.isInfoExpanded === 'boolean') {
            setIsInfoExpanded(componentState.isInfoExpanded);
        } else {
            updateExpandedState();
        }
        
        mediaQuery.addEventListener('change', updateExpandedState);
        return () => mediaQuery.removeEventListener('change', updateExpandedState);
    }, [componentState]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const updateLeavesExpandedState = () => setIsLeavesExpanded(mediaQuery.matches || (member?.onLeave || false));
        
        if (typeof componentState?.isLeavesExpanded === 'boolean') {
            setIsLeavesExpanded(componentState.isLeavesExpanded);
        } else {
            updateLeavesExpandedState();
        }
        
        mediaQuery.addEventListener('change', updateLeavesExpandedState);
        return () => mediaQuery.removeEventListener('change', updateLeavesExpandedState);
    }, [componentState, member?.onLeave]);


    const fetchData = useCallback(async (isUpdate = false) => {
        if (!isUpdate && isInitialLoad.current) {
            setLoading(true);
        }
        try {
            const [memberData, paymentsData, leavesData] = await Promise.all([
                getMemberById(memberId),
                getPaymentsByMember(memberId),
                leavesApi.getByMember(memberId)
            ]);
            if (memberData) {
                setMember(memberData);
                setPayments(paymentsData);
                setLeaves(leavesData);
            } else {
                setView({ name: 'members' });
            }
        } catch (error) {
            console.error(error);
            toast.error("Falha ao carregar dados do membro.");
        } finally {
            if (isInitialLoad.current) {
                setLoading(false);
                isInitialLoad.current = false;
            } else if (!isUpdate) {
                setLoading(false);
            }
        }
    }, [memberId, setView, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleConfirmPaymentDelete = async (paymentId: string) => {
        await deletePayment(paymentId);
        toast.success("Pagamento excluído com sucesso.");
        setPaymentToDelete(null);
        await fetchData(true);
    };

    const handleConfirmLeaveDelete = async () => {
        if (!leaveToDelete) return;
        await leavesApi.remove(leaveToDelete.id);
        toast.success("Licença excluída com sucesso.");
        setLeaveToDelete(null);
        await fetchData(true);
    };
    
    const handleTogglePaymentExpand = (paymentId: string) => {
        setExpandedPayments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(paymentId)) {
                newSet.delete(paymentId);
            } else {
                newSet.add(paymentId);
            }
            return newSet;
        });
    };
    
    const parseDateAsUTC = useCallback((dateString: string) => {
        if (!dateString) return new Date(NaN);
        const datePart = dateString.slice(0, 10);
        const [year, month, day] = datePart.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
    }, []);

    const isDuringLeave = useCallback((date: Date, leaves: Leave[]): boolean => {
        return leaves.some(leave => {
            const startDate = parseDateAsUTC(leave.startDate);
            const endDate = leave.endDate ? parseDateAsUTC(leave.endDate) : null;

            if (isNaN(startDate.getTime())) return false;

            if (endDate) {
                const endOfDay = new Date(endDate);
                endOfDay.setUTCHours(23, 59, 59, 999);
                return date >= startDate && date <= endOfDay;
            }
            return date >= startDate;
        });
    }, [parseDateAsUTC]);

    const paymentMonthsByYear = useMemo(() => {
        if (!member) return {};
        const groups: Record<string, { month: string, monthName: string, payment: Payment | null, onLeave: boolean }[]> = {};
        
        let currentDate = parseDateAsUTC(member.joinDate);
        currentDate.setUTCDate(1);
        
        const today = new Date();
        const defaultEndDate = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), 1));
        const endDate = member.activityStatus === 'Desligado' ? today : defaultEndDate;

        while (currentDate <= endDate) {
            const year = currentDate.getUTCFullYear().toString();
            const monthStr = currentDate.toISOString().slice(0, 7);
            if (!groups[year]) groups[year] = [];
            
            groups[year].push({
                month: monthStr,
                monthName: currentDate.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' }),
                payment: payments.find(p => p.referenceMonth === monthStr) || null,
                onLeave: isDuringLeave(currentDate, leaves),
            });
            currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
        }
        Object.keys(groups).forEach(year => groups[year].reverse());
        return groups;
    }, [member, payments, leaves, parseDateAsUTC, isDuringLeave]);

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!member) return <div className="text-center py-10">Membro não encontrado. <button onClick={() => setView({ name: 'members' })} className="text-primary underline">Voltar para a lista</button></div>;
    
    const currentView: ViewState = {
        name: 'member-profile',
        id: memberId,
        componentState: { openYear, isInfoExpanded, isLeavesExpanded }
    };

    const activityStatusStyles: { [key in ActivityStatus]: string } = {
        Ativo: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
        Inativo: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
        Desligado: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
        Arquivado: 'bg-gray-300 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    };
    
    const ActionButton: React.FC<{ icon: React.ReactNode, label: string, onClick: (e: React.MouseEvent) => void, destructive?: boolean }> = ({ icon, label, onClick, destructive = false }) => (
        <button 
            onClick={onClick} 
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${destructive ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground hover:bg-muted dark:hover:bg-dark-muted'}`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="space-y-8">
            <motion.div 
              variants={itemVariants}
              className="w-full flex justify-start"
            >
                 <motion.button 
                    onClick={() => setView({ name: 'members' })} 
                    className="text-sm font-semibold transition-all duration-200 bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground py-2 px-4 sm:py-2.5 sm:px-5 rounded-full border border-border dark:border-dark-border shadow-btn hover:-translate-y-0.5 hover:shadow-lg dark:shadow-dark-btn flex items-center gap-2" 
                    whileTap={{scale: 0.95}}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                </motion.button>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-card dark:bg-dark-card rounded-xl p-4 sm:p-6 border border-border dark:border-dark-border">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                    <motion.div 
                      variants={itemVariants}
                      className="w-20 h-20 sm:w-28 sm:h-28 bg-primary text-primary-foreground dark:bg-dark-primary dark:text-dark-primary-foreground rounded-full flex items-center justify-center font-bold text-4xl sm:text-5xl flex-shrink-0 -mt-10 sm:-mt-12 sm:-ml-12 border-4 border-card dark:border-dark-card"
                    >
                        {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </motion.div>
                    <motion.div 
                      className="flex-grow w-full text-center sm:text-left"
                      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                    >
                        <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start">
                             <motion.div variants={itemVariants}>
                                <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">{member.name}</h2>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-2 mt-2 text-sm text-muted-foreground">
                                   <div className={`py-1 px-3 rounded-full font-semibold text-xs ${activityStatusStyles[member.activityStatus]}`}>{member.activityStatus}</div>
                                   {member.onLeave && <div className="py-1 px-3 rounded-full font-semibold text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Em Licença</div>}
                                   <span className="py-1 px-3 rounded-full font-semibold text-xs bg-muted dark:bg-dark-muted text-muted-foreground dark:text-dark-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3"/>Desde {new Date(member.joinDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'})}</span>
                                </div>
                                {/* Departure date display removed due to schema mismatch error */}
                            </motion.div>
                             <motion.div variants={itemVariants} className="mt-4 sm:mt-0">
                                <motion.button onClick={() => setView({ name: 'edit-member', id: member.id })} className="bg-secondary dark:bg-dark-secondary text-sm text-secondary-foreground dark:text-dark-secondary-foreground font-semibold py-2 px-4 rounded-full hover:bg-muted dark:hover:bg-dark-muted transition-colors flex items-center gap-2" whileTap={{scale: 0.95}}><Edit className="h-4 w-4"/>Editar</motion.button>
                             </motion.div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            <motion.div 
                variants={itemVariants}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
                <div className="lg:col-span-1 space-y-6">
                    <motion.div 
                        variants={itemVariants} 
                        className="bg-card dark:bg-dark-card rounded-xl p-4 sm:p-6 border border-border dark:border-dark-border"
                        layout
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                        <button 
                            onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                            className="w-full flex justify-between items-center"
                            aria-expanded={isInfoExpanded}
                            aria-controls="member-info-details"
                        >
                            <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Informações</h3>
                            <motion.div animate={{ rotate: isInfoExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            </motion.div>
                        </button>

                        <AnimatePresence initial={false}>
                            {isInfoExpanded && (
                                <motion.div
                                    id="member-info-details"
                                    key="info-content"
                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                    animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }}
                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                >
                                    <motion.div 
                                        className="space-y-1"
                                        variants={{
                                            visible: { transition: { staggerChildren: 0.05 } }
                                        }}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        <InfoItem label="E-MAIL" value={member.email} icon={<Mail className="h-5 w-5"/>} />
                                        <InfoItem label="TELEFONE" value={formatPhone(member.phone)} icon={<Phone className="h-5 w-5"/>} />
                                        <InfoItem label="ANIVERSÁRIO" value={member.birthday ? new Date(member.birthday + 'T12:00:00Z').toLocaleDateString('pt-BR', {day: '2-digit', month: 'long'}) : undefined} icon={<Calendar className="h-5 w-5"/>} />
                                        <InfoItem label="MENSALIDADE" value={formatCurrency(member.monthlyFee)} icon={<DollarSign className="h-5 w-5"/>} />
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                    
                    <motion.div 
                        variants={itemVariants} 
                        className="bg-card dark:bg-dark-card rounded-xl p-4 sm:p-6 border border-border dark:border-dark-border"
                        layout
                    >
                        <button 
                            onClick={() => setIsLeavesExpanded(!isLeavesExpanded)}
                            className="w-full flex justify-between items-center"
                            aria-expanded={isLeavesExpanded}
                            aria-controls="member-leaves-details"
                        >
                            <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Licenças</h3>
                            <motion.div animate={{ rotate: isLeavesExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            </motion.div>
                        </button>
                        
                        <AnimatePresence initial={false}>
                        {isLeavesExpanded && (
                            <motion.div
                                id="member-leaves-details"
                                key="leaves-content"
                                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }}
                                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className="space-y-3">
                                    {leaves.length > 0 ? (
                                        leaves.map(leave => (
                                            <div key={leave.id} className="bg-background dark:bg-dark-background/60 p-3 rounded-md border border-border dark:border-dark-border">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-semibold text-sm">
                                                            {new Date(leave.startDate + 'T12:00:00Z').toLocaleDateString('pt-BR')} - {leave.endDate ? new Date(leave.endDate + 'T12:00:00Z').toLocaleDateString('pt-BR') : <span className="text-blue-500">Ativa</span>}
                                                        </p>
                                                        {leave.reason && <p className="text-xs text-muted-foreground mt-1">{leave.reason}</p>}
                                                    </div>
                                                    <div className="flex-shrink-0 flex items-center">
                                                        <button onClick={() => setView({ name: 'leave-form', memberId: member.id, leaveId: leave.id, returnView: currentView })} className="p-2 text-muted-foreground hover:text-primary rounded-full" title="Editar Licença"><Edit className="h-4 w-4"/></button>
                                                        <button onClick={() => setLeaveToDelete(leave)} className="p-2 text-muted-foreground hover:text-danger rounded-full" title="Excluir Licença"><Trash className="h-4 w-4"/></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-center text-muted-foreground py-2">Nenhuma licença registrada.</p>
                                    )}
                                </div>
                                <button 
                                    onClick={() => setView({ name: 'leave-form', memberId: member.id, returnView: currentView })}
                                    className="w-full mt-4 text-center bg-primary/10 text-primary font-semibold py-2 px-4 rounded-md text-sm hover:bg-primary/20 transition-colors"
                                >
                                    Registrar Nova Licença
                                </button>
                             </motion.div>
                        )}
                        </AnimatePresence>
                    </motion.div>
                </div>
                 <motion.div variants={itemVariants} className="lg:col-span-2">
                    <motion.div 
                      className="bg-card dark:bg-dark-card rounded-xl p-4 sm:p-6 border border-border dark:border-dark-border"
                      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                    >
                        <motion.h3 variants={itemVariants} className="text-xl font-bold font-display text-foreground dark:text-dark-foreground mb-4">Histórico de Pagamentos</motion.h3>
                        {member.isExempt ? (
                             <motion.div variants={itemVariants} className="text-center py-10 bg-background dark:bg-dark-background/60 rounded-lg border border-border dark:border-dark-border">
                                <p className="font-semibold text-lg text-cyan-600 dark:text-cyan-400">Membro Isento</p>
                                <p className="text-muted-foreground mt-1">Este membro não gera cobranças de mensalidade.</p>
                            </motion.div>
                        ) : (
                            <motion.div variants={itemVariants} className="space-y-2">
                                {Object.keys(paymentMonthsByYear).sort((a,b) => parseInt(b) - parseInt(a)).map(year => (
                                    <motion.div layout variants={itemVariants} key={year} className="bg-background dark:bg-dark-background/60 rounded-lg border border-border dark:border-dark-border overflow-hidden">
                                        <button onClick={() => setOpenYear(openYear === year ? '' : year)} className="w-full flex justify-between items-center p-4 font-bold text-lg text-left hover:bg-muted/50 dark:hover:bg-dark-muted/50 transition-colors">
                                            <span>Ano de {year}</span>
                                            <motion.span animate={{ rotate: openYear === year ? 0 : -90 }} className={`transition-transform`}>
                                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                            </motion.span>
                                        </button>
                                        <AnimatePresence initial={false}>
                                        {openYear === year && (
                                            <motion.div
                                            key="content"
                                            initial={{ height: 0, opacity: 0 }} 
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                            className="overflow-hidden"
                                            >
                                                <div className="px-2 pb-2 space-y-1">
                                                    {paymentMonthsByYear[year].map(({month, monthName, payment, onLeave}) => {
                                                        const isPaid = !!payment;
                                                        const isDue = new Date(month + '-01') <= new Date() && !isPaid && member.activityStatus !== 'Desligado';
                                                        
                                                        if (payment) {
                                                            const isCardExpanded = expandedPayments.has(payment.id);
                                                            return (
                                                                <motion.div layout key={month} className="rounded-lg transition-all duration-300 bg-success-strong dark:bg-dark-success-strong">
                                                                    <button onClick={() => handleTogglePaymentExpand(payment.id)} className="w-full flex justify-between items-center p-2 sm:p-3 text-left">
                                                                        <div>
                                                                            <span className="font-semibold capitalize text-sm sm:text-base">{monthName}</span>
                                                                            <div className="text-xs text-green-800/80 dark:text-green-300/80 mt-1">
                                                                                <span className="font-bold">{formatCurrency(payment.amount)}</span>
                                                                                <span className="ml-1">em {new Date(payment.paymentDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                                                            </div>
                                                                        </div>
                                                                        <motion.div animate={{ rotate: isCardExpanded ? 180 : 0 }}>
                                                                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                                                        </motion.div>
                                                                    </button>
                                                                    <AnimatePresence>
                                                                        {isCardExpanded && (
                                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
                                                                                <div className="px-3 pb-3 pt-2 border-t border-black/10 dark:border-white/10 space-y-3">
                                                                                    {payment.comments && (
                                                                                        <div>
                                                                                            <h5 className="font-bold text-xs uppercase text-muted-foreground mb-1">Observações</h5>
                                                                                            <p className="text-sm text-foreground dark:text-dark-foreground/90 whitespace-pre-wrap">{payment.comments}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        {payment.transactionId && <ActionButton icon={<Receipt className="h-4 w-4"/>} label="Transação" onClick={(e) => { e.stopPropagation(); setView({ name: 'transaction-view', transactionId: payment.transactionId!, returnView: currentView })}} />}
                                                                                        {payment.attachmentUrl && <ActionButton icon={<Paperclip className="h-4 w-4"/>} label="Anexo" onClick={(e) => { e.stopPropagation(); setView({ name: 'attachment-view', attachmentUrl: payment.attachmentUrl!, returnView: currentView })}} />}
                                                                                        <ActionButton icon={<Edit className="h-4 w-4"/>} label="Editar" onClick={(e) => { e.stopPropagation(); setView({ name: 'edit-payment-form', id: memberId, paymentId: payment.id, returnView: currentView })}} />
                                                                                        <ActionButton icon={<Trash className="h-4 w-4"/>} label="Excluir" onClick={(e) => { e.stopPropagation(); setPaymentToDelete(payment); }} destructive />
                                                                                    </div>
                                                                                </div>
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </motion.div>
                                                            );
                                                        }

                                                        if (onLeave) {
                                                            return (
                                                                <div key={month} className="flex items-center gap-2 p-2 sm:p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg">
                                                                    <Briefcase className="h-4 w-4 text-blue-500 flex-shrink-0"/>
                                                                    <span className="font-semibold capitalize text-sm sm:text-base text-blue-700 dark:text-blue-300">{monthName} - Em Licença</span>
                                                                </div>
                                                            );
                                                        }
                                                        
                                                        const monthBgClass = isDue ? 'bg-danger-strong dark:bg-dark-danger-strong' : 'bg-gray-200/60 dark:bg-gray-800/20';

                                                        return (
                                                            <div key={month} className={`rounded-lg transition-all duration-300 ${monthBgClass}`}>
                                                                <div className="flex justify-between items-center p-2 sm:p-3">
                                                                    <span className="font-semibold capitalize text-sm sm:text-base">{monthName}</span>
                                                                    <button onClick={() => setView({ name: 'payment-form', id: memberId, month, returnView: currentView })} className="bg-primary shadow-sm shadow-primary/30 text-primary-foreground font-bold text-xs py-2 px-3 rounded-full hover:bg-primary/90 transition-all">
                                                                        Registrar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                                {member.activityStatus === 'Desligado' && (
                                    <motion.div variants={itemVariants} className="mt-4 text-center text-sm text-muted-foreground bg-background dark:bg-dark-background/60 p-3 rounded-lg">
                                        O histórico de pagamentos é exibido até a data de desligamento.
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                 </motion.div>
            </motion.div>

            <AnimatePresence>
                {paymentToDelete && (
                   <ConfirmationModal 
                        payment={paymentToDelete}
                        onClose={() => setPaymentToDelete(null)}
                        onConfirm={() => handleConfirmPaymentDelete(paymentToDelete.id)}
                   />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {leaveToDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setLeaveToDelete(null)}
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
                                    <Trash className="h-6 w-6 text-destructive" aria-hidden="true" />
                                </div>
                                <h3 className="mt-4 text-xl font-bold font-display text-foreground dark:text-dark-foreground">Excluir Licença?</h3>
                                <div className="mt-2">
                                    <p className="text-sm text-muted-foreground">
                                        Tem certeza que deseja remover a licença iniciada em <span className="font-semibold">{new Date(leaveToDelete.startDate + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span>?
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-center gap-4">
                                <button
                                    type="button"
                                    className="inline-flex justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-semibold text-foreground dark:text-dark-foreground shadow-sm hover:bg-muted dark:hover:bg-dark-muted"
                                    onClick={() => setLeaveToDelete(null)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex justify-center rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm hover:bg-destructive/90"
                                    onClick={handleConfirmLeaveDelete}
                                >
                                    Sim, Excluir
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MemberProfile;