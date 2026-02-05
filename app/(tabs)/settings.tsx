import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { CURRENCIES, COUNTRIES } from '../../constants/config';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { userSettings, updateUserSettings } = useApp();

  const [name, setName] = useState(userSettings.name);
  const [email, setEmail] = useState(userSettings.email);
  const [phone, setPhone] = useState(userSettings.phone);
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
      case 'phone': setPhone(value); break;
      case 'address': setAddress(value); break;
      case 'city': setCity(value); break;
      case 'state': setState(value); break;
      case 'country': setCountry(value); break;
      case 'currency': setCurrency(value); break;
    }
  };

  const handleSave = () => {
    updateUserSettings({ name, email, phone, address, city, state, country, currency });
    setHasChanges(false);
  };

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
          <Text style={styles.sectionTitle}>COMPANY INFORMATION</Text>
          
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 000 000 0000"
              placeholderTextColor={theme.textMuted}
              value={phone}
              onChangeText={val => handleChange('phone', val)}
              keyboardType="phone-pad"
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
});
