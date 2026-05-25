import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Task } from '@shared/types';

export function useTasks(search?: string, status?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.listTasks({ search, status });
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const run = useCallback(async (toolId: number, fieldValues: Record<string, string>) => {
    const task = await api.runTask(toolId, fieldValues);
    await fetchTasks();
    return task;
  }, [fetchTasks]);

  const remove = useCallback(async (id: number) => {
    await api.deleteTask(id);
    await fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, run, remove, refetch: fetchTasks };
}
