
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Lock, ClubLogo } from './Icons';
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-dark-background flex flex-col items-center justify-center p-4 z-50 overflow-hidden"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-background via-dark-background to-dark-secondary/20" />
      <ClubLogo className="absolute w-[120vmin] h-[120vmin] text-primary-foreground/10 animate-spin-slow blur-3xl" />


      <motion.div
        className="relative flex flex-col items-center justify-center w-full h-full z-10"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-8 max-w-xs w-full p-8 bg-black/20 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <ClubLogo className="w-12 h-12 text-primary-foreground"/>
            <h1 className="text-2xl font-bold text-primary-foreground">Financeiro TEUCO</h1>
            <p className="text-sm text-white/70">Acesso Restrito</p>
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
                  className={`w-full text-center text-lg p-3 rounded-lg bg-white/10 border text-white placeholder-white/60 focus:ring-2 focus:outline-none transition-all ${isError ? 'border-red-400 ring-red-400' : 'border-white/20 focus:ring-white/50'}`}
              />
          </motion.div>
          
          <div className="flex items-center justify-center gap-4 w-full">
              {isBiometryRegistered && (
                  <motion.button
                      type="button"
                      onClick={handleBiometricAuth}
                      className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center border border-white/20"
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.2)'}}
                  >
                      <Fingerprint className="w-8 h-8 text-white/80" />
                  </motion.button>
              )}

              <motion.button
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground font-bold py-3 px-5 text-base rounded-lg shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all"
                  whileTap={{ scale: 0.98 }}
              >
                  Entrar
              </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
