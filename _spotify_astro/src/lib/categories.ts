export interface Category {
  id: string;
  label: string;
  icon: string;
  terms: string[];
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'chess',    label: 'Ajedrez',  icon: '♟',  terms: ['chess', 'ajedrez'] },
  { id: 'audible',  label: 'Audible',  icon: '🎧', terms: ['audible'] },
  { id: 'novelas',  label: 'Novelas',  icon: '📖', terms: ['padura', 'vargas llosa', 'garcia marquez', 'garcía márquez', 'marquez', 'cervantes', 'shakespeare', 'dickens', 'tolstoy', 'dostoevsky', 'hugo', 'flaubert', 'balzac', 'hemingway', 'fitzgerald', 'orwell', 'kafka', 'joyce', 'proust', 'woolf', 'faulkner', 'camus', 'eco', 'murakami', 'rowling', 'coelho', 'austen', 'twain', 'steinbeck', 'saramago', 'cabrera infante', 'posteguillo', 'rivera de la cruz'] },
  { id: 'ciclismo', label: 'Ciclismo', icon: '🚴', terms: ['ciclismo'] },
  { id: 'historia', label: 'Historia', icon: '🏛', terms: ['historia', 'diana uribe'] },
  { id: 'youtube',  label: 'Youtube',  icon: '▶', terms: ['mp3-youtube'] },
  { id: 'tts',      label: 'TTS',      icon: '🔊', terms: ['tts'] },
  { id: 'deutsch',  label: 'Deutsch',  icon: '🇩🇪', terms: ['deutsch', 'german', 'aleman', 'alemán'] },
  { id: 'english',  label: 'English',  icon: '🇬🇧', terms: ['charlysway', 'englisch', 'english'] },
];
