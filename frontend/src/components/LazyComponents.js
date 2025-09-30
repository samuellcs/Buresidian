import { lazy } from 'react';

// Lazy loading dos componentes principais para melhor performance
export const LazyNoteEditor = lazy(() => import('./NoteEditor'));
export const LazyNotesGraph = lazy(() => import('./NotesGraph'));
export const LazyVersionHistory = lazy(() => import('./VersionHistory'));
export const LazyDashboard = lazy(() => import('./Dashboard'));
export const LazySearchComponent = lazy(() => import('./SearchComponent'));

// Hook para preload de componentes
export const usePreloadComponents = () => {
  const preloadNoteEditor = () => import('./NoteEditor');
  const preloadNotesGraph = () => import('./NotesGraph');
  const preloadVersionHistory = () => import('./VersionHistory');
  
  return {
    preloadNoteEditor,
    preloadNotesGraph,
    preloadVersionHistory
  };
};
