

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { ReportData, ViewState, Member, Transaction, Category, Payee, Account } from '../types';
import { ArrowLeft, Printer, ClubLogo } from './Icons';

interface PrintableReportProps {
  report: ReportData;
  setView: (view: ViewState) => void;
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 }
};

const ReportHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <motion.div variants={itemVariants} className="border-b-2 border-foreground dark:border-dark-foreground pb-4 mb-8 text-center">
    <div className="flex items-center justify-center gap-3 text-foreground dark:text-dark-foreground">
        <ClubLogo className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold font-display">Financeiro</h1>
    </div>
    <h2 className="text-2xl font-semibold text-foreground dark:text-dark-foreground mt-4">{title}</h2>
    <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground mt-1">{subtitle}</p>
  </motion.div>
);

const OverdueReport: React.FC<{ data: Member[] }> = ({ data }) => {
  const grandTotal = data.reduce((acc, member) => acc + member.totalDue, 0);

  return (
    <motion.div className="space-y-6" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
      {data.map(member => (
        <motion.div variants={itemVariants} key={member.id} className="p-4 border border-border dark:border-dark-border rounded-lg break-inside-avoid">
          <h3 className="font-bold text-lg text-foreground dark:text-dark-foreground">{member.name}</h3>
          <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground mb-3">{member.phone}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border dark:border-dark-border">
                <th className="text-left font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Mês Pendente</th>
                <th className="text-right font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {member.overdueMonths.map(item => (
                <tr key={item.month} className="border-b border-border/50 dark:border-dark-border/50">
                  <td className="py-1.5 px-2 capitalize text-muted-foreground dark:text-dark-muted-foreground">{new Date(item.month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
                  <td className="text-right px-2 text-foreground dark:text-dark-foreground">{item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold text-foreground dark:text-dark-foreground">
                <td className="text-right py-2 px-2">Subtotal:</td>
                <td className="text-right px-2">R$ {member.totalDue.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </motion.div>
      ))}
      <motion.div variants={itemVariants} className="mt-8 pt-4 border-t-2 border-foreground dark:border-dark-foreground flex justify-end">
        <div className="text-right">
          <p className="text-lg text-muted-foreground dark:text-dark-muted-foreground">Total Geral de Pendências:</p>
          <p className="text-3xl font-bold text-danger">R$ {grandTotal.toFixed(2).replace('.', ',')}</p>
        </div>
      </motion.div>
    </motion.div>
  );
};


const RevenueReport: React.FC<{ data: { totalRevenue: number, payments: (any & { memberName: string })[]} }> = ({ data }) => {
    return (
        <motion.div variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
            <table className="w-full text-sm text-left">
                <thead>
                    <tr className="border-b-2 border-border dark:border-dark-border">
                        <th className="font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Data</th>
                        <th className="font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Membro</th>
                        <th className="font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Mês Ref.</th>
                        <th className="text-right font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Valor (R$)</th>
                    </tr>
                </thead>
                <motion.tbody variants={{ visible: { transition: { staggerChildren: 0.03 } } }}>
                    {data.payments.map(p => (
                        <motion.tr variants={itemVariants} key={p.id} className="border-b border-border/50 dark:border-dark-border/50">
                            <td className="py-2 px-2 text-muted-foreground dark:text-dark-muted-foreground">{new Date(p.paymentDate).toLocaleDateString('pt-BR')}</td>
                            <td className="py-2 px-2 text-foreground dark:text-dark-foreground">{p.memberName}</td>
                            <td className="py-2 px-2 capitalize text-muted-foreground dark:text-dark-muted-foreground">{new Date(p.referenceMonth + '-02').toLocaleDateString('pt-BR', {month: 'long', year: '2-digit'})}</td>
                            <td className="text-right px-2 text-foreground dark:text-dark-foreground">{p.amount.toFixed(2)}</td>
                        </motion.tr>
                    ))}
                </motion.tbody>
            </table>
            <motion.div variants={itemVariants} className="mt-8 pt-4 border-t-2 border-foreground dark:border-dark-foreground flex justify-end">
                <div className="text-right">
                <p className="text-lg text-muted-foreground dark:text-dark-muted-foreground">Receita Total no Período:</p>
                <p className="text-3xl font-bold text-success">R$ {data.totalRevenue.toFixed(2).replace('.', ',')}</p>
                </div>
            </motion.div>
        </motion.div>
    );
};

const FinancialReport: React.FC<{ data: { transactions: Transaction[], allData: { categories: Category[], payees: Payee[], accounts: Account[] }} }> = ({ data }) => {
    const { transactions, allData } = data;
    const { categories, payees } = allData;

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const payeeMap = new Map(payees.map(p => [p.id, p.name]));

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netTotal = totalIncome - totalExpense;

    return (
        <motion.div variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
            <table className="w-full text-sm text-left">
                <thead>
                    <tr className="border-b-2 border-border dark:border-dark-border">
                        <th className="font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Data</th>
                        <th className="font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Descrição</th>
                        <th className="font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Categoria</th>
                        <th className="text-right font-semibold py-2 px-2 text-foreground dark:text-dark-foreground">Valor</th>
                    </tr>
                </thead>
                <motion.tbody variants={{ visible: { transition: { staggerChildren: 0.03 } } }}>
                    {transactions.map(t => (
                        <motion.tr variants={itemVariants} key={t.id} className="border-b border-border/50 dark:border-dark-border/50">
                            <td className="py-2 px-2 text-muted-foreground dark:text-dark-muted-foreground">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                            <td className="py-2 px-2 text-foreground dark:text-dark-foreground">{t.description}</td>
                            <td className="py-2 px-2 capitalize text-muted-foreground dark:text-dark-muted-foreground">{categoryMap.get(t.categoryId) || 'N/A'}</td>
                            <td className={`text-right px-2 font-semibold ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                                {t.type === 'income' ? '+' : '-'} {t.amount.toFixed(2)}
                            </td>
                        </motion.tr>
                    ))}
                </motion.tbody>
            </table>
            <motion.div variants={itemVariants} className="mt-8 pt-4 border-t-2 border-foreground dark:border-dark-foreground flex flex-col sm:flex-row justify-between items-end gap-4">
                <div className="text-left">
                    <p>Total Receitas: <span className="font-bold text-success">{totalIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                    <p>Total Despesas: <span className="font-bold text-danger">{totalExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                </div>
                <div className="text-right">
                    <p className="text-lg text-muted-foreground dark:text-dark-muted-foreground">Resultado do Período:</p>
                    <p className={`text-3xl font-bold ${netTotal >= 0 ? 'text-success' : 'text-danger'}`}>{netTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            </motion.div>
        </motion.div>
    );
};

const DREReport: React.FC<{ data: any }> = ({ data }) => {
    const { grossRevenue, otherIncome, operatingExpenses, netResult } = data;
    const totalRevenue = grossRevenue.total + otherIncome.total;

    const DRELine: React.FC<{ label: string, value: number, isSubtotal?: boolean, isTotal?: boolean, level?: number }> = ({ label, value, isSubtotal, isTotal, level = 0 }) => {
        const isNegative = value < 0;
        const valueColor = isTotal ? (isNegative ? 'text-danger' : 'text-success') : 'text-foreground dark:text-dark-foreground';
        const fontWeight = isSubtotal || isTotal ? 'font-bold' : 'font-normal';
        const paddingLeft = `${level * 1.5}rem`;

        return (
            <div className={`flex justify-between items-center py-2 border-b border-border/50 dark:border-dark-border/50 ${isTotal ? 'border-t-2 border-foreground dark:border-dark-foreground mt-4 pt-4' : ''}`}>
                <span className={`${fontWeight}`} style={{ paddingLeft }}>{label}</span>
                <span className={`${fontWeight} ${valueColor} font-mono`}>
                    {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
            </div>
        );
    };

    return (
        <motion.div className="space-y-2" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
            <motion.div variants={itemVariants}>
                <DRELine label="(=) Receita Operacional Bruta" value={grossRevenue.total} isSubtotal />
                {grossRevenue.details.map((item: any) => (
                    <DRELine key={item.categoryName} label={item.categoryName} value={item.total} level={1} />
                ))}
            </motion.div>

            {otherIncome.total > 0 && (
                <motion.div variants={itemVariants}>
                    <DRELine label="(+) Outras Receitas Operacionais" value={otherIncome.total} isSubtotal />
                    {otherIncome.details.map((item: any) => (
                        <DRELine key={item.categoryName} label={item.categoryName} value={item.total} level={1} />
                    ))}
                </motion.div>
            )}

            <motion.div variants={itemVariants}>
                <DRELine label="(=) Receita Total" value={totalRevenue} isSubtotal />
            </motion.div>

            <motion.div variants={itemVariants}>
                <DRELine label="(-) Despesas Operacionais" value={-operatingExpenses.total} isSubtotal />
                {operatingExpenses.details.map((item: any) => (
                    <DRELine key={item.categoryName} label={item.categoryName} value={-item.total} level={1} />
                ))}
            </motion.div>
            
            <motion.div variants={itemVariants}>
                 <DRELine label="(=) Resultado Líquido do Período" value={netResult} isTotal />
            </motion.div>
        </motion.div>
    );
};


const PrintableReport: React.FC<PrintableReportProps> = ({ report, setView }) => {
  const { type, data, generatedAt } = report;

  const handlePrint = () => { window.print(); };

  const reportTitle = report.title || {
      overdue: 'Relatório de Pendências',
      revenue: 'Relatório de Recebimentos',
      financial: 'Relatório Financeiro',
      dre: 'Demonstrativo de Resultados (DRE)'
  }[type];
  const reportDate = new Date(generatedAt).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    exit: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } }
  };

  return (
    <div className="space-y-6">
      <motion.div variants={itemVariants} className="w-full flex flex-col sm:flex-row justify-center sm:justify-between gap-4 no-print">
        <motion.button
          onClick={() => setView({ name: 'reports' })}
          className="text-sm md:text-base font-semibold transition-all duration-200 bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground py-2.5 px-5 rounded-full border border-border dark:border-dark-border shadow-btn hover:-translate-y-0.5 hover:shadow-lg dark:shadow-dark-btn w-full sm:w-auto justify-center flex items-center gap-2"
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Relatórios
        </motion.button>
        <motion.button
          onClick={handlePrint}
          className="bg-primary text-primary-foreground text-sm md:text-base font-bold py-2.5 px-5 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm w-full sm:w-auto justify-center"
          whileTap={{ scale: 0.95 }}
        >
          <Printer className="h-4 w-4" />
          Imprimir ou Salvar PDF
        </motion.button>
      </motion.div>

      <motion.div 
        variants={containerVariants} 
        className="bg-card dark:bg-dark-card p-6 sm:p-8 rounded-lg shadow-lg printable-area"
      >
        <ReportHeader title={reportTitle} subtitle={`Gerado em: ${reportDate}`} />
        {type === 'overdue' && <OverdueReport data={data} />}
        {type === 'revenue' && <RevenueReport data={data} />}
        {type === 'financial' && <FinancialReport data={data} />}
        {type === 'dre' && <DREReport data={data} />}
      </motion.div>
    </div>
  );
};

export default PrintableReport;