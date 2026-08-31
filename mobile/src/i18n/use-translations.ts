import { useCallback } from 'react';

import { usePrototype } from '@/prototype/prototype-context';

import { MessageKey, translate } from './messages';

export function useTranslations() {
  const { language } = usePrototype();
  const t = useCallback((key: MessageKey) => translate(language, key), [language]);

  return { locale: language, t };
}
