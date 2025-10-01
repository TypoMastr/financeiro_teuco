import React, { useState, useCallback } from 'react';
import { getOverdueReport, getRevenueReport, getDREData } from '../services/api';
import { motion, Variants } from 'framer-motion';
import { ViewState } from '../types';
import { AlertTriangle, TrendingUp, FileSearch, BarChartHorizontal } from './Icons';
import { DateField } from './common/FormControls';
import { useApp } from '../contexts/AppContext';

const cardContainerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.07 } },
  exit: { opacity: 0, y: 20 },
};

const cardItemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 },
}

const ReportCard: React.FC<{
  title: string,
  description: string,
  icon: React.ReactNode,
  children?: React.ReactNode,
  actionButton: React.ReactNode,
}> = ({ title, description, icon, children, actionButton }) => (
  <motion.div 
    className="bg-card dark:bg-dark-card p-5 md:p-6 rounded-lg border border-border dark:border-dark-border"
    variants={cardContainerVariants}
    whileHover={{ y: -5, boxShadow: '0 4px 15px -2px rgba(0,0,0,0.05)' }}
    transition={{ type: 'spring', stiffness: 200 }}
  >
    <div className="flex flex-col sm:flex-row items-start gap-5">
      <motion.div variants={cardItemVariants} className="hidden sm:block">
        {icon}
      </motion.div>
      <div className="flex-1">
        <motion.h3 variants={cardItemVariants} className="text-lg font-bold text-foreground dark:text-dark-foreground">{title}</motion.h3>
        <motion.p variants={cardItemVariants} className="text-muted-foreground dark:text-dark-muted-foreground text-sm mt-1 mb-5">{description}</motion.p>
        {children && <motion.div variants={cardItemVariants} className="flex flex-col sm:flex-row gap-4 mb-5">{children}</motion.div>}
        <motion.div variants={cardItemVariants}>{actionButton}</motion.div>
      </div>
    </div>
  </motion.div>
);


export const Reports: React.FC = () => {
  const { setView } = useApp();
  const [loading, setLoading] = useState<'none' | 'overdue' | 'revenue' | 'dre'>('none');
  
  const [revenueDateRange, setRevenueDateRange] = useState({
      start: new Date(new Date().setDate(1)).toISOString().slice(0,10),
      end: new Date().toISOString().slice(0,10)
  });

  const [dreDateRange, setDreDateRange] = useState({
      start: new Date(new Date().setDate(1)).toISOString().slice(0,10),
      end: new Date().toISOString().slice(0,10)
  });

  const handleGenerateOverdue = useCallback(async () => {
      setLoading('overdue');
      const data = await getOverdueReport();
      setView({
          name: 'report-view',
          report: {
              type: 'overdue',
              data,
              generatedAt: new Date().toISOString(),
          }
      });
      setLoading('none');
  }, [setView]);
  
  const handleGenerateRevenue = useCallback(async () => {
      setLoading('revenue');
      const data = await getRevenueReport(revenueDateRange.start, revenueDateRange.end);
       setView({
          name: 'report-view',
          report: {
              type: 'revenue',
              data,
              generatedAt: new Date().toISOString(),
          }
      });
      setLoading('none');
  }, [revenueDateRange, setView]);

  const handleGenerateDRE = useCallback(async () => {
      setLoading('dre');
      const data = await getDREData(dreDateRange.start, dreDateRange.end);
      setView({
          name: 'report-view',
          report: {
              type: 'dre',
              data,
              generatedAt: new Date().toISOString(),
          }
      });
      setLoading('none');
  }, [dreDateRange, setView]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    exit: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } }
  };
  
  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
    exit: { y: 20, opacity: 0 }
  };

  return (
    <div className="space-y-6">
      <motion.h2 variants={itemVariants} className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Central de Relatórios</motion.h2>
      <motion.div variants={containerVariants} className="space-y-6">
        <ReportCard
          title="Relatório Geral de Pendências"
          description="Gera uma lista completa de todos os membros ativos com contribuições em aberto."
          icon={<AlertTriangle className="w-8 h-8 text-danger" />}
          actionButton={
            <motion.button 
              onClick={handleGenerateOverdue} 
              disabled={loading === 'overdue'}
              className="w-full sm:w-auto text-sm md:text-base text-center bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-md hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
              whileTap={{ scale: 0.95 }}
              whileHover={{ y: -2 }}
            >
              {loading === 'overdue' ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <><FileSearch className="h-4 w-4" /> Visualizar Relatório</>}
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
                disabled={loading === 'revenue'}
                className="w-full sm:w-auto text-sm md:text-base text-center bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-md hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
                whileTap={{ scale: 0.95 }}
                whileHover={{ y: -2 }}
            >
              {loading === 'revenue' ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <><FileSearch className="h-4 w-4" /> Gerar Relatório</>}
            </motion.button>
          }
        >
          <>
            <div className="flex-1 w-full">
                <DateField
                  id="start-date"
                  label="Data de Início"
                  value={revenueDateRange.start}
                  onChange={date => setRevenueDateRange(d => ({...d, start: date}))}
                  smallLabel
                />
            </div>
            <div className="flex-1 w-full">
                <DateField
                  id="end-date"
                  label="Data de Fim"
                  value={revenueDateRange.end}
                  onChange={date => setRevenueDateRange(d => ({...d, end: date}))}
                  smallLabel
                />
            </div>
          </>
        </ReportCard>

        <ReportCard
            title="Demonstrativo de Resultados (DRE)"
            description="Analise a performance financeira em um período, mostrando receitas, despesas e o lucro ou prejuízo final."
            icon={<BarChartHorizontal className="w-8 h-8 text-blue-500" />}
            actionButton={
            <motion.button 
                onClick={handleGenerateDRE} 
                disabled={loading === 'dre'}
                className="w-full sm:w-auto text-sm md:text-base text-center bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-md hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
                whileTap={{ scale: 0.95 }}
                whileHover={{ y: -2 }}
            >
                {loading === 'dre' ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <><FileSearch className="h-4 w-4" /> Gerar DRE</>}
            </motion.button>
            }
        >
            <>
            <div className="flex-1 w-full">
                <DateField
                  id="dre-start-date"
                  label="Data de Início"
                  value={dreDateRange.start}
                  onChange={date => setDreDateRange(d => ({...d, start: date}))}
                  smallLabel
                />
            </div>
            <div className="flex-1 w-full">
                <DateField
                  id="dre-end-date"
                  label="Data de Fim"
                  value={dreDateRange.end}
                  onChange={date => setDreDateRange(d => ({...d, end: date}))}
                  smallLabel
                />
            </div>
            </>
        </ReportCard>
      </motion.div>
    </div>
  );
};