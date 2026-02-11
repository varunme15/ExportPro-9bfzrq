import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, Alert, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp, BoxType } from '../contexts/AppContext';
import { SavingOverlay } from '../components';

export default function StandardBoxesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { boxTypes, addBoxType, updateBoxType, deleteBoxType } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBox, setEditingBox] = useState<BoxType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formLength, setFormLength] = useState('');
  const [formWidth, setFormWidth] = useState('');
  const [formHeight, setFormHeight] = useState('');
  const [formEmptyWeight, setFormEmptyWeight] = useState('');
  const [formMaxWeight, setFormMaxWeight] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const filteredBoxTypes = boxTypes.filter(bt =>
    searchQuery === '' ||
    bt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bt.dimensions.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = boxTypes.filter(bt => bt.is_active !== false).length;

  const resetForm = () => {
    setFormName('');
    setFormLength('');
    setFormWidth('');
    setFormHeight('');
    setFormEmptyWeight('');
    setFormMaxWeight('');
    setFormNotes('');
    setFormIsActive(true);
    setEditingBox(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (box: BoxType) => {
    setEditingBox(box);
    setFormName(box.name);
    // Parse dimensions "LxWxH"
    const dims = box.dimensions.split('x').map(d => d.trim());
    setFormLength(dims[0] || '');
    setFormWidth(dims[1] || '');
    setFormHeight(dims[2] || '');
    setFormEmptyWeight(box.empty_weight ? box.empty_weight.toString() : '');
    setFormMaxWeight(box.max_weight ? box.max_weight.toString() : '');
    setFormNotes(box.notes || '');
    setFormIsActive(box.is_active !== false);
    setShowFormModal(true);
  };

  const validateForm = (): boolean => {
    if (!formName.trim()) {
      Alert.alert('Validation', 'Box name is required');
      return false;
    }
    const l = parseFloat(formLength);
    const w = parseFloat(formWidth);
    const h = parseFloat(formHeight);
    if (isNaN(l) || l <= 0 || isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
      Alert.alert('Validation', 'Length, width, and height must be positive numbers');
      return false;
    }
    if (formMaxWeight && (isNaN(parseFloat(formMaxWeight)) || parseFloat(formMaxWeight) < 0)) {
      Alert.alert('Validation', 'Max weight must be a non-negative number');
      return false;
    }
    if (formEmptyWeight && (isNaN(parseFloat(formEmptyWeight)) || parseFloat(formEmptyWeight) < 0)) {
      Alert.alert('Validation', 'Empty weight must be a non-negative number');
      return false;
    }
    // Check unique name
    const nameLower = formName.trim().toLowerCase();
    const duplicate = boxTypes.find(bt => 
      bt.name.toLowerCase() === nameLower && bt.id !== editingBox?.id
    );
    if (duplicate) {
      Alert.alert('Validation', 'A box type with this name already exists');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const dimensions = `${formLength}x${formWidth}x${formHeight}`;
      const payload = {
        name: formName.trim(),
        dimensions,
        max_weight: parseFloat(formMaxWeight) || 0,
        empty_weight: formEmptyWeight ? parseFloat(formEmptyWeight) : undefined,
        notes: formNotes.trim() || undefined,
        is_active: formIsActive,
      };

      if (editingBox) {
        await updateBoxType(editingBox.id, payload);
      } else {
        await addBoxType(payload);
      }
      setShowFormModal(false);
      resetForm();
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save box type');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (box: BoxType) => {
    Alert.alert(
      'Delete Box Type',
      `Delete "${box.name}"? This will not affect existing shipment boxes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteBoxType(box.id),
        },
      ]
    );
  };

  const parseDimensions = (dims: string) => {
    const parts = dims.split('x').map(Number);
    if (parts.length === 3 && parts.every(n => !isNaN(n))) {
      return { l: parts[0], w: parts[1], h: parts[2] };
    }
    return null;
  };

  const calculateCBM = (dims: string) => {
    const parsed = parseDimensions(dims);
    if (!parsed) return '0.0000';
    return ((parsed.l * parsed.w * parsed.h) / 1000000).toFixed(4);
  };

  const renderBoxType = ({ item }: { item: BoxType }) => {
    const isActive = item.is_active !== false;
    const cbm = calculateCBM(item.dimensions);

    return (
      <Pressable
        style={[styles.boxCard, !isActive && styles.boxCardInactive]}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.boxIcon}>
            <MaterialIcons name="inbox" size={24} color={isActive ? theme.primary : theme.textMuted} />
          </View>
          <View style={styles.cardHeaderInfo}>
            <Text style={[styles.boxName, !isActive && styles.textInactive]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.boxDims}>{item.dimensions} cm</Text>
          </View>
          {!isActive && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inactive</Text>
            </View>
          )}
        </View>

        <View style={styles.cardStats}>
          <View style={styles.cardStatItem}>
            <Text style={styles.cardStatLabel}>CBM</Text>
            <Text style={styles.cardStatValue}>{cbm}</Text>
          </View>
          <View style={styles.cardStatDivider} />
          <View style={styles.cardStatItem}>
            <Text style={styles.cardStatLabel}>Max Wt</Text>
            <Text style={styles.cardStatValue}>{item.max_weight ? `${item.max_weight} kg` : '-'}</Text>
          </View>
          <View style={styles.cardStatDivider} />
          <View style={styles.cardStatItem}>
            <Text style={styles.cardStatLabel}>Empty Wt</Text>
            <Text style={styles.cardStatValue}>{item.empty_weight ? `${item.empty_weight} kg` : '-'}</Text>
          </View>
        </View>

        {item.notes ? (
          <Text style={styles.notesText} numberOfLines={1}>{item.notes}</Text>
        ) : null}

        <View style={styles.cardActions}>
          <Pressable style={styles.editBtn} onPress={() => openEditModal(item)}>
            <MaterialIcons name="edit" size={18} color={theme.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <MaterialIcons name="delete-outline" size={18} color={theme.error} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Standard Boxes</Text>
        <Pressable style={styles.addBtn} onPress={openAddModal}>
          <MaterialIcons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.primaryLight }]}>
          <Text style={styles.summaryValue}>{boxTypes.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.successLight }]}>
          <Text style={styles.summaryValue}>{activeCount}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.warningLight }]}>
          <Text style={styles.summaryValue}>{boxTypes.length - activeCount}</Text>
          <Text style={styles.summaryLabel}>Inactive</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search box types..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <Pressable onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Box Types List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredBoxTypes}
          renderItem={renderBoxType}
          estimatedItemSize={180}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="inbox" size={48} color={theme.textMuted} />
              <Text style={styles.emptyText}>No box types defined</Text>
              <Pressable style={styles.emptyBtn} onPress={openAddModal}>
                <Text style={styles.emptyBtnText}>Add Box Type</Text>
              </Pressable>
            </View>
          }
        />
      </View>

      {/* Form Modal */}
      <Modal
        visible={showFormModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFormModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalHeader}>
              <Pressable onPress={() => { setShowFormModal(false); resetForm(); }}>
                <MaterialIcons name="close" size={24} color={theme.textPrimary} />
              </Pressable>
              <Text style={styles.modalTitle}>
                {editingBox ? 'Edit Box Type' : 'Add Box Type'}
              </Text>
              <Pressable
                style={[styles.modalSaveBtn, !formName.trim() && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!formName.trim()}
              >
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Box Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Standard Export Box"
                  placeholderTextColor={theme.textMuted}
                  value={formName}
                  onChangeText={setFormName}
                  autoFocus
                />
              </View>

              <Text style={styles.formSectionTitle}>DIMENSIONS (cm) *</Text>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Length</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    value={formLength}
                    onChangeText={setFormLength}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginHorizontal: spacing.sm }]}>
                  <Text style={styles.label}>Width</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    value={formWidth}
                    onChangeText={setFormWidth}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Height</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    value={formHeight}
                    onChangeText={setFormHeight}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {formLength && formWidth && formHeight ? (
                <View style={styles.cbmPreview}>
                  <Text style={styles.cbmLabel}>Calculated CBM</Text>
                  <Text style={styles.cbmValue}>
                    {((parseFloat(formLength) * parseFloat(formWidth) * parseFloat(formHeight)) / 1000000).toFixed(4)} m³
                  </Text>
                </View>
              ) : null}

              <Text style={styles.formSectionTitle}>WEIGHT (kg)</Text>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Empty Weight</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.0"
                    placeholderTextColor={theme.textMuted}
                    value={formEmptyWeight}
                    onChangeText={setFormEmptyWeight}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
                  <Text style={styles.label}>Max Weight</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.0"
                    placeholderTextColor={theme.textMuted}
                    value={formMaxWeight}
                    onChangeText={setFormMaxWeight}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="e.g., Double-wall corrugated"
                  placeholderTextColor={theme.textMuted}
                  value={formNotes}
                  onChangeText={setFormNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Active</Text>
                  <Text style={styles.switchDesc}>
                    Inactive boxes will not appear in shipment dropdowns
                  </Text>
                </View>
                <Switch
                  value={formIsActive}
                  onValueChange={setFormIsActive}
                  trackColor={{ false: theme.border, true: theme.primaryLight }}
                  thumbColor={formIsActive ? theme.primary : theme.textMuted}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        <SavingOverlay visible={isSaving} message="Saving..." />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.cardValue,
    color: theme.textPrimary,
  },
  summaryLabel: {
    ...typography.small,
    color: theme.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    height: 48,
    gap: spacing.sm,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: theme.textPrimary,
  },
  listContainer: {
    flex: 1,
  },
  boxCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  boxCardInactive: {
    opacity: 0.7,
    borderLeftWidth: 3,
    borderLeftColor: theme.textMuted,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  boxIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: `${theme.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  boxName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  textInactive: {
    color: theme.textMuted,
  },
  boxDims: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  inactiveBadge: {
    backgroundColor: `${theme.textMuted}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  inactiveBadgeText: {
    ...typography.small,
    color: theme.textMuted,
    fontWeight: '600',
  },
  cardStats: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  cardStatDivider: {
    width: 1,
    backgroundColor: theme.border,
  },
  cardStatLabel: {
    ...typography.small,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  cardStatValue: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  notesText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    paddingTop: spacing.md,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editBtnText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    ...typography.body,
    color: theme.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  modalSaveBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  saveBtnDisabled: {
    backgroundColor: theme.border,
  },
  modalSaveBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  formSectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: theme.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: theme.textPrimary,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  cbmPreview: {
    backgroundColor: theme.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cbmLabel: {
    ...typography.body,
    color: theme.primaryDark,
  },
  cbmValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.primaryDark,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  switchInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchLabel: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    marginBottom: 2,
  },
  switchDesc: {
    ...typography.caption,
    color: theme.textSecondary,
  },
});
