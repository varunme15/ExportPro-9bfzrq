import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function AddShipmentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addShipment, customers } = useApp();

  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [lotNumber, setLotNumber] = useState('');

  const popularDestinations = [
    'New York, USA',
    'Los Angeles, USA',
    'London, UK',
    'Hamburg, Germany',
    'Sydney, Australia',
    'Toronto, Canada',
    'Tokyo, Japan',
    'Dubai, UAE',
  ];

  const handleSave = async () => {
    if (!name.trim() || !destination.trim()) {
      return;
    }

    await addShipment({
      name: name.trim(),
      destination: destination.trim(),
      customer_id: customerId || undefined,
      lot_number: lotNumber.trim() || undefined,
    });

    router.back();
  };

  // Auto-fill destination when customer is selected
  const handleCustomerSelect = (id: string) => {
    setCustomerId(id);
    const customer = customers.find(c => c.id === id);
    if (customer && !destination) {
      setDestination(`${customer.city}, ${customer.country}`);
    }
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
          <Text style={styles.headerTitle}>New Shipment</Text>
          <Pressable 
            style={[styles.saveBtn, (!name.trim() || !destination.trim()) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!name.trim() || !destination.trim()}
          >
            <Text style={styles.saveBtnText}>Create</Text>
          </Pressable>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Shipment Info */}
          <Text style={styles.sectionTitle}>SHIPMENT DETAILS</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shipment Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., US Summer Collection"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lot Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter lot number (optional)"
              placeholderTextColor={theme.textMuted}
              value={lotNumber}
              onChangeText={setLotNumber}
            />
          </View>

          {/* Customer Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer (Optional)</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.customerScroll}
            >
              <Pressable
                style={[styles.customerChip, customerId === '' && styles.customerChipActive]}
                onPress={() => setCustomerId('')}
              >
                <Text style={[styles.customerText, customerId === '' && styles.customerTextActive]}>
                  No Customer
                </Text>
              </Pressable>
              {customers.map(customer => (
                <Pressable
                  key={customer.id}
                  style={[styles.customerChip, customerId === customer.id && styles.customerChipActive]}
                  onPress={() => handleCustomerSelect(customer.id)}
                >
                  <MaterialIcons 
                    name="business" 
                    size={14} 
                    color={customerId === customer.id ? '#FFF' : theme.textSecondary} 
                  />
                  <Text style={[styles.customerText, customerId === customer.id && styles.customerTextActive]}>
                    {customer.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Destination *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter destination city"
              placeholderTextColor={theme.textMuted}
              value={destination}
              onChangeText={setDestination}
            />
          </View>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Popular Destinations</Text>
          <View style={styles.destGrid}>
            {popularDestinations.map(dest => (
              <Pressable
                key={dest}
                style={[styles.destChip, destination === dest && styles.destChipActive]}
                onPress={() => setDestination(dest)}
              >
                <MaterialIcons 
                  name="place" 
                  size={14} 
                  color={destination === dest ? '#FFF' : theme.textSecondary} 
                />
                <Text style={[styles.destText, destination === dest && styles.destTextActive]}>
                  {dest}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <MaterialIcons name="local-shipping" size={40} color={theme.primary} />
            <Text style={styles.infoTitle}>What's Next?</Text>
            <Text style={styles.infoText}>
              After creating the shipment, you can add boxes and pack products from your inventory. 
              Generate packing lists and commercial invoices when ready.
            </Text>
          </View>
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
  destGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  destChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: theme.backgroundSecondary,
    gap: spacing.xs,
  },
  destChipActive: {
    backgroundColor: theme.primary,
  },
  destText: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  destTextActive: {
    color: '#FFF',
  },
  customerScroll: {
    marginTop: spacing.xs,
  },
  customerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: theme.backgroundSecondary,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  customerChipActive: {
    backgroundColor: theme.primary,
  },
  customerText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  customerTextActive: {
    color: '#FFF',
  },
  infoCard: {
    backgroundColor: `${theme.primary}10`,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  infoTitle: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
