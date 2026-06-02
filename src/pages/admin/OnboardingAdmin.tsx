import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import Trails from './Trails';
import Modules from './Modules';
import EirJourneyAdmin from './EirJourneyAdmin';
import LiveSessionsAdmin from './LiveSessionsAdmin';

export default function OnboardingAdmin() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'trails' | 'modules' | 'eir_journey' | 'live_sessions'>('trails');

  return (
    <div className={`space-y-6 transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {t('admin.onboardingManagement')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('admin.onboardingManagementSub')}
          </p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('trails')}
          className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'trails'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          {t('admin.onboardingTrails')}
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'modules'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          {t('admin.onboardingModules')}
        </button>
        <button
          onClick={() => setActiveTab('eir_journey')}
          className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'eir_journey'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          {t('admin.eirJourney', 'Jornada EIR (Dias)')}
        </button>
        <button
          onClick={() => setActiveTab('live_sessions')}
          className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'live_sessions'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          Sessões ao Vivo
        </button>
      </div>

      <div className="">
        {activeTab === 'trails' && <Trails isOnboardingMode={true} hideHeader={true} />}
        {activeTab === 'modules' && <Modules isOnboardingMode={true} hideHeader={true} />}
        {activeTab === 'eir_journey' && <EirJourneyAdmin />}
        {activeTab === 'live_sessions' && <LiveSessionsAdmin />}
      </div>
    </div>
  );
}
