export const LEVEL_CONFIGS: Record<number, { name: string; icon: string; color: string; desc: string; phrase: string }> = {
  1: { 
    name: 'Pioneiro Xertica', 
    icon: 'Sparkles', 
    color: '#38bdf8', 
    desc: 'Bem-vindo à jornada! Você é um Pioneiro Nível 1.',
    phrase: 'O primeiro passo de uma grande história!'
  },
  2: { 
    name: 'Explorador Novato', 
    icon: 'Star', 
    color: '#94a3b8', 
    desc: 'Sua jornada começou! Você alcançou o Nível 2.',
    phrase: 'Você está descobrindo novos horizontes!'
  },
  3: { 
    name: 'Aprendiz Ativo', 
    icon: 'Zap', 
    color: '#fbbf24', 
    desc: 'O conhecimento está fluindo! Bem-vindo ao Nível 3.',
    phrase: 'Sua energia é contagiante!'
  },
  4: { 
    name: 'Especialista em Foco', 
    icon: 'Target', 
    color: '#f87171', 
    desc: 'Você está focado! Nível 4 atingido com sucesso.',
    phrase: 'Direto no alvo! Continue assim.'
  },
  5: { 
    name: 'Mestre do Saber', 
    icon: 'Shield', 
    color: '#60a5fa', 
    desc: 'Uma autoridade no assunto! Você chegou ao Nível 5.',
    phrase: 'Sua sabedoria inspira a todos nós.'
  },
  6: { 
    name: 'Lenda da Área', 
    icon: 'Flame', 
    color: '#f472b6', 
    desc: 'Seu desempenho é lendário! Nível 6 conquistado.',
    phrase: 'Você está deixando sua marca na história!'
  },
  7: { 
    name: 'Guardião do Conhecimento', 
    icon: 'Crown', 
    color: '#a78bfa', 
    desc: 'O topo está próximo! Você é um Guardião Nível 7.',
    phrase: 'A maestria agora é sua aliada.'
  },
  8: { 
    name: 'Elite Xertica', 
    icon: 'Trophy', 
    color: '#fbbf24', 
    desc: 'Você faz parte da elite! Nível 8 alcançado.',
    phrase: 'O topo do mundo! Você é imparável.'
  },
};

export const DEFAULT_LEVEL_CONFIG = { 
  name: 'Veterano', 
  icon: 'Trophy', 
  color: '#fbbf24', 
  desc: 'Incrível persistência!',
  phrase: 'Sua dedicação não tem limites!'
};
