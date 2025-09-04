import React, { useState, useEffect, useCallback } from 'react';
import { motion, Variants } from 'framer-motion';
import { getDashboardStats, getOverdueReport, getRevenueReport } from '../services/api';
// FIX: Import types from the corrected types.ts file.
import { Stats, ViewState } from '../types';
import { Users, CheckCircle, AlertTriangle, DollarSign, TrendingUp, FileSearch } from './Icons';
import { DateField } from './common/PageLayout';

// --- Animation Variants ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
  exit: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
  exit: { y: 20, opacity: 0 }
};

// --- Sub-components ---
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <motion.div
    variants={itemVariants}
    className="bg-card dark:bg-dark-card p-4 sm:p-5 rounded-lg border border-border dark:border-dark-border"
    whileHover={{ y: -5, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
    transition={{ type: 'spring', stiffness: 300 }}
  >
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{title}</h3>
      {icon}
    </div>
    <p className="text-xl sm:text-2xl font-bold font-display text-foreground dark:text-dark-foreground mt-1">{value}</p>
  </motion.div>
);

const ReportCard: React.FC<{
  title: string,
  description: string,
  icon: React.ReactNode,
  children?: React.ReactNode,
  actionButton: React.ReactNode,
}> = ({ title, description, icon, children, actionButton }) => (
  <motion.div variants={itemVariants} className="bg-card dark:bg-dark-card p-5 md:p-6 rounded-lg border border-border dark:border-dark-border">
    <div className="flex flex-col sm:flex-row items-start gap-5">
      <div className="hidden sm:block">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-foreground dark:text-dark-foreground">{title}</h3>
        <p className="text-muted-foreground dark:text-dark-muted-foreground text-sm mt-1 mb-5">{description}</p>
        {children && <div className="flex flex-col sm:flex-row gap-4 mb-5">{children}</div>}
        <div>{actionButton}</div>
      </div>
    </div>
  </motion.div>
);


export const Overview: React.FC<{ setView: (view: ViewState) => void }> = ({ setView }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingReport, setLoadingReport] = useState<'none' | 'overdue' | 'revenue'>('none');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Erro ao buscar estatísticas", error);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);
  
  const handleGenerateOverdue = useCallback(async () => {
    setLoadingReport('overdue');
    const data = await getOverdueReport();
    setView({
      name: 'report-view',
      report: { type: 'overdue', data, generatedAt: new Date().toISOString() }
    });
    setLoadingReport('none');
  }, [setView]);

  const handleGenerateRevenue = useCallback(async () => {
    setLoadingReport('revenue');
    const data = await getRevenueReport(dateRange.start, dateRange.end);
    setView({
      name: 'report-view',
      report: { type: 'revenue', data, generatedAt: new Date().toISOString() }
    });
    setLoadingReport('none');
  }, [dateRange, setView]);
  
  if (loadingStats) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <motion.h2 variants={itemVariants} className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Visão Geral</motion.h2>

      <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Membros Ativos" value={stats?.totalMembers || 0} icon={<Users className="w-5 h-5 text-muted-foreground" />} />
        <StatCard title="Em Dia" value={stats?.onTime || 0} icon={<CheckCircle className="w-5 h-5 text-success" />} />
        <StatCard title="Atrasados" value={stats?.overdue || 0} icon={<AlertTriangle className="w-5 h-5 text-danger" />} />
        <StatCard title="Receita do Mês" value={`R$ ${stats?.monthlyRevenue.toFixed(2).replace('.', ',') || '0,00'}`} icon={<DollarSign className="w-5 h-5 text-muted-foreground" />} />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-4">
        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Relatórios Rápidos</h3>
        
        <motion.div variants={containerVariants} className="space-y-6">
          <ReportCard
            title="Relatório Geral de Pendências"
            description="Gera uma lista completa de todos os membros ativos com contribuições em aberto."
            icon={<AlertTriangle className="w-8 h-8 text-danger" />}
            actionButton={
              <motion.button 
                onClick={handleGenerateOverdue} 
                disabled={loadingReport === 'overdue'}
                className="w-full sm:w-auto text-sm md:text-base text-center bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-md hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
                whileTap={{ scale: 0.95 }}
                whileHover={{ y: -2 }}
              >
                {loadingReport === 'overdue' ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <><FileSearch className="h-4 w-4" /> Visualizar Relatório</>}
              </motion.button>
            }
          />
          
          <ReportCard
            title="Relatório de Recebimentos por Período"
            description="Selecione um período para visualizar todos os pagamentos recebidos e o total arrecadado."
            icon={<TrendingUp className="w-8 h-8 text-success" />}
            actionButton={
              <motion.button 
                  onClick={handleGenerateRevenue} 
                  disabled={loadingReport === 'revenue'}
                  className="w-full sm:w-auto text-sm md:text-base text-center bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-md hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ y: -2 }}
              >
                {loadingReport === 'revenue' ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <><FileSearch className="h-4 w-4" /> Gerar Relatório</>}
              </motion.button>
            }
          >
            <>
              <div className="flex-1 w-full">
                  <DateField
                      id="start-date"
                      label="Data de Início"
                      value={dateRange.start}
                      onChange={date => setDateRange(d => ({...d, start: date}))}
                  />
              </div>
              <div className="flex-1 w-full">
                   <DateField
                      id="end-date"
                      label="Data de Fim"
                      value={dateRange.end}
                      onChange={date => setDateRange(d => ({...d, end: date}))}
                  />
              </div>
            </>
          </ReportCard>
        </motion.div>

      </motion.div>
    </div>
  );
};