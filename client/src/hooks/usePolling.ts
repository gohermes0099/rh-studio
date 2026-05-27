import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import type { Task, TaskStatus } from '@shared/types';

const TERMINAL: TaskStatus[] = ['COMPLETED', 'FAILED', 'EXPIRED'];

export function usePolling(taskId: number | null) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTask = async (id: number) => {
    try {
      const data = await api.getTask(id);
      setTask(data.task);
      if (TERMINAL.includes(data.task.status)) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId === null) return;

    fetchTask(taskId);

    intervalRef.current = setInterval(() => {
      fetchTask(taskId);
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [taskId]);

  return { task, loading };
}
