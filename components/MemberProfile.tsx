import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Member, Payment, Transaction, ViewState, Account } from '../types';
import { getMemberById, getPaymentsByMember, deletePayment, addIncomeTransactionAndPayment, accountsApi } from '../services/api';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ArrowLeft, Edit, Mail, Phone, Calendar, DollarSign, ChevronDown, Paperclip, MessageSquare, Trash, X as XIcon, Save, ClipboardPaste } from './Icons';
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

const pageContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.05, staggerDirection: -1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
  exit: { y: 20, opacity: 0 }
};

const MemberProfile: React.FC<{ viewState: ViewState; setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { id: memberId, componentState } = viewState;
    if (!memberId) {
        setView({ name: 'members' });
        return null;
    }
    
    const [member, setMember] = useState<Member | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [openYear, setOpenYear] = useState(componentState?.openYear || new Date().getFullYear().toString());
    const [expandedDetail, setExpandedDetail] = useState<{ id: string; type: 'comment' | 'attachment' | 'delete' } | null>(null);
    const isInitialLoad = useRef(true);
    const toast = useToast();
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);

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

    const fetchData = useCallback(async (isUpdate = false) => {
        if (!isUpdate && isInitialLoad.current) {
            setLoading(true);
        }
        try {
            const [memberData, paymentsData] = await Promise.all([
                getMemberById(memberId),
                getPaymentsByMember(memberId)
            ]);
            if (memberData) {
                setMember(memberData);
                setPayments(paymentsData);
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

    const handleConfirmDelete = async (paymentId: string) => {
        await deletePayment(paymentId);
        toast.success("Pagamento excluído com sucesso.");
        setExpandedDetail(null);
        await fetchData(true);
    };
    
    const handleToggleDetail = (id: string, type: 'comment' | 'attachment' | 'delete') => {
        if (expandedDetail?.id === id && expandedDetail?.type === type) {
            setExpandedDetail(null);
        } else {
            setExpandedDetail({ id, type });
        }
    };

    const paymentMonthsByYear = useMemo(() => {
        if (!member) return {};
        const groups: Record<string, { month: string, monthName: string, payment: Payment | null }[]> = {};
        let currentDate = new Date(member.joinDate);
        currentDate.setDate(1);
        const endDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));

        while (currentDate <= endDate) {
            const year = currentDate.getFullYear().toString();
            const monthStr = currentDate.toISOString().slice(0, 7);
            if (!groups[year]) groups[year] = [];
            
            groups[year].push({
                month: monthStr,
                monthName: currentDate.toLocaleDateString('pt-BR', { month: 'long'}),
                payment: payments.find(p => p.referenceMonth === monthStr) || null
            });
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        Object.keys(groups).forEach(year => groups[year].reverse());
        return groups;
    }, [member, payments]);

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!member) return <div className="text-center py-10">Membro não encontrado. <button onClick={() => setView({ name: 'members' })} className="text-primary underline">Voltar para a lista</button></div>;
    
    const currentView: ViewState = {
        name: 'member-profile',
        id: memberId,
        componentState: { openYear, isInfoExpanded }
    };
    
    return (
        <motion.div 
          className="space-y-8"
          variants={pageContainerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
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
                                   <div className={`py-1 px-3 rounded-full font-semibold text-xs ${member.activityStatus === 'Ativo' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>{member.activityStatus}</div>
                                   <span className="py-1 px-3 rounded-full font-semibold text-xs bg-muted dark:bg-dark-muted text-muted-foreground dark:text-dark-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3"/>Desde {new Date(member.joinDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric'})}</span>
                                </div>
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
                <motion.div 
                    variants={itemVariants} 
                    className="lg:col-span-1"
                >
                    <motion.div 
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
                </motion.div>
                 <motion.div variants={itemVariants} className="lg:col-span-2">
                    <motion.div 
                      className="bg-card dark:bg-dark-card rounded-xl p-4 sm:p-6 border border-border dark:border-dark-border"
                      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                    >
                        <motion.h3 variants={itemVariants} className="text-xl font-bold font-display text-foreground dark:text-dark-foreground mb-4">Histórico de Pagamentos</motion.h3>
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
                                                {paymentMonthsByYear[year].map(({month, monthName, payment}) => {
                                                    const isPaid = !!payment;
                                                    const isDue = new Date(month + '-01') < new Date() && !isPaid;
                                                    const monthBgClass = isPaid ? 'bg-success-strong dark:bg-dark-success-strong' : isDue ? 'bg-danger-strong dark:bg-dark-danger-strong' : 'bg-gray-200/60 dark:bg-gray-800/20';
                                                    
                                                    const isExpanded = (id: string, type: 'comment' | 'attachment' | 'delete') => expandedDetail?.id === id && expandedDetail?.type === type;
                                                    
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
                                                                        <span className="ml-1">em {new Date(payment.paymentDate).toLocaleDateString('pt-BR')}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {payment ? (
                                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                                    {payment.attachmentUrl && (
                                                                        <motion.button
                                                                            onClick={() => setView({ name: 'attachment-view', attachmentUrl: payment.attachmentUrl, returnView: currentView })}
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
                                                                    <button onClick={() => handleConfirmDelete(payment.id)} className="px-4 py-1.5 text-xs font-semibold rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">Sim, excluir</button>
                                                                  </div>
                                                                </div>
                                                              </motion.div>
                                                            </motion.div>
                                                          )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                )})}
                                            </div>
                                        </motion.div>
                                    )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                 </motion.div>
            </motion.div>
        </motion.div>
    );
};

export default MemberProfile;

export const PaymentFormPage: React.FC<{ viewState: ViewState; setView: (view: ViewState) => void; }> = ({ viewState, setView }) => {
    const { id: memberId, month, returnView } = viewState;
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
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        const loadData = async () => {
            if (memberId) {
                setLoading(true);
                const [memberData, accountsData] = await Promise.all([
                    getMemberById(memberId),
                    accountsApi.getAll()
                ]);
                
                if (memberData) setMember(memberData);
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

        if (!formState.accountId) {
            toast.error("Nenhuma conta de destino selecionada. Por favor, crie uma conta em Ajustes.");
            return;
        }

        setIsSubmitting(true);
        try {
            await addIncomeTransactionAndPayment(
              { 
                description: `Mensalidade ${member.name} - ${new Date(month + '-02').toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}`,
                amount: member.monthlyFee,
                date: new Date(formState.paymentDate + 'T12:00:00Z').toISOString(),
                accountId: formState.accountId,
                comments: formState.comments,
              }, 
              {
                memberId: member.id,
                referenceMonth: month,
                attachmentUrl: formState.attachmentUrl,
                attachmentFilename: formState.attachmentFilename,
              }
            );
            toast.success("Pagamento registrado com sucesso!");
            setView(returnView);
        } catch (error: any) {
            console.error("Erro ao registrar pagamento:", error);
            toast.error(error.message || "Falha ao registrar pagamento.");
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
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4"
            >
                 <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <p className="text-sm font-medium text-primary">Valor para {monthName}:</p>
                    <p className="text-3xl font-bold text-primary">{formatCurrency(member.monthlyFee)}</p>
                </div>
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
                        <select id="accountId" value={formState.accountId} onChange={e => setFormState(s => ({...s, accountId: e.target.value}))} required className={`${inputClass} !py-3`}>
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
            </motion.div>
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