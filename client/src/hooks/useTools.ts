import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Tool } from '@shared/types';

export function useTools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTools = useCallback(async () => {
    try {
      const data = await api.listTools();
      setTools(data);
    } catch {
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  const register = useCallback(async (webappId: string) => {
    const result = await api.registerTool(webappId);
    await fetchTools();
    return result;
  }, [fetchTools]);

  const remove = useCallback(async (id: number) => {
    const result = await api.deleteTool(id);
    await fetchTools();
    return result;
  }, [fetchTools]);

  return { tools, loading, register, remove, refetch: fetchTools };
}
