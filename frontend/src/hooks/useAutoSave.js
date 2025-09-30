import { useCallback, useRef, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';

/**
 * Hook para auto-save inteligente com debounce e detecção de mudanças
 */
export const useAutoSave = (data, saveFunction, options = {}) => {
  const {
    delay = 2000,
    enabled = true,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
    compareFunction
  } = options;

  const { showSuccess, showError } = useNotifications();
  const timeoutRef = useRef(null);
  const previousDataRef = useRef(data);
  const isSavingRef = useRef(false);
  const hasChangesRef = useRef(false);

  const hasDataChanged = useCallback((newData, oldData) => {
    if (compareFunction) {
      return compareFunction(newData, oldData);
    }
    return JSON.stringify(newData) !== JSON.stringify(oldData);
  }, [compareFunction]);

  const performSave = useCallback(async () => {
    if (isSavingRef.current || !hasChangesRef.current) {
      return;
    }

    try {
      isSavingRef.current = true;
      onSaveStart?.();

      await saveFunction(data);
      
      previousDataRef.current = data;
      hasChangesRef.current = false;
      
      onSaveSuccess?.();
      showSuccess('Alterações salvas automaticamente', 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      onSaveError?.(error);
      showError('Erro ao salvar automaticamente', 3000);
    } finally {
      isSavingRef.current = false;
    }
  }, [data, saveFunction, onSaveStart, onSaveSuccess, onSaveError, showSuccess, showError]);

  const scheduleAutoSave = useCallback(() => {
    if (!enabled) return;

    // Cancelar save anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Verificar se há mudanças
    if (hasDataChanged(data, previousDataRef.current)) {
      hasChangesRef.current = true;
      
      // Agendar novo save
      timeoutRef.current = setTimeout(() => {
        performSave();
      }, delay);
    }
  }, [data, enabled, delay, hasDataChanged, performSave]);

  // Trigger auto-save quando dados mudam
  useEffect(() => {
    scheduleAutoSave();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [scheduleAutoSave]);

  // Save imediato ao desmontar
  useEffect(() => {
    return () => {
      if (hasChangesRef.current && enabled) {
        // Save síncrono final
        saveFunction(data).catch(console.error);
      }
    };
  }, []);

  const forceSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    await performSave();
  }, [performSave]);

  const cancelAutoSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    hasChangesRef.current = false;
  }, []);

  return {
    isSaving: isSavingRef.current,
    hasChanges: hasChangesRef.current,
    forceSave,
    cancelAutoSave
  };
};

/**
 * Hook para backup em localStorage
 */
export const useLocalBackup = (key, data, options = {}) => {
  const { interval = 30000, maxBackups = 5 } = options; // 30 segundos, 5 backups
  const intervalRef = useRef(null);

  const createBackup = useCallback(() => {
    try {
      const backupKey = `${key}_backup`;
      const existingBackups = JSON.parse(localStorage.getItem(backupKey) || '[]');
      
      const newBackup = {
        timestamp: Date.now(),
        data: data
      };
      
      // Adicionar novo backup e manter apenas os mais recentes
      const updatedBackups = [newBackup, ...existingBackups]
        .slice(0, maxBackups);
      
      localStorage.setItem(backupKey, JSON.stringify(updatedBackups));
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  }, [key, data, maxBackups]);

  const restoreBackup = useCallback((index = 0) => {
    try {
      const backupKey = `${key}_backup`;
      const backups = JSON.parse(localStorage.getItem(backupKey) || '[]');
      
      if (backups[index]) {
        return backups[index].data;
      }
      return null;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      return null;
    }
  }, [key]);

  const listBackups = useCallback(() => {
    try {
      const backupKey = `${key}_backup`;
      const backups = JSON.parse(localStorage.getItem(backupKey) || '[]');
      return backups.map(backup => ({
        timestamp: new Date(backup.timestamp),
        preview: typeof backup.data === 'string' 
          ? backup.data.substring(0, 50) + '...'
          : JSON.stringify(backup.data).substring(0, 50) + '...'
      }));
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }, [key]);

  const clearBackups = useCallback(() => {
    try {
      const backupKey = `${key}_backup`;
      localStorage.removeItem(backupKey);
    } catch (error) {
      console.error('Failed to clear backups:', error);
    }
  }, [key]);

  // Iniciar backup automático
  useEffect(() => {
    if (interval > 0) {
      intervalRef.current = setInterval(createBackup, interval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [interval, createBackup]);

  return {
    createBackup,
    restoreBackup,
    listBackups,
    clearBackups
  };
};
