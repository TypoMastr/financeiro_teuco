import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
// FIX: Import types from the corrected types.ts file.
import { Member, PaymentStatus, ActivityStatus, SortOption, ViewState } from '../types';
// FIX: Changed import from mockApi.ts to api.ts
import { getMembers } from '../services/api';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Phone, DollarSign, ChevronRight, Search, UserPlus, Users } from './Icons';

const statusStyles: { [key in PaymentStatus]: { bg: string, text: string, ring: string, name: string } } = {
  [PaymentStatus.EmDia]: { bg: 'bg-green-100 dark:bg-green-500/10', text: 'text-green-700 dark:text-green-300', ring: 'ring-green-500/20', name: 'Em Dia' },
  [PaymentStatus.Atrasado]: { bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-300', ring: 'ring-red-500/20', name: 'Atrasado' },
  [PaymentStatus.Adiantado]: { bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-500/20', name: 'Adiantado' },
  [PaymentStatus.Desligado]: { bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', ring: 'ring-gray-500/20', name: 'Desligado' },
  [PaymentStatus.Isento]: { bg: 'bg-cyan-100 dark:bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-300', ring: 'ring-cyan-500/20', name: 'Isento' },
  [PaymentStatus.Arquivado]: { bg: 'bg-gray-300 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', ring: 'ring-gray-500/20', name: 'Arquivado' },
  [PaymentStatus.EmLicenca]: { bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-500/20', name: 'Em Licença' },
};

const formatPhone = (phone: string) => {
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
};

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const memberRowVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 150, damping: 20 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

const overdueListVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const overdueItemVariants: Variants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
}

const MemberRow: React.FC<{ member: Member; onSelect: (id: string) => void; expandedMemberId: string | null; setExpandedMemberId: (id: string | null) => void; setView: (view: ViewState) => void; }> = ({ member, onSelect, expandedMemberId, setExpandedMemberId, setView }) => {
    const status = statusStyles[member.paymentStatus];
    const isExpanded = expandedMemberId === member.id;

    const handleToggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (member.overdueMonthsCount > 0) {
            setExpandedMemberId(isExpanded ? null : member.id);
        }
    };

    const handlePayClick = (e: React.MouseEvent, month: string) => {
        e.stopPropagation();
        setView({ name: 'payment-form', id: member.id, month: month, returnView: { name: 'members' } });
    };

    return (
        <motion.div
            variants={memberRowVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            onClick={() => onSelect(member.id)}
            className="rounded-xl border border-border dark:border-dark-border mb-3 cursor-pointer group overflow-hidden bg-card dark:bg-dark-card"
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
            <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 text-primary dark:bg-dark-primary/20 dark:text-dark-primary rounded-full flex items-center justify-center font-bold text-base sm:text-lg flex-shrink-0">
                            {member.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-base sm:text-lg text-foreground dark:text-dark-foreground truncate">{member.name}</p>
                            <div className="hidden sm:flex items-center gap-x-4 gap-y-1 flex-wrap text-xs sm:text-sm text-muted-foreground dark:text-dark-muted-foreground mt-1">
                                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{formatPhone(member.phone)}</span>
                                <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />{formatCurrency(member.monthlyFee)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                        <motion.button
                            onClick={handleToggleExpand}
                            className={`flex items-center justify-center rounded-full transition-all duration-300 py-1.5 px-3 text-xs sm:text-sm font-semibold ${status.bg} ${status.text} ${member.overdueMonthsCount > 0 ? 'cursor-pointer hover:ring-2 ' + status.ring : ''}`}
                            whileTap={{ scale: member.overdueMonthsCount > 0 ? 0.95 : 1 }}
                        >
                            <span>{status.name}</span>
                            {member.overdueMonthsCount > 0 && (
                                <span className="ml-2 bg-danger text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                    {member.overdueMonthsCount}
                                </span>
                            )}
                        </motion.button>
                        <ChevronRight className="h-5 w-5 text-muted-foreground dark:text-dark-muted-foreground group-hover:text-foreground dark:group-hover:text-dark-foreground transition-colors hidden sm:block" />
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="bg-danger-strong dark:bg-dark-danger-strong"
                    >
                        <div className="p-4 border-t border-red-500/10 dark:border-red-500/20">
                            <h4 className="font-semibold text-red-700 dark:text-red-300 text-sm mb-3">
                                Meses pendentes
                            </h4>
                             <motion.ul variants={overdueListVariants} initial="hidden" animate="visible" className="space-y-2 max-h-48 overflow-y-auto pr-2 text-sm custom-scrollbar">
                                {member.overdueMonths.map(item => {
                                    const date = new Date(item.month + '-02');
                                    const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
                                    const year = date.getFullYear();
                                    const formattedDate = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year}`;
                                    
                                    return (
                                        <motion.li variants={overdueItemVariants} key={item.month} className="flex justify-between items-center bg-white dark:bg-dark-card p-2 rounded-lg">
                                            <div>
                                                <span className="font-semibold text-foreground dark:text-dark-foreground">{formattedDate}</span>
                                                <span className="block text-xs text-muted-foreground">{formatCurrency(item.amount)}</span>
                                            </div>
                                            <motion.button
                                                onClick={(e) => handlePayClick(e, item.month)}
                                                className="bg-primary text-primary-foreground font-bold text-xs py-1.5 px-3 rounded-full hover:bg-primary/90 transition-all"
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                Pagar
                                            </motion.button>
                                        </motion.li>
                                    );
                                })}
                            </motion.ul>
                            <div className="border-t border-red-500/10 dark:border-red-500/20 mt-3 pt-3 font-bold flex justify-between items-baseline">
                                <span className="text-base text-red-700 dark:text-red-300">VALOR PENDENTE</span>
                                 <span className="bg-danger text-destructive-foreground text-lg font-bold px-4 py-1.5 rounded-full">
                                    {formatCurrency(member.totalDue)}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const FilterChip: React.FC<{ label: string, value: string, selected: boolean, onClick: () => void }> = ({ label, value, selected, onClick }) => (
    <motion.button
        onClick={onClick}
        className={`px-3 py-1.5 sm:px-4 rounded-full text-sm font-semibold transition-all duration-200 border
        ${selected
            ? 'bg-primary/10 text-primary border-primary/20'
            : 'bg-secondary dark:bg-dark-secondary hover:bg-muted dark:hover:bg-dark-muted border-border dark:border-dark-border'
        }`}
        whileTap={{ scale: 0.95 }}
    >
        {label}
    </motion.button>
);


export const Members: React.FC<{setView: (view: ViewState) => void}> = ({ setView }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<{ status: string, activity: string, sort: SortOption }>({ status: 'all', activity: 'Ativo', sort: 'name_asc' });
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  
  const isInitialLoad = useRef(true);

  const fetchData = useCallback(async (isUpdate = false) => {
    if (!isUpdate) {
        setLoading(true);
    }
    try {
        const data = await getMembers();
        setMembers(data);
    } catch (error) {
        console.error("Failed to fetch members", error);
    } finally {
        if (!isUpdate || isInitialLoad.current) {
            setLoading(false);
            isInitialLoad.current = false;
        }
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000); // Auto-refresh in background
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredAndSortedMembers = useMemo(() => {
    return members
      .filter(member => {
        // Filter by search term
        const searchMatch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!searchMatch) return false;

        // Filter by activity status
        let activityMatch = false;
        if (filters.activity === 'OnLeave') {
            activityMatch = member.onLeave === true;
        } else if (filters.activity === 'all') {
            activityMatch = member.activityStatus !== 'Arquivado';
        } else {
            activityMatch = member.activityStatus === filters.activity;
        }
        if (!activityMatch) return false;

        // Filter by payment status
        if (filters.status !== 'all') {
          return member.paymentStatus === filters.status;
        }
        
        return true;
      })
      .sort((a, b) => {
        if (filters.sort === 'name_asc') return a.name.localeCompare(b.name);
        return b.name.localeCompare(a.name);
      });
  }, [members, filters, searchTerm]);
  
  const handleActivityFilterChange = (activityValue: string) => {
    // When changing the main activity filter, reset the payment status filter
    // to avoid conflicts (e.g., filtering for "Desligado" members with "Atrasado" payment status, which is impossible).
    setFilters(f => ({ ...f, activity: activityValue, status: 'all' }));
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  };
  
  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { ease: "easeOut", duration: 0.4 } },
  };
  
  const selectClass = "w-full text-sm p-2.5 rounded-lg bg-card dark:bg-dark-card border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";


  return (
    <div className="space-y-6">
        <motion.div variants={itemVariants}>
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground dark:text-dark-foreground text-center sm:text-left hidden sm:block">Mensalidades</h2>
        </motion.div>
      
        <motion.div variants={containerVariants} className="flex flex-col items-center gap-4">
            <motion.div variants={itemVariants} className="w-full max-w-3xl flex flex-col sm:flex-row gap-3 sm:gap-4 items-end">
                <div className="flex-grow w-full space-y-3">
                    <div className="relative flex-grow">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                         <input 
                            type="text"
                            placeholder="Buscar por nome..."
                            className="w-full text-base p-3 pl-12 rounded-lg bg-card dark:bg-dark-card border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                     <div className="hidden sm:grid sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-muted-foreground ml-1 mb-1 block">Status do Membro</label>
                            <select
                                value={filters.activity}
                                onChange={(e) => handleActivityFilterChange(e.target.value)}
                                className={selectClass}
                            >
                                <option value="Ativo">Membros Ativos</option>
                                <option value="OnLeave">Em Licença</option>
                                <option value="Inativo">Membros Inativos</option>
                                <option value="Desligado">Membros Desligados</option>
                                <option value="Arquivado">Membros Arquivados</option>
                                <option value="all">Todos (exceto arquivados)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground ml-1 mb-1 block">Pagamento</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters(f => ({...f, status: e.target.value}))}
                                className={selectClass}
                            >
                                <option value="all">Todos</option>
                                <option value={PaymentStatus.Atrasado}>Pendentes</option>
                                <option value={PaymentStatus.EmDia}>Em Dia</option>
                            </select>
                        </div>
                    </div>
                </div>
                <motion.button 
                    whileHover={{ scale: 1.05, y: -2, boxShadow: '0 4px 20px -5px hsl(142.1 76.2% 36% / 0.5)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setView({ name: 'add-member' })}
                    className="flex-shrink-0 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 px-5 text-sm md:text-base rounded-lg shadow-sm hover:bg-primary/90 transition-all w-full sm:w-auto"
                >
                    <UserPlus className="h-5 w-5" />
                    <span>Novo Membro</span>
                </motion.button>
            </motion.div>
            
            <motion.div 
                variants={itemVariants}
                className="sm:hidden w-full grid grid-cols-2 gap-3"
            >
                 <select
                    value={filters.activity}
                    onChange={(e) => handleActivityFilterChange(e.target.value)}
                    className="w-full text-sm p-2.5 rounded-lg bg-card dark:bg-dark-card border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all appearance-none"
                 >
                    <option value="Ativo">Membros Ativos</option>
                    <option value="OnLeave">Em Licença</option>
                    <option value="Inativo">Membros Inativos</option>
                    <option value="Desligado">Membros Desligados</option>
                    <option value="Arquivado">Membros Arquivados</option>
                    <option value="all">Todos (exceto arquivados)</option>
                 </select>
                 <select
                    value={filters.status}
                    onChange={(e) => setFilters(f => ({...f, status: e.target.value}))}
                    className="w-full text-sm p-2.5 rounded-lg bg-card dark:bg-dark-card border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all appearance-none"
                 >
                    <option value="all">Todos Pagamentos</option>
                    <option value={PaymentStatus.Atrasado}>Pag. Pendentes</option>
                    <option value={PaymentStatus.EmDia}>Pag. em Dia</option>
                 </select>
            </motion.div>
        </motion.div>
        
        <motion.div layout className="relative min-h-[400px]">
            {loading ? (
                <div className="absolute inset-0 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : (
                <motion.div layout>
                    <AnimatePresence>
                        {filteredAndSortedMembers.length > 0 ? (
                            filteredAndSortedMembers.map(member => (
                                <MemberRow 
                                    key={member.id}
                                    member={member} 
                                    onSelect={(id) => setView({ name: 'member-profile', id })}
                                    expandedMemberId={expandedMemberId}
                                    setExpandedMemberId={setExpandedMemberId}
                                    setView={setView}
                                />
                            ))
                        ) : (
                            <motion.div
                                key="no-members-found"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-center py-20 text-muted-foreground"
                            >
                                <div className="inline-block p-4 bg-muted dark:bg-dark-muted rounded-full mb-4">
                                    <Users className="h-10 w-10 text-primary" />
                                </div>
                                <p className="font-semibold text-lg">Nenhum membro encontrado.</p>
                                <p className="text-base">Tente ajustar seus filtros ou busca.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </motion.div>
    </div>
  );
};