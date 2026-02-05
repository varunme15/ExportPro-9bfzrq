import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function AddSupplierScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addSupplier, checkSimilarSupplier } = useApp();

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [similarSupplier, setSimilarSupplier] = useState<any>(null);

  const countries = ['China', 'Vietnam', 'Bangladesh', 'India', 'Thailand', 'Indonesia', 'Pakistan', 'Cambodia'];

  const handleNameChange = (value: string) => {
    setName(value);
    if (value.trim().length > 2) {
      const similar = checkSimilarSupplier(value);
      if (similar) {
        setSimilarSupplier(similar);
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    } else {
      setShowWarning(false);
    }
  };

  const handleSave = () => {
    if (!name.trim() || !contactPerson.trim()) {
      return;
    }

    addSupplier({
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      country: country || 'China',
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
          <Text style={styles.headerTitle}>Add Supplier</Text>
          <Pressable 
            style={[styles.saveBtn, (!name.trim() || !contactPerson.trim()) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!name.trim() || !contactPerson.trim()}
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
          {/* Company Info */}
          <Text style={styles.sectionTitle}>COMPANY INFORMATION</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Company Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter company name"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={handleNameChange}
            />
            {showWarning && similarSupplier && (
              <View style={styles.warningBox}>
                <MaterialIcons name="warning" size={18} color={theme.warning} />
                <Text style={styles.warningText}>
                  Similar supplier exists: {similarSupplier.name}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.countryScroll}
            >
              {countries.map(c => (
                <Pressable
                  key={c}
                  style={[styles.countryChip, country === c && styles.countryChipActive]}
                  onPress={() => setCountry(c)}
                >
                  <Text style={[styles.countryChipText, country === c && styles.countryChipTextActive]}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Enter full address"
              placeholderTextColor={theme.textMuted}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Contact Info */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>CONTACT INFORMATION</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Person *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact name"
              placeholderTextColor={theme.textMuted}
              value={contactPerson}
              onChangeText={setContactPerson}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              placeholderTextColor={theme.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              placeholderTextColor={theme.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
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
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  countryScroll: {
    marginTop: spacing.xs,
  },
  countryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: theme.backgroundSecondary,
    marginRight: spacing.sm,
  },
  countryChipActive: {
    backgroundColor: theme.primary,
  },
  countryChipText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  countryChipTextActive: {
    color: '#FFF',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.warning}15`,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  warningText: {
    ...typography.small,
    color: theme.warning,
    flex: 1,
  },
});
