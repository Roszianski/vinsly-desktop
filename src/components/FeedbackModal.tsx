import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendFeedback } from '../utils/tauriCommands';
import { useToast } from '../contexts/ToastContext';

type FeedbackType = 'bug' | 'feature' | 'feedback';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  appVersion: string;
  userEmail?: string;
}

const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature: 'Feature Request',
  feedback: 'Feedback',
};

const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 10;

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  appVersion,
  userEmail = '',
}) => {
  const { showToast } = useToast();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feedback');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedMessage = message.trim();
  const isMessageValid = trimmedMessage.length >= MIN_MESSAGE_LENGTH && trimmedMessage.length <= MAX_MESSAGE_LENGTH;

  const handleSubmit = useCallback(async () => {
    if (!isMessageValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Get OS info
      const osInfo = `${navigator.platform} (${navigator.userAgent.split(') ')[0].split(' (').pop() || 'Unknown'})`;

      await sendFeedback({
        feedbackType: FEEDBACK_TYPE_LABELS[feedbackType],
        message: trimmedMessage,
        email: email.trim() || undefined,
        appVersion,
        osInfo,
      });

      showToast('success', 'Feedback sent! Thank you for helping improve Vinsly.');

      // Reset form and close
      setMessage('');
      setFeedbackType('feedback');
      onClose();
    } catch (error) {
      console.error('Failed to send feedback:', error);
      showToast('error', 'Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [feedbackType, trimmedMessage, email, appVersion, isMessageValid, isSubmitting, showToast, onClose]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <div
              className="w-full max-w-md bg-v-light-surface dark:bg-v-mid-dark rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-v-light-border dark:border-v-border">
                <h2 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  Send Feedback
                </h2>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary transition-colors disabled:opacity-50"
                  aria-label="Close feedback"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-5">
                {/* Feedback Type */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                    What type of feedback?
                  </label>
                  <div className="flex gap-2">
                    {(Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setFeedbackType(type)}
                        disabled={isSubmitting}
                        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          feedbackType === type
                            ? 'border-v-accent bg-v-accent/10 text-v-accent'
                            : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent/50'
                        } disabled:opacity-50`}
                      >
                        {FEEDBACK_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                    Your message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Tell us what's on your mind..."
                    rows={5}
                    maxLength={MAX_MESSAGE_LENGTH}
                    className="w-full px-4 py-3 rounded-lg border border-v-light-border dark:border-v-border bg-v-light-bg dark:bg-v-dark text-v-light-text-primary dark:text-v-text-primary placeholder:text-v-light-text-secondary/50 dark:placeholder:text-v-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-v-accent resize-none disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs">
                    <span className={`${
                      trimmedMessage.length < MIN_MESSAGE_LENGTH
                        ? 'text-amber-500'
                        : 'text-v-light-text-secondary dark:text-v-text-secondary'
                    }`}>
                      {trimmedMessage.length < MIN_MESSAGE_LENGTH && `Min ${MIN_MESSAGE_LENGTH} characters`}
                    </span>
                    <span className={`${
                      trimmedMessage.length > MAX_MESSAGE_LENGTH - 100
                        ? 'text-amber-500'
                        : 'text-v-light-text-secondary dark:text-v-text-secondary'
                    }`}>
                      {trimmedMessage.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>
                </div>

                {/* Email (optional) */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                    Email <span className="text-v-light-text-secondary dark:text-v-text-secondary font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-v-light-border dark:border-v-border bg-v-light-bg dark:bg-v-dark text-v-light-text-primary dark:text-v-text-primary placeholder:text-v-light-text-secondary/50 dark:placeholder:text-v-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-v-accent disabled:opacity-50"
                  />
                  <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                    Include if you'd like us to follow up
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-v-light-border dark:border-v-border flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg border border-v-light-border dark:border-v-border text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!isMessageValid || isSubmitting}
                  className="px-4 py-2 rounded-lg bg-v-accent text-white text-sm font-medium hover:bg-v-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray="60"
                        strokeDashoffset="20"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  <span>{isSubmitting ? 'Sending...' : 'Submit'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
