import React, { useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Import `Variants` type from framer-motion to explicitly type animation variants.
import { motion, AnimatePresence, Variants } from 'framer-motion';
// FIX: Import types from the corrected types.ts file.
import { ViewState, LogEntry } from '../types';
import { getLogs, undoLogAction } from '../services/api';
import { History, Undo, X as XIcon, AlertTriangle } from './Icons';
import { useToast } from './Notifications';

const formatTimestamp = (isoDate: string) => {
    const date = new Date(isoDate);
    const datePart = date.toLocaleDateString('pt-BR');
    const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} - ${timePart}h`;
};

const ConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    logEntry: LogEntry;
}> = ({ isOpen, onClose, onConfirm, logEntry }) => {
    return (
        <AnimatePresence>
            {isOpen && (
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
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                                <AlertTriangle className="h-6 w-6 text-warning" aria-hidden="true" />
                            </div>
                            <h3 className="mt-4 text-xl font-bold font-display text-foreground dark:text-dark-foreground">Desfazer Ação?</h3>
                            <div className="mt-2">
                                <p className="text-sm text-muted-foreground">
                                    Esta ação irá reverter a seguinte alteração:
                                </p>
                                <p className="mt-2 text-sm font-semibold bg-muted dark:bg-dark-muted p-3 rounded-md">"{logEntry.description}"</p>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-center gap-4">
                            <button
                                type="button"
                                className="inline-flex justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-semibold text-foreground dark:text-dark-foreground shadow-sm hover:bg-muted dark:hover:bg-dark-muted"
                                onClick={onClose}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="inline-flex justify-center rounded-md bg-warning px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-warning/90"
                                onClick={onConfirm}
                            >
                                Sim, Desfazer
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export const LogPage: React.FC<{ setView: (view: ViewState) => void }> = ({ setView }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const [logToUndo, setLogToUndo] = useState<LogEntry | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getLogs();
            setLogs(data);
        } catch (error) {
            console.error("Failed to fetch logs", error);
            toast.error("Erro ao carregar o histórico de atividades.");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUndoClick = (logEntry: LogEntry) => {
        setLogToUndo(logEntry);
    };

    const handleConfirmUndo = async () => {
        if (!logToUndo) return;
        try {
            await undoLogAction(logToUndo.id);
            toast.success("Ação desfeita com sucesso!");
            setLogToUndo(null);
            await fetchData();
        } catch (error) {
            console.error("Failed to undo action", error);
            toast.error("Não foi possível desfazer a ação.");
        }
    };
    
    const groupedLogs = useMemo(() => {
        const groups: Record<string, LogEntry[]> = {};
        logs.forEach(log => {
            const dateKey = new Date(log.timestamp).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(log);
        });
        return groups;
    }, [logs]);
    
    // FIX: Explicitly type variants object with `Variants` to satisfy TypeScript's strict type checking for framer-motion.
    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    // FIX: Explicitly type variants object with `Variants` to satisfy TypeScript's strict type checking for framer-motion.
    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring' } },
    };

    return (
        <>
            <div className="space-y-6">
                <motion.div variants={itemVariants} className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><History className="h-6 w-6 text-primary"/></div>
                    <h2 className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Histórico</h2>
                </motion.div>

                {loading ? (
                    <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
                ) : (
                    <div className="space-y-8">
                        {Object.keys(groupedLogs).length > 0 ? (
                            Object.entries(groupedLogs).map(([date, entries]) => (
                                <motion.div key={date} variants={itemVariants}>
                                    <h3 className="text-lg font-bold mb-3 text-foreground dark:text-dark-foreground">{date}</h3>
                                    <div className="space-y-2">
                                        {entries.map(log => (
                                            <motion.div 
                                                key={log.id} 
                                                className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center justify-between gap-4"
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                            >
                                                <div className="flex-1">
                                                    <p className="font-semibold text-foreground dark:text-dark-foreground">{log.description}</p>
                                                    <p className="text-xs text-muted-foreground">{formatTimestamp(log.timestamp)}</p>
                                                </div>
                                                <motion.button 
                                                    onClick={() => handleUndoClick(log)}
                                                    className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-warning transition-colors"
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <Undo className="h-4 w-4" /> Desfazer
                                                </motion.button>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <motion.div variants={itemVariants} className="text-center py-20 text-muted-foreground">
                                <History className="h-12 w-12 mx-auto mb-4 text-primary" />
                                <p className="font-semibold text-lg">Nenhuma atividade registrada.</p>
                                <p>As alterações feitas no sistema aparecerão aqui.</p>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
            
            {logToUndo && <ConfirmationModal 
                isOpen={!!logToUndo}
                onClose={() => setLogToUndo(null)}
                onConfirm={handleConfirmUndo}
                logEntry={logToUndo}
            />}
        </>
    );
};