import { useState, useCallback } from 'react';
import { useAuth } from '@/template';
import {
  ShipmentDocument,
  fetchDocuments,
  uploadDocument,
  deleteDocument as deleteDocService,
  updateDocument as updateDocService,
  validateFile,
} from '../services/shipmentDocuments';

export interface PendingFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  docType: string;
  customDocTypeLabel: string;
  notes: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export function useShipmentDocuments(shipmentId: string, customerId?: string) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const loadDocuments = useCallback(async () => {
    if (!shipmentId) return;
    setLoading(true);
    try {
      const docs = await fetchDocuments(shipmentId);
      setDocuments(docs);
    } catch (err: any) {
      console.error('Load documents error:', err);
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  const addPendingFiles = useCallback((files: Array<{ uri: string; name: string; mimeType: string; size: number }>) => {
    const newPending: PendingFile[] = files.map(f => {
      const validationError = validateFile(f.name, f.mimeType, f.size);
      return {
        ...f,
        docType: 'OTHER',
        customDocTypeLabel: '',
        notes: '',
        status: validationError ? 'error' : 'pending',
        errorMessage: validationError || undefined,
      };
    });
    setPendingFiles(prev => [...prev, ...newPending]);
  }, []);

  const updatePendingFile = useCallback((index: number, updates: Partial<PendingFile>) => {
    setPendingFiles(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearPendingFiles = useCallback(() => {
    setPendingFiles([]);
  }, []);

  const uploadPendingFiles = useCallback(async () => {
    if (!user?.id || pendingFiles.length === 0) return;

    const validFiles = pendingFiles.filter(f => f.status === 'pending');
    if (validFiles.length === 0) return;

    setUploading(true);

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      if (file.status !== 'pending') continue;

      setPendingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));

      try {
        await uploadDocument(
          user.id,
          shipmentId,
          customerId,
          { uri: file.uri, name: file.name, mimeType: file.mimeType, size: file.size },
          file.docType,
          file.docType === 'OTHER' ? file.customDocTypeLabel : undefined,
          file.notes || undefined,
        );
        setPendingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'success' } : f));
      } catch (err: any) {
        console.error(`Upload failed for ${file.name}:`, err);
        setPendingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', errorMessage: err.message || 'Upload failed' } : f));
      }
    }

    setUploading(false);
    await loadDocuments();
  }, [user?.id, pendingFiles, shipmentId, customerId, loadDocuments]);

  const deleteDocument = useCallback(async (docId: string, storagePath: string) => {
    try {
      await deleteDocService(docId, storagePath);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err: any) {
      console.error('Delete document error:', err);
      throw err;
    }
  }, []);

  const updateDocumentMeta = useCallback(async (
    docId: string,
    updates: { doc_type?: string; custom_doc_type_label?: string; notes?: string; file_name?: string },
  ) => {
    try {
      await updateDocService(docId, updates);
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updates } : d));
    } catch (err: any) {
      console.error('Update document error:', err);
      throw err;
    }
  }, []);

  return {
    documents,
    loading,
    uploading,
    pendingFiles,
    loadDocuments,
    addPendingFiles,
    updatePendingFile,
    removePendingFile,
    clearPendingFiles,
    uploadPendingFiles,
    deleteDocument,
    updateDocumentMeta,
  };
}
