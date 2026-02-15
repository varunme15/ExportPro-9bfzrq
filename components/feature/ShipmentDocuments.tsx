import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { theme, typography, spacing, borderRadius, shadows } from '../../constants/theme';
import {
  DOC_TYPES,
  getDocTypeLabel,
  formatFileSize,
  ALLOWED_MIME_TYPES,
  ShipmentDocument,
} from '../../services/shipmentDocuments';
import { useShipmentDocuments, PendingFile } from '../../hooks/useShipmentDocuments';

interface Props {
  shipmentId: string;
  customerId?: string;
}

export default function ShipmentDocumentsSection({ shipmentId, customerId }: Props) {
  const {
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
  } = useShipmentDocuments(shipmentId, customerId);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handlePickFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: Object.keys(ALLOWED_MIME_TYPES),
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const files = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.name || 'unnamed',
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
      }));

      addPendingFiles(files);
      setShowUploadModal(true);
    } catch (err) {
      console.error('File picker error:', err);
    }
  }, [addPendingFiles]);

  const handleUploadAll = useCallback(async () => {
    await uploadPendingFiles();
    // Keep modal open to show results, user dismisses manually
  }, [uploadPendingFiles]);

  const handleDismissModal = useCallback(() => {
    const hasSuccess = pendingFiles.some(f => f.status === 'success');
    setShowUploadModal(false);
    clearPendingFiles();
    if (hasSuccess) loadDocuments();
  }, [pendingFiles, clearPendingFiles, loadDocuments]);

  const handleDeleteDoc = useCallback((doc: ShipmentDocument) => {
    Alert.alert(
      'Delete Document',
      `Delete "${doc.file_name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument(doc.id, doc.storage_path);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete');
            }
          },
        },
      ],
    );
  }, [deleteDocument]);

  const handlePreview = useCallback((doc: ShipmentDocument) => {
    if (doc.file_url) {
      if (doc.mime_type.startsWith('image/') || doc.mime_type === 'application/pdf') {
        setPreviewUrl(doc.file_url);
      } else {
        Linking.openURL(doc.file_url);
      }
    }
  }, []);

  const handleDownload = useCallback((doc: ShipmentDocument) => {
    if (doc.file_url) {
      Linking.openURL(doc.file_url);
    }
  }, []);

  const getFileIcon = (mimeType: string): string => {
    if (mimeType === 'application/pdf') return 'picture-as-pdf';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('word')) return 'description';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'table-chart';
    return 'insert-drive-file';
  };

  const getFileIconColor = (mimeType: string): string => {
    if (mimeType === 'application/pdf') return '#E53E3E';
    if (mimeType.startsWith('image/')) return '#3B82F6';
    if (mimeType.includes('word')) return '#2B6CB0';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '#38A169';
    return theme.textSecondary;
  };

  const allUploaded = pendingFiles.length > 0 && pendingFiles.every(f => f.status === 'success' || f.status === 'error');
  const hasValidPending = pendingFiles.some(f => f.status === 'pending');

  return (
    <View>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>DOCUMENTS ({documents.length})</Text>
        <Pressable
          style={({ pressed }) => [styles.uploadBtn, pressed && { opacity: 0.7 }]}
          onPress={handlePickFiles}
        >
          <MaterialIcons name="cloud-upload" size={16} color={theme.primary} />
          <Text style={styles.uploadBtnText}>Upload</Text>
        </Pressable>
      </View>

      {/* Loading */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : documents.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="folder-open" size={48} color={theme.textMuted} />
          <Text style={styles.emptyText}>No documents uploaded</Text>
          <Pressable
            style={({ pressed }) => [styles.emptyUploadBtn, pressed && { opacity: 0.7 }]}
            onPress={handlePickFiles}
          >
            <MaterialIcons name="cloud-upload" size={18} color="#FFF" />
            <Text style={styles.emptyUploadBtnText}>Upload Documents</Text>
          </Pressable>
        </View>
      ) : (
        documents.map(doc => (
          <View key={doc.id} style={styles.docCard}>
            <View style={styles.docRow}>
              <View style={[styles.docIconWrap, { backgroundColor: `${getFileIconColor(doc.mime_type)}15` }]}>
                <MaterialIcons
                  name={getFileIcon(doc.mime_type) as any}
                  size={22}
                  color={getFileIconColor(doc.mime_type)}
                />
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docName} numberOfLines={1}>{doc.file_name}</Text>
                <View style={styles.docMeta}>
                  <View style={styles.docTypeBadge}>
                    <Text style={styles.docTypeText}>
                      {getDocTypeLabel(doc.doc_type, doc.custom_doc_type_label || undefined)}
                    </Text>
                  </View>
                  <Text style={styles.docSize}>{formatFileSize(doc.file_size)}</Text>
                </View>
                {doc.notes ? <Text style={styles.docNotes} numberOfLines={1}>{doc.notes}</Text> : null}
                <Text style={styles.docDate}>
                  {new Date(doc.created_at).toLocaleDateString()} {new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
            <View style={styles.docActions}>
              {(doc.mime_type.startsWith('image/') || doc.mime_type === 'application/pdf') ? (
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => handlePreview(doc)}
                  hitSlop={8}
                >
                  <MaterialIcons name="visibility" size={18} color={theme.primary} />
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                onPress={() => handleDownload(doc)}
                hitSlop={8}
              >
                <MaterialIcons name="download" size={18} color={theme.success} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                onPress={() => handleDeleteDoc(doc)}
                hitSlop={8}
              >
                <MaterialIcons name="delete-outline" size={18} color={theme.error} />
              </Pressable>
            </View>
          </View>
        ))
      )}

      {/* Upload Review Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {allUploaded ? 'Upload Complete' : `Upload ${pendingFiles.length} File${pendingFiles.length !== 1 ? 's' : ''}`}
              </Text>
              <Pressable onPress={handleDismissModal} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {pendingFiles.map((file, index) => (
                <PendingFileCard
                  key={`${file.name}-${index}`}
                  file={file}
                  index={index}
                  onUpdate={updatePendingFile}
                  onRemove={removePendingFile}
                  disabled={uploading || file.status === 'success'}
                />
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              {allUploaded ? (
                <Pressable
                  style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleDismissModal}
                >
                  <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
                    onPress={handleDismissModal}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.uploadAllBtn,
                      (!hasValidPending || uploading) && styles.disabledBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={handleUploadAll}
                    disabled={!hasValidPending || uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="cloud-upload" size={18} color="#FFF" />
                        <Text style={styles.uploadAllText}>Upload All</Text>
                      </>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal visible={!!previewUrl} animationType="fade" transparent>
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewClose} onPress={() => setPreviewUrl(null)}>
            <MaterialIcons name="close" size={28} color="#FFF" />
          </Pressable>
          {previewUrl ? (
            Platform.OS === 'web' ? (
              <View style={styles.previewFrame}>
                <Text style={styles.previewLinkText}>Opening document...</Text>
                <Pressable onPress={() => { Linking.openURL(previewUrl); setPreviewUrl(null); }}>
                  <Text style={[styles.previewLinkText, { color: theme.primary, textDecorationLine: 'underline' }]}>Open in browser</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.previewFrame}>
                <Text style={styles.previewLinkText}>Document preview</Text>
                <Pressable
                  style={({ pressed }) => [styles.previewOpenBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => { Linking.openURL(previewUrl); setPreviewUrl(null); }}
                >
                  <MaterialIcons name="open-in-new" size={18} color="#FFF" />
                  <Text style={styles.previewOpenText}>Open in Browser</Text>
                </Pressable>
              </View>
            )
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

// Sub-component: Pending file card with type/notes assignment
function PendingFileCard({
  file,
  index,
  onUpdate,
  onRemove,
  disabled,
}: {
  file: PendingFile;
  index: number;
  onUpdate: (index: number, updates: Partial<PendingFile>) => void;
  onRemove: (index: number) => void;
  disabled: boolean;
}) {
  const [showTypePicker, setShowTypePicker] = useState(false);

  const statusIcon = () => {
    switch (file.status) {
      case 'uploading':
        return <ActivityIndicator size="small" color={theme.primary} />;
      case 'success':
        return <MaterialIcons name="check-circle" size={20} color={theme.success} />;
      case 'error':
        return <MaterialIcons name="error" size={20} color={theme.error} />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.pendingCard, file.status === 'error' && styles.pendingCardError]}>
      <View style={styles.pendingHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pendingName} numberOfLines={1}>{file.name}</Text>
          <Text style={styles.pendingSize}>{formatFileSize(file.size)}</Text>
        </View>
        <View style={styles.pendingStatus}>
          {statusIcon()}
          {!disabled && file.status !== 'uploading' ? (
            <Pressable onPress={() => onRemove(index)} hitSlop={8}>
              <MaterialIcons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {file.errorMessage ? (
        <Text style={styles.errorText}>{file.errorMessage}</Text>
      ) : null}

      {file.status === 'pending' ? (
        <View style={styles.pendingFields}>
          {/* Doc Type Picker */}
          <Text style={styles.fieldLabel}>Document Type</Text>
          <Pressable
            style={styles.pickerBtn}
            onPress={() => setShowTypePicker(!showTypePicker)}
          >
            <Text style={styles.pickerText}>
              {DOC_TYPES.find(d => d.value === file.docType)?.label || 'Select Type'}
            </Text>
            <MaterialIcons
              name={showTypePicker ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>

          {showTypePicker ? (
            <View style={styles.typeList}>
              {DOC_TYPES.map(dt => (
                <Pressable
                  key={dt.value}
                  style={[
                    styles.typeOption,
                    file.docType === dt.value && styles.typeOptionSelected,
                  ]}
                  onPress={() => {
                    onUpdate(index, { docType: dt.value });
                    setShowTypePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      file.docType === dt.value && styles.typeOptionTextSelected,
                    ]}
                  >
                    {dt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {file.docType === 'OTHER' ? (
            <>
              <Text style={styles.fieldLabel}>Custom Type Label</Text>
              <TextInput
                style={styles.textInput}
                value={file.customDocTypeLabel}
                onChangeText={t => onUpdate(index, { customDocTypeLabel: t })}
                placeholder="e.g. Customs Declaration"
                placeholderTextColor={theme.textMuted}
              />
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.textInput}
            value={file.notes}
            onChangeText={t => onUpdate(index, { notes: t })}
            placeholder="Add a note..."
            placeholderTextColor={theme.textMuted}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: `${theme.primary}10`,
    borderRadius: borderRadius.md,
  },
  uploadBtnText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  centered: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyState: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  emptyText: {
    ...typography.body,
    color: theme.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  emptyUploadBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  // Document card
  docCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  docIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    marginBottom: 2,
  },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  docTypeBadge: {
    backgroundColor: `${theme.primary}12`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  docTypeText: {
    ...typography.small,
    color: theme.primary,
    fontWeight: '600',
  },
  docSize: {
    ...typography.small,
    color: theme.textMuted,
  },
  docNotes: {
    ...typography.small,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  docDate: {
    ...typography.small,
    color: theme.textMuted,
  },
  docActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    paddingTop: spacing.sm,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: theme.backgroundSecondary,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '85%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  modalScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    ...typography.bodyBold,
    color: theme.textSecondary,
  },
  uploadAllBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  uploadAllText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  doneBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: theme.success,
    alignItems: 'center',
  },
  doneBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  // Pending file card
  pendingCard: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  pendingCardError: {
    borderColor: theme.error,
    backgroundColor: theme.errorLight,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingName: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  pendingSize: {
    ...typography.small,
    color: theme.textMuted,
    marginTop: 2,
  },
  pendingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    ...typography.small,
    color: theme.error,
    marginTop: spacing.sm,
  },
  pendingFields: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: spacing.md,
  },
  fieldLabel: {
    ...typography.small,
    color: theme.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pickerText: {
    ...typography.body,
    color: theme.textPrimary,
  },
  typeList: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  typeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  typeOptionSelected: {
    backgroundColor: `${theme.primary}10`,
  },
  typeOptionText: {
    ...typography.body,
    color: theme.textPrimary,
  },
  typeOptionTextSelected: {
    color: theme.primary,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    ...typography.body,
    color: theme.textPrimary,
  },
  // Preview
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFrame: {
    width: '80%',
    alignItems: 'center',
    gap: spacing.lg,
  },
  previewLinkText: {
    color: '#FFF',
    fontSize: 16,
  },
  previewOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  previewOpenText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
});
