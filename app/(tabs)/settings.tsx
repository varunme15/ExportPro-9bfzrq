import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../template';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { CURRENCIES, COUNTRIES } from '../../constants/config';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const { userSettings, updateUserSettings, subscriptionStatus, planLimits, suppliers, products, shipments, invoices } = useApp();

  const [name, setName] = useState(userSettings.name);
  const [email, setEmail] = useState(userSettings.email);
  const [address, setAddress] = useState(userSettings.address);
  const [city, setCity] = useState(userSettings.city);
  const [state, setState] = useState(userSettings.state);
  const [country, setCountry] = useState(userSettings.country);
  const [currency, setCurrency] = useState(userSettings.currency);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field: string, value: string) => {
    setHasChanges(true);
    switch (field) {
      case 'name': setName(value); break;
      case 'email': setEmail(value); break;
      case 'address': setAddress(value); break;
      case 'city': setCity(value); break;
      case 'state': setState(value); break;
      case 'country': setCountry(value); break;
      case 'currency': setCurrency(value); break;
    }
  };

  const handleSave = () => {
    updateUserSettings({ name, email, address, city, state, country, currency });
    setHasChanges(false);
  };

  const isFree = subscriptionStatus === 'FREE';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          {hasChanges && (
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Subscription Status Card */}
          <View style={[styles.subscriptionCard, isFree ? styles.subscriptionFree : styles.subscriptionPaid]}>
            <View style={styles.subscriptionHeader}>
              <MaterialIcons name={isFree ? 'star-border' : 'star'} size={24} color={isFree ? theme.warning : '#FFF'} />
              <Text style={[styles.subscriptionTitle, isFree ? styles.subscriptionTitleFree : styles.subscriptionTitlePaid]}>
                {isFree ? 'Free Plan' : 'Pro Plan'}
              </Text>
            </View>
            {isFree ? (
              <View style={styles.limitsGrid}>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{suppliers.length}/{planLimits.maxSuppliers}</Text>
                  <Text style={styles.limitLabel}>Suppliers</Text>
                </View>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{products.length}/{planLimits.maxProducts}</Text>
                  <Text style={styles.limitLabel}>Products</Text>
                </View>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>
                    {planLimits.maxInvoicesPerMonth}/mo
                  </Text>
                  <Text style={styles.limitLabel}>Invoices</Text>
                </View>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>
                    {planLimits.maxShipmentsPerMonth}/mo
                  </Text>
                  <Text style={styles.limitLabel}>Shipments</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.paidDesc}>Unlimited resources and all features unlocked.</Text>
            )}
          </View>

          {/* Quick Links */}
          <Text style={styles.sectionTitle}>TOOLS</Text>
          <Pressable style={styles.linkCard} onPress={() => router.push('/standard-boxes')}>
            <View style={[styles.linkIcon, { backgroundColor: `${theme.primary}15` }]}>
              <MaterialIcons name="inbox" size={20} color={theme.primary} />
            </View>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>Standard Boxes</Text>
              <Text style={styles.linkDesc}>Manage reusable box type definitions</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
          </Pressable>

          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>COMPANY INFORMATION</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Company Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter company name"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={val => handleChange('name', val)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="company@example.com"
              placeholderTextColor={theme.textMuted}
              value={email}
              onChangeText={val => handleChange('email', val)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>ADDRESS</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Street Address</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Enter address"
              placeholderTextColor={theme.textMuted}
              value={address}
              onChangeText={val => handleChange('address', val)}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="City"
                placeholderTextColor={theme.textMuted}
                value={city}
                onChangeText={val => handleChange('city', val)}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
              <Text style={styles.label}>State/Province</Text>
              <TextInput
                style={styles.input}
                placeholder="State"
                placeholderTextColor={theme.textMuted}
                value={state}
                onChangeText={val => handleChange('state', val)}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {COUNTRIES.map(c => (
                <Pressable
                  key={c}
                  style={[styles.chip, country === c && styles.chipActive]}
                  onPress={() => handleChange('country', c)}
                >
                  <Text style={[styles.chipText, country === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>PREFERENCES</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Default Currency</Text>
            <View style={styles.currencyGrid}>
              {CURRENCIES.map(c => (
                <Pressable
                  key={c}
                  style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
                  onPress={() => handleChange('currency', c)}
                >
                  <Text style={[styles.currencyText, currency === c && styles.currencyTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {hasChanges && (
            <Pressable style={styles.saveFullBtn} onPress={handleSave}>
              <MaterialIcons name="check-circle" size={20} color="#FFF" />
              <Text style={styles.saveFullBtnText}>Save Settings</Text>
            </Pressable>
          )}

          {/* Logout */}
          <Pressable style={styles.logoutBtn} onPress={() => logout()}>
            <MaterialIcons name="logout" size={20} color={theme.error} />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: theme.backgroundSecondary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  saveBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  saveBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  // Subscription card
  subscriptionCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  subscriptionFree: {
    backgroundColor: `${theme.warning}15`,
    borderWidth: 1,
    borderColor: `${theme.warning}30`,
  },
  subscriptionPaid: {
    backgroundColor: theme.primary,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  subscriptionTitleFree: {
    color: theme.textPrimary,
  },
  subscriptionTitlePaid: {
    color: '#FFF',
  },
  limitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  limitItem: {
    width: '46%',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  limitValue: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  limitLabel: {
    ...typography.small,
    color: theme.textSecondary,
  },
  paidDesc: {
    ...typography.body,
    color: 'rgba(255,255,255,0.9)',
  },
  // Link cards
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  linkDesc: {
    ...typography.caption,
    color: theme.textSecondary,
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
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: theme.textPrimary,
    ...shadows.card,
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  chipScroll: {
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: theme.surface,
    marginRight: spacing.sm,
    ...shadows.card,
  },
  chipActive: {
    backgroundColor: theme.primary,
  },
  chipText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFF',
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  currencyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: theme.surface,
    ...shadows.card,
  },
  currencyChipActive: {
    backgroundColor: theme.primary,
  },
  currencyText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  currencyTextActive: {
    color: '#FFF',
  },
  saveFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  saveFullBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.error}10`,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: `${theme.error}30`,
  },
  logoutBtnText: {
    ...typography.bodyBold,
    color: theme.error,
  },
});
