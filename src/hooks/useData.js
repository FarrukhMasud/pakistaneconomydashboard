import { useState, useEffect } from 'react';

export function useData(filename) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const cacheBuster = import.meta.env?.VITE_DATA_VERSION || Date.now();
    const url = `/data/${filename}?v=${encodeURIComponent(cacheBuster)}`;

    fetch(url, { cache: 'no-store', signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${filename}: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filename]);

  return { data, loading, error };
}
