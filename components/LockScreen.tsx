
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Lock } from './Icons';
import { useToast } from './Notifications';

interface LockScreenProps {
  onUnlock: () => void;
}

const CORRECT_PASSWORD = 'umbanda396';
const BIOMETRY_CREDENTIAL_KEY = 'biometry_credential_id_v1';

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [isError, setIsError] = useState(false);
  const [isBiometryRegistered, setIsBiometryRegistered] = useState(false);
  const toast = useToast();
  const autoAuthAttempted = useRef(false);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if(isError) setIsError(false);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setTimeout(onUnlock, 200);
    } else {
      setIsError(true);
      setTimeout(() => {
        setIsError(false);
        setPassword('');
      }, 820);
    }
  };

  const handleBiometricAuth = useCallback(async () => {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const credentialId = localStorage.getItem(BIOMETRY_CREDENTIAL_KEY);

      if (!credentialId) {
          toast.error("Biometria não cadastrada.");
          return;
      }
      
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            type: 'public-key',
            id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
          }],
          timeout: 60000,
          userVerification: 'required',
        },
      });

      if (credential) {
        onUnlock();
      }
    } catch (err: any) {
        console.error("Falha na autenticação biométrica:", err);
        if (err.name === 'NotAllowedError') {
             // User cancelled, which is fine. Don't show an error.
             console.log('Biometric authentication cancelled by user.');
        } else if (!window.isSecureContext) {
            toast.error('A biometria requer uma conexão segura (HTTPS).');
        } else {
             toast.error('Falha na autenticação. Tente a senha.');
        }
    }
  }, [onUnlock, toast]);

  useEffect(() => {
    const checkAndTriggerBiometry = async () => {
      if (
        window.PublicKeyCredential &&
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ) {
        const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        const isRegistered = !!localStorage.getItem(BIOMETRY_CREDENTIAL_KEY);
        setIsBiometryRegistered(isAvailable && isRegistered);
        
        if (isAvailable && isRegistered && !autoAuthAttempted.current) {
          autoAuthAttempted.current = true;
          await handleBiometricAuth();
        }
      }
    };
    checkAndTriggerBiometry();
  }, [handleBiometricAuth]);


  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 bg-background dark:bg-dark-background flex flex-col items-center justify-center p-4 z-50"
    >
      <motion.form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-6 max-w-xs w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3">
          <Lock className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground dark:text-dark-foreground">Acesso Restrito</h1>
        </div>

        <motion.div
            className="relative w-full"
            animate={isError ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
            <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Senha"
                className={`w-full text-center text-base p-3 rounded-lg bg-card dark:bg-dark-card border text-foreground dark:text-dark-foreground placeholder-muted-foreground dark:placeholder-dark-muted-foreground focus:ring-2 focus:outline-none transition-all ${isError ? 'border-destructive ring-destructive' : 'border-border dark:border-dark-border focus:ring-primary'}`}
            />
        </motion.div>
        
        <div className="flex items-center justify-center gap-4 w-full">
            {isBiometryRegistered && (
                <motion.button
                    type="button"
                    onClick={handleBiometricAuth}
                    className="w-14 h-14 rounded-full bg-card/80 dark:bg-dark-card/80 flex items-center justify-center border border-border dark:border-dark-border"
                    whileTap={{ scale: 0.9 }}
                >
                    <Fingerprint className="w-8 h-8 text-primary" />
                </motion.button>
            )}

            <motion.button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground font-bold py-3 px-5 text-base rounded-lg shadow-sm hover:bg-primary/90 transition-all"
                whileTap={{ scale: 0.98 }}
            >
                Entrar
            </motion.button>
        </div>

      </motion.form>
    </motion.div>
  );
};