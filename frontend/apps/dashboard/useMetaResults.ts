import { useEffect, useState } from 'react';
import type { MicroContext } from '../../contracts';
import { createMetaCache, readMeta } from './metagame-model';

// Shared by Overview and Metagame for the lifetime of the dashboard module.
const cache = createMetaCache();
export function useMetaResults(context: MicroContext, version: number) {
    const [records, setRecords] = useState(() => cache.peek(version) || []);
    const [loading, setLoading] = useState(() => !cache.peek(version));
    const [error, setError] = useState(''),
        [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        const saved = cache.peek(version);
        if (saved) {
            setRecords(saved);
            setLoading(false);
            setError('');
            return;
        }
        if (!version) return;
        setLoading(true);
        setError('');
        // Do not cancel a shared request on navigation; the next view can reuse it.
        cache
            .load(version, () => readMeta(context, new AbortController().signal))
            .then((rows) => {
                if (active) setRecords(rows);
            })
            .catch((e) => {
                if (active) setError(e.message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [version, attempt]);
    return { records, loading, error, retry: () => setAttempt((n) => n + 1) };
}
