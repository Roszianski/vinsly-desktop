import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
interface SplashScreenProps {
  isVisible: boolean;
  theme: 'light' | 'dark';
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible, theme }) => {
  const isDark = theme === 'dark';
  const backgroundClass = isDark
    ? 'bg-gradient-to-b from-v-dark to-black text-white'
    : 'bg-gradient-to-b from-white via-v-light-bg to-v-light-border text-v-light-text-primary';
  const accentText = isDark ? 'text-white/70' : 'text-v-light-text-secondary';
  const primaryText = isDark ? 'text-white' : 'text-v-light-text-primary';

  return (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        key="vinsly-splash"
        className={`fixed inset-0 z-[12000] flex items-center justify-center ${backgroundClass}`}
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center space-y-2"
        >
          <div className={`text-sm tracking-[0.6em] uppercase ${accentText}`}>Welcome to</div>
          <div className={`text-5xl font-black tracking-[0.4em] ${primaryText}`}>VINSLY</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  );
};

export default SplashScreen;
