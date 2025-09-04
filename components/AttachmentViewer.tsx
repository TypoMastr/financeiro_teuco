import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from './Icons';
import { ViewState } from '../types';

interface AttachmentViewProps {
    viewState: ViewState;
    setView: (view: ViewState) => void;
}

export const AttachmentViewer: React.FC<AttachmentViewProps> = ({ viewState, setView }) => {
    const { attachmentUrl, returnView } = viewState;

    if (!attachmentUrl || !returnView) {
        if (returnView) setView(returnView);
        else setView({ name: 'overview' });
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            <div className="flex justify-start">
                <motion.button
                    onClick={() => setView(returnView)}
                    className="text-sm font-semibold transition-all duration-200 bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground py-2.5 px-5 rounded-full border border-border dark:border-dark-border shadow-btn hover:-translate-y-0.5 hover:shadow-lg dark:shadow-dark-btn flex items-center gap-2"
                    whileTap={{ scale: 0.95 }}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                </motion.button>
            </div>
            <div className="bg-card dark:bg-dark-card p-2 rounded-lg shadow-lg">
                <img
                    src={attachmentUrl}
                    alt="Anexo em tela cheia"
                    className="w-full h-auto object-contain rounded-md max-h-[80vh]"
                />
            </div>
        </motion.div>
    );
};
