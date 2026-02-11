import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { SavingOverlay } from '../components';

export default function AddBoxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { boxTypes, addBoxToShipment, addBoxType } = useApp();

  const shipmentId = params.shipmentId as string;

  // Only show active standard boxes in the dropdown
  const activeBoxTypes = boxTypes.filter(bt => bt.is_active !== false);

  const [selectedBoxType, setSelectedBoxType] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [boxWeight, setBoxWeight] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // When a standard box is selected, auto-fill dimension/weight fields
  const handleSelectBoxType = (btId: string) => {
    setSelectedBoxType(btId);
    const bt = boxTypes.find(b => b.id === btId);
    if (bt) {
      const dims = bt.dimensions.split('x').map(d => d.trim());
      setLength(dims[0] || '');
      setWidth(dims[1] || '');
      setHeight(dims[2] || '');
      setBoxWeight(bt.empty_weight ? bt.empty_weight.toString() : '');
    }
  };

  const handleSave = async () => {
    let boxTypeId = selectedBoxType;

    if (isCustom) {
      if (!customName.trim() || !length || !width || !height) {
        Alert.alert('Missing Data', 'Please fill in box name and dimensions');
        return;
      }
      // Create custom box type
      const newBoxType = {
        name: customName.trim(),
        dimensions: `${length}x${width}x${height}`,
        max_weight: parseFloat(boxWeight) || 0,
        empty_weight: parseFloat(boxWeight) || undefined,
        is_active: true,
      };
      await addBoxType(newBoxType);
      // Use the latest box type ID (will be refreshed)
      boxTypeId = `bt${Date.now()}`;
    } else if (!selectedBoxType) {
      Alert.alert('Missing Data', 'Please select a box type');
      return;
    }

    setIsSaving(true);
    try {
      // Store snapshot dimensions on the shipment box
      const snapshotDims = `${length}x${width}x${height}`;
      await addBoxToShipment(shipmentId, {
        box_type_id: boxTypeId,
        weight: parseFloat(grossWeight) || parseFloat(netWeight) || 0,
        dimensions: snapshotDims,
        products: [],
      });
      router.back();
    } catch (error) {
      console.error('Error adding box:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateCBM = () => {
    if (length && width && height) {
      const l = parseFloat(length) || 0;
      const w = parseFloat(width) || 0;
      const h = parseFloat(height) || 0;
      return ((l * w * h) / 1000000).toFixed(4);
    }
    return '0.0000';
  };

  const canSave = isCustom
    ? customName.trim() && length && width && height
    : selectedBoxType;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Add Box</Text>
          <Pressable 
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.saveBtnText}>Add</Text>
          </Pressable>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Box Type Toggle */}
          <View style={styles.toggleRow}>
            <Pressable 
              style={[styles.toggleBtn, !isCustom && styles.toggleBtnActive]}
              onPress={() => setIsCustom(false)}
            >
              <Text style={[styles.toggleText, !isCustom && styles.toggleTextActive]}>
                Standard Boxes
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.toggleBtn, isCustom && styles.toggleBtnActive]}
              onPress={() => setIsCustom(true)}
            >
              <Text style={[styles.toggleText, isCustom && styles.toggleTextActive]}>
                Custom Size
              </Text>
            </Pressable>
          </View>

          {!isCustom ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>SELECT STANDARD BOX</Text>
                <Pressable
                  style={styles.manageLink}
                  onPress={() => router.push('/standard-boxes')}
                >
                  <MaterialIcons name="settings" size={16} color={theme.primary} />
                  <Text style={styles.manageLinkText}>Manage</Text>
                </Pressable>
              </View>

              {activeBoxTypes.length === 0 ? (
                <View style={styles.emptyBoxTypes}>
                  <MaterialIcons name="inbox" size={40} color={theme.textMuted} />
                  <Text style={styles.emptyText}>No active standard boxes</Text>
                  <Pressable
                    style={styles.emptyAddBtn}
                    onPress={() => router.push('/standard-boxes')}
                  >
                    <MaterialIcons name="add" size={18} color="#FFF" />
                    <Text style={styles.emptyAddBtnText}>Add Box Types</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.boxTypesGrid}>
                  {activeBoxTypes.map(bt => {
                    const dims = bt.dimensions.split('x').map(d => d.trim());
                    return (
                      <Pressable
                        key={bt.id}
                        style={[
                          styles.boxTypeCard,
                          selectedBoxType === bt.id && styles.boxTypeCardActive
                        ]}
                        onPress={() => handleSelectBoxType(bt.id)}
                      >
                        <View style={[
                          styles.boxTypeIcon,
                          selectedBoxType === bt.id && styles.boxTypeIconActive
                        ]}>
                          <MaterialIcons 
                            name="inbox" 
                            size={24} 
                            color={selectedBoxType === bt.id ? '#FFF' : theme.primary} 
                          />
                        </View>
                        <Text style={[
                          styles.boxTypeName,
                          selectedBoxType === bt.id && styles.boxTypeNameActive
                        ]} numberOfLines={1}>
                          {bt.name}
                        </Text>
                        <Text style={[
                          styles.boxTypeDimensions,
                          selectedBoxType === bt.id && styles.boxTypeDimensionsActive
                        ]}>
                          {bt.dimensions} cm
                        </Text>
                        {bt.max_weight ? (
                          <Text style={[
                            styles.boxTypeWeight,
                            selectedBoxType === bt.id && styles.boxTypeWeightActive
                          ]}>
                            Max: {bt.max_weight} kg
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Override section when a standard box is selected */}
              {selectedBoxType ? (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>OVERRIDE DIMENSIONS (OPTIONAL)</Text>
                  <Text style={styles.overrideHint}>
                    Adjust dimensions for this specific shipment box. The standard values are pre-filled.
                  </Text>
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Length (cm)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                        value={length}
                        onChangeText={setLength}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginHorizontal: spacing.sm }]}>
                      <Text style={styles.label}>Width (cm)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                        value={width}
                        onChangeText={setWidth}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Height (cm)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                        value={height}
                        onChangeText={setHeight}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>CUSTOM BOX DIMENSIONS</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Box Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Custom Large Box"
                  placeholderTextColor={theme.textMuted}
                  value={customName}
                  onChangeText={setCustomName}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Length (cm) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    value={length}
                    onChangeText={setLength}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginHorizontal: spacing.sm }]}>
                  <Text style={styles.label}>Width (cm) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    value={width}
                    onChangeText={setWidth}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Height (cm) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Empty Box Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.0"
                  placeholderTextColor={theme.textMuted}
                  value={boxWeight}
                  onChangeText={setBoxWeight}
                  keyboardType="decimal-pad"
                />
              </View>
            </>
          )}

          {/* Weight Info */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>WEIGHT INFORMATION</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Net Weight (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.0"
                placeholderTextColor={theme.textMuted}
                value={netWeight}
                onChangeText={setNetWeight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
              <Text style={styles.label}>Gross Weight (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.0"
                placeholderTextColor={theme.textMuted}
                value={grossWeight}
                onChangeText={setGrossWeight}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* CBM Preview */}
          <View style={styles.cbmCard}>
            <View style={styles.cbmRow}>
              <Text style={styles.cbmLabel}>Calculated CBM</Text>
              <Text style={styles.cbmValue}>{calculateCBM()} m³</Text>
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <MaterialIcons name="info-outline" size={18} color={theme.primary} />
            <Text style={styles.infoText}>
              After adding the box, you can add products to it. Products added to a box will be deducted from your inventory.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SavingOverlay visible={isSaving} message="Adding Box..." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  closeBtn: {
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
  saveBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  saveBtnDisabled: {
    backgroundColor: theme.border,
  },
  saveBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  toggleBtnActive: {
    backgroundColor: theme.surface,
    ...shadows.card,
  },
  toggleText: {
    ...typography.body,
    color: theme.textSecondary,
  },
  toggleTextActive: {
    color: theme.textPrimary,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
  },
  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  manageLinkText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  emptyBoxTypes: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    color: theme.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  emptyAddBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  boxTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  boxTypeCard: {
    width: '47%',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  boxTypeCardActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primaryDark,
  },
  boxTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: `${theme.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  boxTypeIconActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  boxTypeName: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    textAlign: 'center',
  },
  boxTypeNameActive: {
    color: '#FFF',
  },
  boxTypeDimensions: {
    ...typography.small,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  boxTypeDimensionsActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  boxTypeWeight: {
    ...typography.small,
    color: theme.textMuted,
    marginTop: 2,
  },
  boxTypeWeightActive: {
    color: 'rgba(255,255,255,0.6)',
  },
  overrideHint: {
    ...typography.caption,
    color: theme.textSecondary,
    marginBottom: spacing.lg,
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
  row: {
    flexDirection: 'row',
  },
  cbmCard: {
    backgroundColor: theme.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  cbmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cbmLabel: {
    ...typography.body,
    color: theme.primaryDark,
  },
  cbmValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.primaryDark,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${theme.primary}10`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: theme.textSecondary,
    flex: 1,
  },
});
