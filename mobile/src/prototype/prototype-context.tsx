import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import { Locale } from '@/i18n/messages';

export type PrototypeRole = 'investor' | 'partner' | 'attorney';
export type PrototypeLanguage = Locale;
export type PartnerStatus = 'applying' | 'under_review' | 'approved';

type PrototypeState = {
  language: PrototypeLanguage;
  role: PrototypeRole;
  assessmentComplete: boolean;
  partnerStatus: PartnerStatus;
  partnerTrainingComplete: boolean;
  referralSubmitted: boolean;
  setLanguage: (language: PrototypeLanguage) => void;
  setRole: (role: PrototypeRole) => void;
  completeAssessment: () => void;
  submitPartnerApplication: () => void;
  approvePartnerPreview: () => void;
  completePartnerTraining: () => void;
  submitReferral: () => void;
  resetPrototype: () => void;
};

const PrototypeContext = createContext<PrototypeState | null>(null);

export function PrototypeProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<PrototypeLanguage>('en');
  const [role, setRole] = useState<PrototypeRole>('investor');
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>('applying');
  const [partnerTrainingComplete, setPartnerTrainingComplete] = useState(false);
  const [referralSubmitted, setReferralSubmitted] = useState(false);

  const value = useMemo<PrototypeState>(() => ({
    language,
    role,
    assessmentComplete,
    partnerStatus,
    partnerTrainingComplete,
    referralSubmitted,
    setLanguage,
    setRole,
    completeAssessment: () => setAssessmentComplete(true),
    submitPartnerApplication: () => setPartnerStatus('under_review'),
    approvePartnerPreview: () => setPartnerStatus('approved'),
    completePartnerTraining: () => setPartnerTrainingComplete(true),
    submitReferral: () => setReferralSubmitted(true),
    resetPrototype: () => {
      setRole('investor');
      setAssessmentComplete(false);
      setPartnerStatus('applying');
      setPartnerTrainingComplete(false);
      setReferralSubmitted(false);
    },
  }), [assessmentComplete, language, partnerStatus, partnerTrainingComplete, referralSubmitted, role]);

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype() {
  const value = useContext(PrototypeContext);
  if (!value) throw new Error('usePrototype must be used within PrototypeProvider');
  return value;
}
