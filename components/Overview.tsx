import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { getDashboardStats, getHistoricalMonthlySummary } from '../services/api';
import { Stats, ViewState } from '../types';
import { Users, TrendingUp, TrendingDown, Wallet } from './Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


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
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass?: string }> = ({ title, value, icon, colorClass = 'text-muted-foreground dark:text-dark-muted-foreground' }) => (
  <motion.div
    variants={itemVariants}
    className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border"
    whileHover={{ y: -4, boxShadow: '0 4px 15px -2px rgba(0,0,0,0.05)' }}
    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
  >
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{title}</h3>
      <div className={colorClass}>{icon}</div>
    </div>
    <p className={`text-xl sm:text-2xl font-bold font-display text-foreground dark:text-dark-foreground mt-1 ${colorClass}`}>{value}</p>
  </motion.div>
);

export const Overview: React.FC<{ setView: (view: ViewState) => void }> = ({ setView }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoadingStats(true);
        setLoadingHistorical(true);
        const [statsData, historicalSummary] = await Promise.all([
            getDashboardStats(),
            getHistoricalMonthlySummary()
        ]);
        setStats(statsData);
        const formattedData = historicalSummary.map(item => ({
            name: new Date(item.month + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            Receitas: item.income,
            Despesas: item.expense,
        }));
        setHistoricalData(formattedData);
      } catch (error) {
        console.error("Erro ao buscar dados da visão geral", error);
      } finally {
        setLoadingStats(false);
        setLoadingHistorical(false);
      }
    };
    fetchAllData();
  }, []);
  
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
      <motion.h2 variants={itemVariants} className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Visão Geral</motion.h2>

      <motion.div variants={containerVariants} className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
        <StatCard title="Saldo Atual" value={formatCurrency(stats?.currentBalance || 0)} icon={<Wallet className="w-5 h-5" />} colorClass="text-blue-500" />
        <StatCard title="Receita do Mês" value={formatCurrency(stats?.monthlyRevenue || 0)} icon={<TrendingUp className="w-5 h-5" />} colorClass="text-success" />
        <StatCard title="Gastos do Mês" value={formatCurrency(stats?.monthlyExpenses || 0)} icon={<TrendingDown className="w-5 h-5" />} colorClass="text-danger" />
        <StatCard title="Projeção Receitas" value={formatCurrency(stats?.projectedIncome || 0)} icon={<TrendingUp className="w-5 h-5" />} colorClass="text-green-400" />
        <StatCard title="Projeção Despesas" value={formatCurrency(stats?.projectedExpenses || 0)} icon={<TrendingDown className="w-5 h-5" />} colorClass="text-orange-400" />
        <StatCard title="Membros Ativos" value={stats?.totalMembers || 0} icon={<Users className="w-5 h-5" />} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Balanço Mensal</h3>
        <p className="text-muted-foreground text-sm mb-4">Receitas e despesas nos últimos 12 meses.</p>
        <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border h-80 sm:h-96">
            {loadingHistorical ? (
                <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historicalData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.1)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                        <YAxis tickFormatter={(value) => `R$${(value as number)/1000}k`} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                        <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                borderColor: 'hsl(var(--border))',
                                color: 'hsl(var(--card-foreground))',
                                borderRadius: '0.5rem'
                            }}
                            cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '14px' }} />
                        <Bar dataKey="Receitas" fill="#3CB371" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Despesas" fill="#D9534F" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
      </motion.div>
    </motion.div>
  );
};
