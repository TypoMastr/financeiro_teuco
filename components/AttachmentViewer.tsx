import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Share2 } from './Icons';
import { ViewState } from '../types';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';

interface AttachmentViewProps {
    viewState: ViewState;
}

export const AttachmentViewer: React.FC<AttachmentViewProps> = ({ viewState }) => {
    const { setView } = useApp();
    const { attachmentUrl, returnView } = viewState as { name: 'attachment-view', attachmentUrl: string, returnView: ViewState };
    const toast = useToast();

    if (!attachmentUrl || !returnView) {
        if (returnView) setView(returnView);
        else setView({ name: 'overview' });
        return null;
    }

    const handleDownload = async () => {
        try {
            const response = await fetch(attachmentUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const filename = attachmentUrl.split('/').pop() || 'download';
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Falha no download do arquivo.');
        }
    };
    
    const handleShare = async () => {
        const filename = attachmentUrl.split('/').pop() || 'anexo';
        try {
            const response = await fetch(attachmentUrl);
            const blob = await response.blob();
            const file = new File([blob], filename, { type: blob.type });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Comprovante',
                    text: 'Veja este comprovante.',
                });
            } else {
                 throw new Error("Sharing not supported");
            }
        } catch (error) {
            // Fallback to copying link
            try {
                await navigator.clipboard.writeText(attachmentUrl);
                toast.success('Link do anexo copiado para a área de transferência!');
            } catch (copyError) {
                console.error('Share/Copy error:', error, copyError);
                toast.error('Não foi possível compartilhar ou copiar o link.');
            }
        }
    };


    return (
        <div className="space-y-6">
            <div className="w-full flex flex-col sm:flex-row justify-center sm:justify-between gap-4 no-print">
                <motion.button
                    onClick={() => setView(returnView)}
                    className="text-sm md:text-base font-semibold transition-all duration-200 bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground py-2.5 px-5 rounded-full border border-border dark:border-dark-border shadow-btn hover:-translate-y-0.5 hover:shadow-lg dark:shadow-dark-btn w-full sm:w-auto justify-center flex items-center gap-2"
                    whileTap={{ scale: 0.95 }}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                </motion.button>
                <div className="flex gap-3 justify-center">
                    <motion.button
                        onClick={handleDownload}
                        className="text-sm md:text-base font-semibold transition-all duration-200 bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground py-2.5 px-5 rounded-full border border-border dark:border-dark-border shadow-btn hover:-translate-y-0.5 hover:shadow-lg dark:shadow-dark-btn w-full sm:w-auto justify-center flex items-center gap-2"
                        whileTap={{ scale: 0.95 }}
                    >
                        <Download className="h-4 w-4" />
                        Download
                    </motion.button>
                     <motion.button
                        onClick={handleShare}
                        className="bg-primary text-primary-foreground text-sm md:text-base font-bold py-2.5 px-5 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm w-full sm:w-auto justify-center"
                        whileTap={{ scale: 0.95 }}
                    >
                        <Share2 className="h-4 w-4" />
                        Compartilhar
                    </motion.button>
                </div>
            </div>
            <div className="bg-card dark:bg-dark-card p-2 rounded-lg shadow-lg">
                <img
                    src={attachmentUrl}
                    alt="Anexo em tela cheia"
                    className="w-full h-auto object-contain rounded-md max-h-[80vh]"
                />
            </div>
        </div>
    );
};
