export interface Category {
  id: string;
  label: string;
  icon: string;
  terms: string[];
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'chess',    label: 'Ajedrez',  icon: '♟',  terms: ['chess', 'ajedrez'] },
  { id: 'audible',  label: 'Audible',  icon: '🎧', terms: ['audible'] },
  { id: 'novelas',  label: 'Novelas',  icon: '📖', terms: ['padura', 'vargas llosa', 'garcia marquez', 'garcía márquez', 'marquez'] },
  { id: 'ciclismo', label: 'Ciclismo', icon: '🚴', terms: ['ciclismo'] },
  { id: 'tts',      label: 'TTS',      icon: '🔊', terms: ['tts'] },
  { id: 'deutsch',  label: 'Deutsch',  icon: '🇩🇪', terms: ['deutsch', 'german', 'aleman', 'alemán'] },
];
