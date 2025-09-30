import { useCallback, useRef, useState } from 'react';

/**
 * Hook para cache inteligente de dados com TTL e invalidação automática
 */
export const useSmartCache = (ttl = 5 * 60 * 1000) => { // 5 minutos default
  const cache = useRef(new Map());
  const timestamps = useRef(new Map());

  const set = useCallback((key, data) => {
    cache.current.set(key, data);
    timestamps.current.set(key, Date.now());
  }, []);

  const get = useCallback((key) => {
    const data = cache.current.get(key);
    const timestamp = timestamps.current.get(key);
    
    if (!data || !timestamp) {
      return null;
    }

    // Verificar se o cache expirou
    if (Date.now() - timestamp > ttl) {
      cache.current.delete(key);
      timestamps.current.delete(key);
      return null;
    }

    return data;
  }, [ttl]);

  const invalidate = useCallback((key) => {
    if (key) {
      cache.current.delete(key);
      timestamps.current.delete(key);
    } else {
      // Limpar todo o cache
      cache.current.clear();
      timestamps.current.clear();
    }
  }, []);

  const has = useCallback((key) => {
    const timestamp = timestamps.current.get(key);
    if (!timestamp) return false;
    
    // Verificar se ainda é válido
    if (Date.now() - timestamp > ttl) {
      invalidate(key);
      return false;
    }
    
    return cache.current.has(key);
  }, [ttl, invalidate]);

  return { set, get, invalidate, has };
};

/**
 * Hook para cache de requisições API com debounce
 */
export const useApiCache = () => {
  const { set, get, invalidate, has } = useSmartCache();
  const pendingRequests = useRef(new Map());

  const cachedFetch = useCallback(async (url, options = {}) => {
    const cacheKey = `${url}-${JSON.stringify(options)}`;
    
    // Retornar dados do cache se disponível
    if (has(cacheKey)) {
      return get(cacheKey);
    }

    // Evitar múltiplas requisições simultaneas para a mesma URL
    if (pendingRequests.current.has(cacheKey)) {
      return pendingRequests.current.get(cacheKey);
    }

    // Fazer a requisição
    const promise = fetch(url, options)
      .then(response => response.json())
      .then(data => {
        set(cacheKey, data);
        pendingRequests.current.delete(cacheKey);
        return data;
      })
      .catch(error => {
        pendingRequests.current.delete(cacheKey);
        throw error;
      });

    pendingRequests.current.set(cacheKey, promise);
    return promise;
  }, [set, get, has]);

  return { cachedFetch, invalidateCache: invalidate };
};

/**
 * Hook para otimização de re-renders com memoização inteligente
 */
export const useOptimizedState = (initialState, compareFn) => {
  const [state, setState] = useState(initialState);
  const previousState = useRef(initialState);

  const optimizedSetState = useCallback((newState) => {
    const nextState = typeof newState === 'function' ? newState(state) : newState;
    
    // Usar função de comparação customizada ou comparação superficial
    const hasChanged = compareFn 
      ? !compareFn(previousState.current, nextState)
      : JSON.stringify(previousState.current) !== JSON.stringify(nextState);
    
    if (hasChanged) {
      previousState.current = nextState;
      setState(nextState);
    }
  }, [state, compareFn]);

  return [state, optimizedSetState];
};
