(function () {
    const BUCKET = 'tournament-ocr-sources';

    function createBatchId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
            const value = Math.floor(Math.random() * 16);
            return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16);
        });
    }

    function sanitizeFileName(name, index) {
        const raw = String(name || `print-${index + 1}.png`);
        const dot = raw.lastIndexOf('.');
        const extension = dot >= 0 ? raw.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
        const base = (dot >= 0 ? raw.slice(0, dot) : raw)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80);
        return `${String(index + 1).padStart(2, '0')}-${base || 'print'}${extension || '.png'}`;
    }

    function encodeStoragePath(path) {
        return String(path || '')
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('/');
    }

    function publicUrl(supabaseUrl, storagePath) {
        return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${encodeStoragePath(storagePath)}`;
    }

    async function deleteObject(supabaseUrl, headers, storagePath) {
        try {
            await fetch(
                `${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeStoragePath(storagePath)}`,
                { method: 'DELETE', headers }
            );
        } catch (_) {
            // Best effort cleanup; the database record is still removed below.
        }
    }

    async function cleanupBatch({ supabaseUrl, headers, batchId, storagePaths }) {
        if (batchId) {
            try {
                await fetch(
                    `${supabaseUrl}/rest/v1/tournament_ocr_files?batch_id=eq.${encodeURIComponent(batchId)}`,
                    { method: 'DELETE', headers }
                );
            } catch (_) {
                // Best effort cleanup.
            }
        }
        await Promise.all(
            (storagePaths || []).map((path) => deleteObject(supabaseUrl, headers, path))
        );
    }

    async function uploadFiles({ supabaseUrl, headers, tournamentId, files }) {
        const sourceFiles = Array.from(files || []);
        if (!sourceFiles.length) return null;
        if (sourceFiles.some((file) => !String(file.type || '').startsWith('image/'))) {
            throw new Error('Somente imagens podem ser arquivadas como comprovantes OCR.');
        }

        const batchId = createBatchId();
        const storagePaths = [];
        try {
            for (let index = 0; index < sourceFiles.length; index++) {
                const file = sourceFiles[index];
                const storageRoot = tournamentId || 'pending';
                const storagePath = `${storageRoot}/${batchId}/${sanitizeFileName(file.name, index)}`;
                const uploadRes = await fetch(
                    `${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeStoragePath(storagePath)}`,
                    {
                        method: 'POST',
                        headers: {
                            ...headers,
                            'Content-Type': file.type || 'application/octet-stream',
                            'x-upsert': 'false'
                        },
                        body: file
                    }
                );
                if (!uploadRes.ok) {
                    const detail = await uploadRes.text();
                    throw new Error(`Falha ao arquivar "${file.name}" (${uploadRes.status}): ${detail}`);
                }
                storagePaths.push(storagePath);
            }

            const metadata = sourceFiles.map((file, index) => ({
                batch_id: batchId,
                storage_path: storagePaths[index],
                original_name: file.name || `print-${index + 1}`,
                mime_type: file.type || null,
                size_bytes: Number.isFinite(Number(file.size)) ? Number(file.size) : null
            }));
            return { batchId, storagePaths, metadata };
        } catch (error) {
            await cleanupBatch({ supabaseUrl, headers, batchId, storagePaths });
            throw error;
        }
    }

    async function loadFiles({ supabaseUrl, headers, tournamentId }) {
        if (!tournamentId) return [];
        const select = 'id,tournament_id,batch_id,storage_path,original_name,mime_type,size_bytes,created_at';
        const res = await fetch(
            `${supabaseUrl}/rest/v1/tournament_ocr_files?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=${encodeURIComponent(select)}&order=created_at.asc,id.asc`,
            { headers }
        );
        if (!res.ok) {
            if (res.status === 404 || res.status === 400) return [];
            throw new Error(`Falha ao carregar comprovantes OCR (${res.status})`);
        }
        const rows = await res.json();
        return (Array.isArray(rows) ? rows : []).map((row) => ({
            ...row,
            public_url: publicUrl(supabaseUrl, row.storage_path)
        }));
    }

    window.tournamentOcrFiles = {
        bucket: BUCKET,
        cleanupBatch,
        loadFiles,
        publicUrl,
        uploadFiles
    };
})();
