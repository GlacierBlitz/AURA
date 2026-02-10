/**
 * useAutocomplete - Hook for fetching search suggestions from SERP API
 */

import { useState, useCallback, useRef } from 'react';
import { IPC_CHANNELS } from '@shared/types';
import type { AutocompletePayload, AutocompleteResponse } from '@shared/types';

export function useAutocomplete() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload: AutocompletePayload = { query };
      
      if (window.electronAPI?.invoke) {
        const response: AutocompleteResponse = await window.electronAPI.invoke(
          IPC_CHANNELS.USER_AUTOCOMPLETE,
          payload
        );

        if (response.error) {
          setError(response.error);
          setSuggestions([]);
        } else {
          setSuggestions(response.suggestions || []);
          setError(null);
        }
      } else {
        setError('IPC not available');
        setSuggestions([]);
      }
    } catch (err: any) {
      console.error('Autocomplete error:', err);
      setError(err.message || 'Failed to fetch suggestions');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const debouncedFetch = useCallback((query: string, delayMs = 300) => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(query);
    }, delayMs);
  }, [fetchSuggestions]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    fetchSuggestions: debouncedFetch,
    clearSuggestions,
  };
}
