import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { getDashboardStats, getHistoricalMonthlySummary } from '../services/api';
import { Stats, ViewState } from '../types';
import { TrendingUp, TrendingDown, Wallet, Scale, ChevronDown, Users, PieChart, DollarSign } from './Icons';


// --- Animation Variants ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });


// --- Sub-components ---
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass?: string; onClick?: () => void; description?: string; }> = ({ title, value, icon, colorClass = 'text-muted-foreground dark:text-dark-muted-foreground', onClick, description }) => (
  <motion.div
    variants={itemVariants}
    onClick={onClick}
    className={`bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border ${onClick ? 'cursor-pointer' : ''}`}
    whileHover={onClick ? { y: -4, boxShadow: '0 4px 15px -2px rgba(0,0,0,0.05)' } : {}}
    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
  >
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{title}</h3>
      <div className={colorClass}>{icon}</div>
    </div>
    <p className={`text-xl sm:text-2xl font-bold font-display text-foreground dark:text-dark-foreground mt-1 ${colorClass}`}>{value}</p>
    {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
  </motion.div>
);

export const Overview: React.FC<{ setView: (view: ViewState) => void }> = ({ setView }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [historicalData, setHistoricalData] = useState<{ month: string, income: number, expense: number }[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(true);
  const [openHistoryMonth, setOpenHistoryMonth] = useState<string | null>(null);

  const [colaboradoresStats, setColaboradoresStats] = useState<{
    totalPendenteGeral: number;
    totalArrecadadoMes: number;
    projecaoProximoMes: number;
    mesAtual: string;
    proximoMes: string;
  } | null>(null);
  const [loadingColaboradores, setLoadingColaboradores] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoadingStats(true);
        setLoadingHistorical(true);
        setLoadingColaboradores(true);
        
        const [statsData, historicalSummary, colaboradoresResponse] = await Promise.all([
            getDashboardStats(),
            getHistoricalMonthlySummary(),
            fetch('https://teuco.com.br/colaboradores/partials/resumo.php').catch(e => {
                console.error("Fetch colaboradores failed:", e);
                return null;
            })
        ]);
        setStats(statsData);
        setHistoricalData(historicalSummary);

        if (colaboradoresResponse && colaboradoresResponse.ok) {
            const data = await colaboradoresResponse.json();
            const parseCurrency = (value: string | number) => {
              if (typeof value === 'number') {
                  return value;
              }
              if (typeof value === 'string') {
                  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
              }
              return 0;
            };
            setColaboradoresStats({
                totalPendenteGeral: parseCurrency(data.total_pendente_geral),
                totalArrecadadoMes: parseCurrency(data.total_arrecadado_mes),
                projecaoProximoMes: parseCurrency(data.projecao_proximo_mes),
                mesAtual: data.mes_atual,
                proximoMes: data.proximo_mes,
            });
        } else {
             console.error("Erro ao buscar dados dos colaboradores", colaboradoresResponse?.statusText);
        }

      } catch (error) {
        console.error("Erro ao buscar dados da visão geral", error);
      } finally {
        setLoadingStats(false);
        setLoadingHistorical(false);
        setLoadingColaboradores(false);
      }
    };
    fetchAllData();
  }, []);
  
  const monthlyBalance = (stats?.monthlyRevenue || 0) - (stats?.monthlyExpenses || 0);

  const totalProjectedIncome = (stats?.currentMonthPendingAmount || 0) + 
                               (colaboradoresStats?.totalPendenteGeral || 0) + 
                               (stats?.projectedIncome || 0);

  const previousMonthName = useMemo(() => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    const name = now.toLocaleDateString('pt-BR', { month: 'long' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);
  
  const groupedAndFilteredHistory = useMemo(() => {
    const data = historicalData
        .filter(item => item.month >= '2025-09')
        .map(item => ({
            ...item,
            year: item.month.substring(0, 4),
            monthName: new Date(item.month + '-02').toLocaleDateString('pt-BR', { month: 'long' }),
        }))
        .reduce((acc, item) => {
            const { year } = item;
            if (!acc[year]) {
                acc[year] = [];
            }
            acc[year].push(item);
            return acc;
        }, {} as Record<string, any[]>);

    // Reverse months within each year to show newest first
    Object.keys(data).forEach(year => data[year].reverse());
    return data;
  }, [historicalData]);

  const sortedYears = useMemo(() => Object.keys(groupedAndFilteredHistory).sort((a,b) => parseInt(b) - parseInt(a)), [groupedAndFilteredHistory]);
  
  if (loadingStats) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <motion.div 
        className="space-y-6 md:space-y-8"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
    >
      <motion.h2 variants={itemVariants} className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Visão Geral</h2>

      <motion.div variants={itemVariants} className="space-y-4">
        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Resumo do Mês (Médiuns)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Receitas" value={formatCurrency(stats?.monthlyRevenue || 0)} icon={<TrendingUp className="w-5 h-5" />} colorClass="text-success" />
            <StatCard title="Despesas" value={formatCurrency(stats?.monthlyExpenses || 0)} icon={<TrendingDown className="w-5 h-5" />} colorClass="text-danger" />
            <StatCard title="Saldo" value={formatCurrency(monthlyBalance)} icon={<Scale className="w-5 h-5" />} colorClass={monthlyBalance >= 0 ? 'text-foreground dark:text-dark-foreground' : 'text-danger'} />
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-4">
        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Mensalidades</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title={`Total pendente até ${previousMonthName}`} value={formatCurrency(stats?.totalOverdueAmount || 0)} icon={<DollarSign className="w-5 h-5" />} colorClass="text-danger" onClick={() => setView({ name: 'members'})} />
            <StatCard title="Recebido no Mês" value={formatCurrency(stats?.monthlyRevenue || 0)} icon={<TrendingUp className="w-5 h-5" />} colorClass="text-success" onClick={() => setView({ name: 'financial' })}/>
            <StatCard title="Pendente no Mês" value={formatCurrency(stats?.currentMonthPendingAmount || 0)} icon={<TrendingDown className="w-5 h-5" />} colorClass="text-warning" onClick={() => setView({ name: 'members' })}/>
            <StatCard title="Previsão Próx. Mês" value={formatCurrency(stats?.nextMonthProjectedRevenue || 0)} icon={<TrendingUp className="w-5 h-5" />} colorClass="text-blue-500" />
        </div>
      </motion.div>
      
      <motion.div variants={itemVariants} className="space-y-4">
        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Colaboradores</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {loadingColaboradores ? (
                <>
                    <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border animate-pulse"><div className="h-4 bg-muted dark:bg-dark-muted rounded w-3/4 mb-2"></div><div className="h-8 bg-muted dark:bg-dark-muted rounded w-1/2"></div></div>
                    <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border animate-pulse"><div className="h-4 bg-muted dark:bg-dark-muted rounded w-3/4 mb-2"></div><div className="h-8 bg-muted dark:bg-dark-muted rounded w-1/2"></div></div>
                    <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border animate-pulse"><div className="h-4 bg-muted dark:bg-dark-muted rounded w-3/4 mb-2"></div><div className="h-8 bg-muted dark:bg-dark-muted rounded w-1/2"></div></div>
                </>
            ) : colaboradoresStats ? (
                <>
                    <StatCard title="Total Pendente" value={formatCurrency(colaboradoresStats.totalPendenteGeral)} icon={<DollarSign className="w-5 h-5" />} colorClass="text-danger" />
                    <StatCard title={`Arrecadado em ${colaboradoresStats.mesAtual}`} value={formatCurrency(colaboradoresStats.totalArrecadadoMes)} icon={<TrendingUp className="w-5 h-5" />} colorClass="text-success" />
                    <StatCard title={`Previsão para ${colaboradoresStats.proximoMes}`} value={formatCurrency(colaboradoresStats.projecaoProximoMes)} icon={<TrendingUp className="w-5 h-5" />} colorClass="text-blue-500" />
                </>
            ) : (
                <div className="sm:col-span-3 text-center py-4 bg-card dark:bg-dark-card rounded-lg">
                    <p className="text-muted-foreground">Não foi possível carregar os dados dos colaboradores.</p>
                </div>
            )}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-4">
          <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Saldos e Projeções</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard title="Saldo Geral" value={formatCurrency(stats?.currentBalance || 0)} icon={<Wallet className="w-5 h-5" />} colorClass="text-blue-500" />
              <StatCard 
                title="Receitas Futuras" 
                value={formatCurrency(totalProjectedIncome)} 
                icon={<TrendingUp className="w-5 h-5" />} 
                colorClass="text-green-400"
                description="Mensalidades/Colaboradores/PagBank"
              />
              <StatCard title="Despesas Futuras" value={formatCurrency(stats?.projectedExpenses || 0)} icon={<TrendingDown className="w-5 h-5" />} colorClass="text-orange-400" />
          </div>
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Histórico Mensal</h3>
        <p className="text-muted-foreground text-sm mb-4">Resumo dos resultados de cada mês.</p>
        <div className="space-y-4">
          {loadingHistorical ? (
            <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : sortedYears.length > 0 ? (
            sortedYears.map(year => (
              <motion.div key={year} variants={itemVariants} className="space-y-2">
                <h4 className="text-lg font-bold mt-4 text-muted-foreground">{year}</h4>
                {groupedAndFilteredHistory[year].map(item => {
                  const isExpanded = openHistoryMonth === item.month;
                  const balance = item.income - item.expense;
                  return (
                    <motion.div key={item.month} className="bg-card dark:bg-dark-card rounded-lg border border-border dark:border-dark-border overflow-hidden" layout>
                      <button
                        onClick={() => setOpenHistoryMonth(isExpanded ? null : item.month)}
                        className="w-full flex justify-between items-center p-4 text-left font-semibold capitalize"
                        aria-expanded={isExpanded}
                      >
                        <span>{item.monthName}</span>
                        <div className="flex items-center gap-4">
                          <span className={`font-mono ${balance >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(balance)}</span>
                          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                          >
                            <div className="px-4 pb-4 border-t border-border dark:border-dark-border text-sm space-y-2 pt-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Receitas:</span>
                                <span className="font-semibold text-success">{formatCurrency(item.income)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Despesas:</span>
                                <span className="font-semibold text-danger">{formatCurrency(item.expense)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-border/50 dark:border-dark-border/50">
                                <span className="font-bold text-foreground dark:text-dark-foreground">Saldo:</span>
                                <span className={`font-bold ${balance >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(balance)}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            ))
          ) : (
            <div className="text-center py-10 bg-card dark:bg-dark-card rounded-lg">
                <p className="text-muted-foreground">Nenhum histórico disponível para o período.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};