import { getSupabaseClient } from '@/template';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';

export interface ShipmentDocument {
  id: string;
  shipment_id: string;
  user_id: string;
  customer_id?: string;
  doc_type: string;
  custom_doc_type_label?: string;
  file_name: string;
  file_url?: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  notes?: string;
  created_at: string;
  created_by?: string;
}

export const DOC_TYPES = [
  { value: 'FINAL_INVOICE', label: 'Final Invoice' },
  { value: 'FINAL_PACKING_LIST', label: 'Final Packing List' },
  { value: 'BILL_OF_LADING', label: 'Bill of Lading' },
  { value: 'CERTIFICATE_OF_ORIGIN', label: 'Certificate of Origin' },
  { value: 'INSURANCE', label: 'Insurance Certificate' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type DocType = typeof DOC_TYPES[number]['value'];

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/jpg': 'JPG',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
};

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function getDocTypeLabel(docType: string, customLabel?: string): string {
  if (docType === 'OTHER' && customLabel) return customLabel;
  const found = DOC_TYPES.find(d => d.value === docType);
  return found ? found.label : docType;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFile(fileName: string, mimeType: string, fileSize: number): string | null {
  if (!ALLOWED_MIME_TYPES[mimeType]) {
    return `File type "${mimeType}" is not supported. Allowed: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX.`;
  }
  if (fileSize > MAX_FILE_SIZE) {
    return `File "${fileName}" exceeds the 25MB size limit (${formatFileSize(fileSize)}).`;
  }
  return null;
}

export async function fetchDocuments(shipmentId: string): Promise<ShipmentDocument[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shipment_documents')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching shipment documents:', error);
    throw new Error(error.message);
  }
  return data || [];
}

export async function uploadDocument(
  userId: string,
  shipmentId: string,
  customerId: string | undefined,
  file: { uri: string; name: string; mimeType: string; size: number },
  docType: string,
  customDocTypeLabel?: string,
  notes?: string,
): Promise<ShipmentDocument> {
  const supabase = getSupabaseClient();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${shipmentId}/${timestamp}-${safeName}`;

  // Upload file to storage
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const { error: uploadError } = await supabase.storage
      .from('shipment-documents')
      .upload(storagePath, blob, { contentType: file.mimeType, upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
  } else {
    const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
    const { error: uploadError } = await supabase.storage
      .from('shipment-documents')
      .upload(storagePath, decode(base64), { contentType: file.mimeType, upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from('shipment-documents').getPublicUrl(storagePath);
  const fileUrl = urlData?.publicUrl || '';

  // Insert metadata row
  const { data, error } = await supabase
    .from('shipment_documents')
    .insert([{
      shipment_id: shipmentId,
      user_id: userId,
      customer_id: customerId || null,
      doc_type: docType,
      custom_doc_type_label: docType === 'OTHER' ? (customDocTypeLabel || null) : null,
      file_name: file.name,
      file_url: fileUrl,
      storage_path: storagePath,
      mime_type: file.mimeType,
      file_size: file.size,
      notes: notes || null,
      created_by: userId,
    }])
    .select()
    .single();

  if (error) throw new Error(`Failed to save document record: ${error.message}`);
  return data;
}

export async function deleteDocument(docId: string, storagePath: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('shipment-documents')
    .remove([storagePath]);
  if (storageError) console.error('Storage delete error (non-blocking):', storageError);

  // Delete metadata row
  const { error } = await supabase
    .from('shipment_documents')
    .delete()
    .eq('id', docId);
  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}

export async function updateDocument(
  docId: string,
  updates: { doc_type?: string; custom_doc_type_label?: string; notes?: string; file_name?: string },
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('shipment_documents')
    .update(updates)
    .eq('id', docId);
  if (error) throw new Error(`Failed to update document: ${error.message}`);
}
