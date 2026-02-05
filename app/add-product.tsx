import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { COMMON_HS_CODES } from '../constants/config';

export default function AddProductScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addProduct } = useApp();

  const invoiceId = params.invoiceId as string;

  const [name, setName] = useState('');
  const [hsCode, setHsCode] = useState('');
  const [alternateNames, setAlternateNames] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [unit, setUnit] = useState('pcs');

  const units = ['pcs', 'pairs', 'sets', 'kg', 'meters', 'cartons'];

  const handleSave = () => {
    if (!name.trim() || !hsCode.trim() || !quantity || !rate) {
      return;
    }

    const qty = parseInt(quantity);
    
    addProduct({
      invoiceId,
      name: name.trim(),
      hsCode: hsCode.trim(),
      alternateNames: alternateNames.split(',').map(n => n.trim()).filter(n => n),
      quantity: qty,
      availableQuantity: qty,
      rate: parseFloat(rate),
      unit,
    });

    router.back();
  };

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
          <Text style={styles.headerTitle}>Add Product</Text>
          <Pressable 
            style={[styles.saveBtn, (!name.trim() || !hsCode.trim() || !quantity || !rate) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!name.trim() || !hsCode.trim() || !quantity || !rate}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Product Info */}
          <Text style={styles.sectionTitle}>PRODUCT INFORMATION</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter product name"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>HS Code *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter HS code"
              placeholderTextColor={theme.textMuted}
              value={hsCode}
              onChangeText={setHsCode}
              keyboardType="number-pad"
            />
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.hsCodeScroll}
            >
              {COMMON_HS_CODES.map(hs => (
                <Pressable
                  key={hs.code}
                  style={[styles.hsCodeChip, hsCode === hs.code && styles.hsCodeChipActive]}
                  onPress={() => setHsCode(hs.code)}
                >
                  <Text style={[styles.hsCodeText, hsCode === hs.code && styles.hsCodeTextActive]}>
                    {hs.code}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Alternate Names</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter alternate names (comma separated)"
              placeholderTextColor={theme.textMuted}
              value={alternateNames}
              onChangeText={setAlternateNames}
            />
            <Text style={styles.hint}>e.g., White Tee, Basic Cotton T</Text>
          </View>

          {/* Quantity & Pricing */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>QUANTITY & PRICING</Text>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
              <Text style={styles.label}>Rate (USD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
                value={rate}
                onChangeText={setRate}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unit</Text>
            <View style={styles.unitGrid}>
              {units.map(u => (
                <Pressable
                  key={u}
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>
                    {u}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Summary */}
          {quantity && rate && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Value</Text>
              <Text style={styles.summaryValue}>
                ${(parseInt(quantity) * parseFloat(rate)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.summarySubtext}>
                {quantity} {unit} × ${parseFloat(rate).toFixed(2)}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
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
  hint: {
    ...typography.small,
    color: theme.textMuted,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
  },
  hsCodeScroll: {
    marginTop: spacing.sm,
  },
  hsCodeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: theme.backgroundSecondary,
    marginRight: spacing.sm,
  },
  hsCodeChipActive: {
    backgroundColor: theme.primary,
  },
  hsCodeText: {
    ...typography.small,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  hsCodeTextActive: {
    color: '#FFF',
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  unitChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: theme.backgroundSecondary,
  },
  unitChipActive: {
    backgroundColor: theme.primary,
  },
  unitText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  unitTextActive: {
    color: '#FFF',
  },
  summaryCard: {
    backgroundColor: theme.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  summaryLabel: {
    ...typography.small,
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.success,
    marginVertical: spacing.xs,
  },
  summarySubtext: {
    ...typography.caption,
    color: theme.textSecondary,
  },
});
