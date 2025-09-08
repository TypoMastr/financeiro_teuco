import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
// FIX: Import types from the corrected types.ts file.
import { Member, Payment, Transaction, ViewState, Account, ActivityStatus, Leave } from '../types';
// FIX: Import missing functions from api.ts.
import { getMemberById, getPaymentsByMember, deletePayment, addIncomeTransactionAndPayment, accountsApi, getPaymentDetails, updatePaymentAndTransaction, leavesApi } from '../services/api';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ArrowLeft, Edit, Mail, Phone, Calendar, DollarSign, ChevronDown, Paperclip, MessageSquare, Trash, X as XIcon, Save, ClipboardPaste, AlertTriangle, Briefcase, Info } from './Icons';
import { PageHeader, SubmitButton, DateField } from './common/PageLayout';
import { useToast } from './Notifications';


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

const MemberProfile: React.FC<{ viewState: ViewState; setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
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
    const [expandedDetail, setExpandedDetail] = useState<{ id: string; type: 'comment' | 'attachment' | 'delete' } | null>(null);
    const isInitialLoad = useRef(true);
    const toast = useToast();
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);
    const [isLeavesExpanded, setIsLeavesExpanded] = useState(false);
    const [leaveToDelete, setLeaveToDelete] = useState<Leave | null>(null);


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
        setExpandedDetail(null);
        await fetchData(true);
    };

    const handleConfirmLeaveDelete = async () => {
        if (!leaveToDelete) return;
        await leavesApi.remove(leaveToDelete.id);
        toast.success("Licença excluída com sucesso.");
        setLeaveToDelete(null);
        await fetchData(true);
    };
    
    const handleToggleDetail = (id: string, type: 'comment' | 'attachment' | 'delete') => {
        if (expandedDetail?.id === id && expandedDetail?.type === type) {
            setExpandedDetail(null);
        } else {
            setExpandedDetail({ id, type });
        }
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

    // FIX: Added 'Arquivado' style to match the ActivityStatus type definition.
    const activityStatusStyles: { [key in ActivityStatus]: string } = {
        Ativo: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
        Inativo: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
        Desligado: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
        Arquivado: 'bg-gray-300 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    };
    
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
                                                        const isExpanded = (id: string, type: 'comment' | 'attachment' | 'delete') => expandedDetail?.id === id && expandedDetail?.type === type;

                                                        if (payment) {
                                                            // Always show payment if it exists
                                                        } else if (onLeave) {
                                                            return (
                                                                <div key={month} className="flex items-center gap-2 p-2 sm:p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg">
                                                                    <Briefcase className="h-4 w-4 text-blue-500 flex-shrink-0"/>
                                                                    <span className="font-semibold capitalize text-sm sm:text-base text-blue-700 dark:text-blue-300">{monthName} - Em Licença</span>
                                                                </div>
                                                            );
                                                        }
                                                        
                                                        const monthBgClass = isPaid ? 'bg-success-strong dark:bg-dark-success-strong' : isDue ? 'bg-danger-strong dark:bg-dark-danger-strong' : 'bg-gray-200/60 dark:bg-gray-800/20';

                                                        return (
                                                            <motion.div 
                                                            key={month} 
                                                            className={`rounded-lg transition-all duration-300 ${monthBgClass}`}
                                                            layout
                                                            >
                                                                <div className="flex justify-between items-center p-2 sm:p-3">
                                                                    <div>
                                                                        <span className="font-semibold capitalize text-sm sm:text-base">{monthName}</span>
                                                                        {payment && (
                                                                            <div className="text-xs text-green-800/80 dark:text-green-300/80 mt-1">
                                                                                <span className="font-bold">{formatCurrency(payment.amount)}</span>
                                                                                <span className="ml-1">em {new Date(payment.paymentDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {payment ? (
                                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                                            <motion.button
                                                                                onClick={() => setView({ name: 'edit-payment-form', id: memberId, paymentId: payment.id, returnView: currentView })}
                                                                                aria-label="Editar pagamento"
                                                                                className="w-10 h-10 flex items-center justify-center rounded-full transition-all bg-card dark:bg-dark-secondary text-muted-foreground hover:text-foreground shadow-sm border border-border dark:border-dark-border hover:border-primary"
                                                                                whileTap={{ scale: 0.9 }}
                                                                            >
                                                                                <Edit className="h-5 w-5" />
                                                                            </motion.button>
                                                                            {payment.attachmentUrl && (
                                                                                <motion.button
                                                                                    onClick={() => setView({ name: 'attachment-view', attachmentUrl: payment.attachmentUrl!, returnView: currentView })}
                                                                                    aria-label="Ver anexo"
                                                                                    className="w-10 h-10 flex items-center justify-center rounded-full transition-all bg-card dark:bg-dark-secondary text-muted-foreground hover:text-foreground shadow-sm border border-border dark:border-dark-border hover:border-primary"
                                                                                    whileTap={{ scale: 0.9 }}
                                                                                >
                                                                                    <Paperclip className="h-5 w-5" />
                                                                                </motion.button>
                                                                            )}
                                                                            {payment.comments && (
                                                                                <motion.button
                                                                                    onClick={() => handleToggleDetail(payment.id, 'comment')}
                                                                                    aria-label="Ver observações"
                                                                                    className="w-10 h-10 flex items-center justify-center rounded-full transition-all bg-card dark:bg-dark-secondary text-muted-foreground hover:text-foreground shadow-sm border border-border dark:border-dark-border hover:border-primary"
                                                                                    whileTap={{ scale: 0.9 }}
                                                                                >
                                                                                    <MessageSquare className="h-5 w-5" />
                                                                                </motion.button>
                                                                            )}
                                                                            <motion.button
                                                                                onClick={() => handleToggleDetail(payment.id, 'delete')}
                                                                                aria-label="Excluir pagamento"
                                                                                className="w-10 h-10 flex items-center justify-center rounded-full transition-all bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
                                                                                whileTap={{ scale: 0.9 }}
                                                                            >
                                                                                <Trash className="h-5 w-5" />
                                                                            </motion.button>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={() => setView({ name: 'payment-form', id: memberId, month, returnView: currentView })} className="bg-primary shadow-sm shadow-primary/30 text-primary-foreground font-bold text-xs py-2 px-3 rounded-full hover:bg-primary/90 transition-all">
                                                                            Registrar
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <AnimatePresence>
                                                                {payment && isExpanded(payment.id, 'comment') && payment.comments && (
                                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden" transition={{ duration: 0.3, ease: 'easeInOut' }}>
                                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="border-t border-black/10 dark:border-white/10 mx-3 pb-3">
                                                                        <div className="pt-3 space-y-3 text-sm">
                                                                        <div>
                                                                            <h5 className="font-bold text-gray-700 dark:text-gray-300 mb-1">Observações:</h5>
                                                                            <p className="text-muted-foreground whitespace-pre-wrap">{payment.comments}</p>
                                                                        </div>
                                                                        </div>
                                                                    </motion.div>
                                                                    </motion.div>
                                                                )}
                                                                </AnimatePresence>
                                                                <AnimatePresence>
                                                                {payment && isExpanded(payment.id, 'delete') && (
                                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden" transition={{ duration: 0.3, ease: 'easeInOut' }}>
                                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="border-t border-danger/20 mx-3 pb-3">
                                                                        <div className="pt-3 text-center space-y-3">
                                                                        <p className="text-sm font-semibold text-danger">Confirmar exclusão do pagamento?</p>
                                                                        <div className="flex justify-center gap-3">
                                                                            <button onClick={() => setExpandedDetail(null)} className="px-4 py-1.5 text-xs font-semibold rounded-full bg-secondary dark:bg-dark-secondary hover:bg-muted dark:hover:bg-dark-muted">Cancelar</button>
                                                                            <button onClick={() => handleConfirmPaymentDelete(payment.id)} className="px-4 py-1.5 text-xs font-semibold rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">Sim, excluir</button>
                                                                        </div>
                                                                        </div>
                                                                    </motion.div>
                                                                    </motion.div>
                                                                )}
                                                                </AnimatePresence>
                                                            </motion.div>
                                                        )
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

export const PaymentFormPage: React.FC<{ viewState: ViewState; setView: (view: ViewState) => void; }> = ({ viewState, setView }) => {
    const { id: memberId, month, returnView } = viewState as { name: 'payment-form', id: string, month: string, returnView: ViewState };
    const [member, setMember] = useState<Member | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const [formState, setFormState] = useState({ 
        paymentDate: new Date().toISOString().slice(0, 10), 
        comments: '', 
        attachmentUrl: '', 
        attachmentFilename: '',
        accountId: '',
        amount: 0,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [amountStr, setAmountStr] = useState('');

    const [isHistoricalPayment, setIsHistoricalPayment] = useState(false);

    const shouldShowHistoricalOption = useMemo(() => {
        if (!formState.paymentDate) return false;
        // Adiciona a hora para garantir a comparação correta entre fusos horários.
        const paymentDateObj = new Date(formState.paymentDate + 'T12:00:00Z');
        const cutoffDate = new Date('2025-09-01T00:00:00Z');
        return paymentDateObj < cutoffDate;
    }, [formState.paymentDate]);

    useEffect(() => {
        // Marca/desmarca automaticamente a caixa com base na data de pagamento.
        setIsHistoricalPayment(shouldShowHistoricalOption);
    }, [shouldShowHistoricalOption]);
    
    const formatCurrencyForInput = (value: number): string => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };
    
    useEffect(() => {
        const loadData = async () => {
            if (memberId) {
                setLoading(true);
                const [memberData, accountsData] = await Promise.all([
                    getMemberById(memberId),
                    accountsApi.getAll()
                ]);
                
                if (memberData) {
                    setMember(memberData);
                    setFormState(s => ({ ...s, amount: memberData.monthlyFee }));
                    setAmountStr(formatCurrencyForInput(memberData.monthlyFee));
                }
                setAccounts(accountsData);
                if (accountsData.length > 0) {
                    setFormState(s => ({ ...s, accountId: accountsData[0].id }));
                }
                setLoading(false);
            } else {
                setLoading(false);
            }
        };
        loadData();
    }, [memberId]);

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
                    const fileExtension = supportedType.split('/')[1];
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
        if (isSubmitting || !member || !month || !returnView) return;

        if (!formState.accountId && !isHistoricalPayment) {
            toast.error("Nenhuma conta de destino selecionada. Por favor, crie uma conta em Ajustes.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { warning } = await addIncomeTransactionAndPayment(
              { 
                description: `Mensalidade ${member.name} - ${new Date(month + '-02').toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}`,
                amount: formState.amount,
                date: new Date(formState.paymentDate + 'T12:00:00Z').toISOString(),
                accountId: formState.accountId,
                comments: formState.comments,
              }, 
              {
                memberId: member.id,
                referenceMonth: month,
                attachmentUrl: formState.attachmentUrl,
                attachmentFilename: formState.attachmentFilename,
              },
              isHistoricalPayment
            );

            if (warning) {
                toast.success("Pagamento registrado, mas o anexo falhou.");
                toast.info(warning);
            } else {
                toast.success("Pagamento registrado com sucesso!");
            }
            setView(returnView);
        } catch (error: any) {
            console.error("Erro ao registrar pagamento:", error);
            toast.error(`Falha ao registrar pagamento: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
        }
    };

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
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!member || !month || !returnView) {
        if(returnView) setView(returnView); else setView({name: 'members'});
        return null;
    }

    const inputClass = "w-full text-base rounded-lg border-border dark:border-dark-border bg-card dark:bg-dark-input shadow-sm focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none px-4 py-2.5 transition";
    const labelClass = "block text-sm font-medium text-muted-foreground mb-1.5";
    
    const monthName = new Date(month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
             <PageHeader title="Registrar Pagamento" onBack={() => setView(returnView)} />
            
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                 <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <label htmlFor="paymentAmount" className="text-sm font-medium text-primary">Valor para {monthName}:</label>
                    <input
                        id="paymentAmount"
                        type="text"
                        value={amountStr}
                        onChange={handleAmountChange}
                        className="w-full text-3xl font-bold text-primary bg-transparent border-0 text-center focus:ring-0 p-0"
                        required
                    />
                </div>

                {shouldShowHistoricalOption && (
                    <div className="p-3 bg-yellow-100/70 dark:bg-yellow-900/30 rounded-lg flex items-center gap-3 border border-yellow-300/50 dark:border-yellow-500/30">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        <div className="flex-1">
                             <label htmlFor="historicalPayment" className="text-sm text-yellow-900 dark:text-yellow-200 cursor-pointer">
                                Pagamento histórico <strong className="font-semibold">(não gera transação financeira)</strong>
                            </label>
                        </div>
                        <input
                            type="checkbox"
                            id="historicalPayment"
                            checked={isHistoricalPayment}
                            onChange={(e) => setIsHistoricalPayment(e.target.checked)}
                            className="h-5 w-5 rounded border-yellow-400 dark:border-yellow-600 text-primary focus:ring-primary bg-transparent flex-shrink-0"
                        />
                    </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <DateField
                          id="paymentDate"
                          label="Data do Pagamento"
                          value={formState.paymentDate}
                          onChange={date => setFormState(s => ({ ...s, paymentDate: date }))}
                          required
                        />
                    </div>
                     <div>
                        <label htmlFor="accountId" className={labelClass}>Conta de Destino</label>
                        <select id="accountId" value={formState.accountId} onChange={e => setFormState(s => ({...s, accountId: e.target.value}))} required={!isHistoricalPayment} disabled={isHistoricalPayment} className={`${inputClass} !py-3 disabled:bg-muted/50 dark:disabled:bg-dark-muted/50 disabled:cursor-not-allowed`}>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label htmlFor="comments" className={labelClass}>Observações (Opcional)</label>
                    <textarea id="comments" value={formState.comments} onChange={e => setFormState(s => ({ ...s, comments: e.target.value }))} rows={2} className={`${inputClass} leading-snug`} placeholder="Alguma nota sobre este pagamento..."></textarea>
                </div>
                 <div>
                    <label htmlFor="attachment" className={labelClass}>Anexar Comprovante (Opcional)</label>
                    <input type="file" id="attachment" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                     <div className="flex gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} flex-1 text-left ${formState.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}>
                            <Paperclip className="h-4 w-4" />
                            {formState.attachmentFilename || 'Escolher arquivo...'}
                        </button>
                        <button type="button" onClick={handlePasteAttachment} className="p-3 rounded-lg bg-card dark:bg-dark-input border border-border dark:border-dark-border text-muted-foreground hover:text-primary transition-colors">
                            <ClipboardPaste className="h-5 w-5" />
                        </button>
                    </div>
                 </div>
            </div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex justify-center"
            >
                <SubmitButton isSubmitting={isSubmitting} text="Confirmar Pagamento" />
            </motion.div>
        </form>
    );
};

export const PaymentEditFormPage: React.FC<{ viewState: ViewState; setView: (view: ViewState) => void; }> = ({ viewState, setView }) => {
    const { paymentId, returnView } = viewState as { name: 'edit-payment-form', paymentId: string, returnView: ViewState };
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [paymentDetails, setPaymentDetails] = useState<{ payment: Payment, transaction: Transaction | null } | null>(null);
    const toast = useToast();

    const [formState, setFormState] = useState({ 
        paymentDate: '', 
        comments: '', 
        attachmentUrl: '', 
        attachmentFilename: '',
        accountId: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadData = async () => {
            if (paymentId) {
                setLoading(true);
                const [details, accountsData] = await Promise.all([
                    getPaymentDetails(paymentId),
                    accountsApi.getAll()
                ]);

                if (details) {
                    setPaymentDetails(details);
                    setFormState({
                        paymentDate: details.payment.paymentDate.slice(0, 10),
                        comments: details.payment.comments || '',
                        attachmentUrl: details.payment.attachmentUrl || '',
                        attachmentFilename: details.payment.attachmentFilename || '',
                        accountId: details.transaction?.accountId || '',
                    });
                }
                setAccounts(accountsData);
                setLoading(false);
            }
        };
        loadData();
    }, [paymentId]);

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
                    const fileExtension = supportedType.split('/')[1];
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
            console.error('Paste error:', err);
            toast.error('Falha ao colar da área de transferência.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || !paymentDetails) return;
        setIsSubmitting(true);
        try {
            const { warning } = await updatePaymentAndTransaction(paymentId, paymentDetails.transaction?.id, formState);
            if (warning) {
                toast.success("Pagamento atualizado, mas o anexo falhou.");
                toast.info(warning);
            } else {
                toast.success("Pagamento atualizado com sucesso!");
            }
            setView(returnView);
        } catch (error: any) {
            console.error("Erro ao atualizar pagamento:", error);
            toast.error(`Falha ao atualizar pagamento: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
        }
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!paymentDetails) {
        toast.error("Detalhes do pagamento não encontrados.");
        setView(returnView);
        return null;
    }

    const inputClass = "w-full text-base rounded-lg border-border dark:border-dark-border bg-card dark:bg-dark-input shadow-sm focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none px-4 py-2.5 transition";
    const labelClass = "block text-sm font-medium text-muted-foreground mb-1.5";
    const monthName = new Date(paymentDetails.payment.referenceMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Editar Pagamento" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <p className="text-sm font-medium text-primary">Editando pagamento de {monthName}:</p>
                    <p className="text-3xl font-bold text-primary">{formatCurrency(paymentDetails.payment.amount)}</p>
                </div>

                {!paymentDetails.transaction && (
                    <div className="p-3 bg-yellow-100/70 dark:bg-yellow-900/30 rounded-lg flex items-start gap-3 border border-yellow-300/50 dark:border-yellow-500/30">
                        <Info className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-900 dark:text-yellow-200">
                            Este é um <strong className="font-semibold">pagamento histórico</strong> e não possui uma transação financeira associada. A conta de destino não pode ser alterada.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <DateField
                          id="paymentDate"
                          label="Data do Pagamento"
                          value={formState.paymentDate}
                          onChange={date => setFormState(s => ({ ...s, paymentDate: date }))}
                          required
                        />
                    </div>
                    {paymentDetails.transaction && (
                        <div>
                            <label htmlFor="accountId" className={labelClass}>Conta de Destino</label>
                            <select id="accountId" value={formState.accountId} onChange={e => setFormState(s => ({...s, accountId: e.target.value}))} required className={`${inputClass} !py-3`}>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <div>
                    <label htmlFor="comments" className={labelClass}>Observações (Opcional)</label>
                    <textarea id="comments" value={formState.comments} onChange={e => setFormState(s => ({ ...s, comments: e.target.value }))} rows={2} className={`${inputClass} leading-snug`} placeholder="Alguma nota sobre este pagamento..."></textarea>
                </div>
                <div>
                    <label htmlFor="attachment" className={labelClass}>Anexar Comprovante (Opcional)</label>
                    <input type="file" id="attachment" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} flex-1 text-left ${formState.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}>
                            <Paperclip className="h-4 w-4" />
                            {formState.attachmentFilename || 'Escolher arquivo...'}
                        </button>
                        <button type="button" onClick={handlePasteAttachment} className="p-3 rounded-lg bg-card dark:bg-dark-input border border-border dark:border-dark-border text-muted-foreground hover:text-primary transition-colors">
                            <ClipboardPaste className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex justify-center">
                <SubmitButton isSubmitting={isSubmitting} text="Salvar Alterações" />
            </div>
        </form>
    );
};