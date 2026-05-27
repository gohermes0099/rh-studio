import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export function useSettings() {
  const [keyIsSet, setKeyIsSet] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getKeyStatus()
      .then((res) => setKeyIsSet(res.keyIsSet))
      .catch(() => setKeyIsSet(false))
      .finally(() => setLoading(false));
  }, []);

  const setApiKey = useCallback(async (apiKey: string) => {
    const res = await api.setApiKey(apiKey);
    if (res.keyIsSet) setKeyIsSet(true);
    return res;
  }, []);

  return { keyIsSet, loading, setApiKey };
}
