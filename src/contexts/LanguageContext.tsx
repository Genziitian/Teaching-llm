'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { en } from '@/locales/en'
import { hi } from '@/locales/hi'

type Language = 'en' | 'hi'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

function translate(language: Language, key: string): string {
  const dict = language === 'hi' ? hi : en
  const keys = key.split('.')
  let val: any = dict
  for (const k of keys) {
    if (val?.[k] === undefined) return key
    val = val[k]
  }
  return typeof val === 'string' ? val : key
}

const defaultLanguageValue: LanguageContextType = {
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => translate('en', key),
}

const LanguageContext = createContext<LanguageContextType>(defaultLanguageValue)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const stored = localStorage.getItem('app_language')
    if (stored === 'en' || stored === 'hi') {
      setLanguageState(stored)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('app_language', lang)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: (key) => translate(language, key) }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
