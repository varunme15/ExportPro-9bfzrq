import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getCurrencySymbol, formatCurrencyCompact } from '../../constants/config';

export default function SupplierDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { suppliers, invoices, products, deleteSupplier, getInvoicesBySupplier, userSettings } = useApp();
  const currencySymbol = getCurrencySymbol(userSettings.currency);

  const supplier = suppliers.find(s => s.id === id);
  
  if (!supplier) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Supplier not found</Text>
      </SafeAreaView>
    );
  }

  const supplierInvoices = getInvoicesBySupplier(supplier.id);
  
  // Get all products from this supplier's invoices
  const supplierProducts = products.filter(p => 
    p.invoices && p.invoices.some(pi => 
      supplierInvoices.some(inv => inv.id === pi.invoice_id)
    )
  );
  
  // Calculate total value using average rate from product invoices
  const totalValue = supplierProducts.reduce((sum, p) => {
    const avgRate = p.invoices && p.invoices.length > 0
      ? p.invoices.reduce((rateSum, inv) => rateSum + inv.rate, 0) / p.invoices.length
      : 0;
    return sum + (p.available_quantity * avgRate);
  }, 0);

  const handleCall = () => {
    if (supplier.phone) {
      Linking.openURL(`tel:${supplier.phone}`);
    }
  };

  const handleEmail = () => {
    if (supplier.email) {
      Linking.openURL(`mailto:${supplier.email}`);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Supplier',
      `Are you sure you want to delete ${supplier.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteSupplier(supplier.id);
            router.back();
          }
        },
      ]
    );
  };

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'China': '🇨🇳',
      'Vietnam': '🇻🇳',
      'Bangladesh': '🇧🇩',
      'India': '🇮🇳',
      'Thailand': '🇹🇭',
      'Indonesia': '🇮🇩',
    };
    return flags[country] || '🌐';
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Supplier Details</Text>
        <Pressable style={styles.menuBtn} onPress={handleDelete}>
          <MaterialIcons name="delete-outline" size={24} color={theme.error} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.flagContainer}>
            <Text style={styles.flag}>{getCountryFlag(supplier.country)}</Text>
          </View>
          <Text style={styles.supplierName}>{supplier.name}</Text>
          <Text style={styles.supplierCountry}>{supplier.country}</Text>
          
          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{supplierInvoices.length}</Text>
              <Text style={styles.heroStatLabel}>Invoices</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{supplierProducts.length}</Text>
              <Text style={styles.heroStatLabel}>Products</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={[styles.heroStatValue, { color: theme.success }]}>
                {formatCurrencyCompact(totalValue, userSettings.currency)}
              </Text>
              <Text style={styles.heroStatLabel}>Value</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={handleCall}>
            <View style={[styles.actionIcon, { backgroundColor: theme.success }]}>
              <MaterialIcons name="phone" size={20} color="#FFF" />
            </View>
            <Text style={styles.actionText}>Call</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={handleEmail}>
            <View style={[styles.actionIcon, { backgroundColor: theme.primary }]}>
              <MaterialIcons name="email" size={20} color="#FFF" />
            </View>
            <Text style={styles.actionText}>Email</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/add-invoice')}>
            <View style={[styles.actionIcon, { backgroundColor: theme.warning }]}>
              <MaterialIcons name="add-circle" size={20} color="#FFF" />
            </View>
            <Text style={styles.actionText}>Invoice</Text>
          </Pressable>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialIcons name="person" size={20} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Contact Person</Text>
                <Text style={styles.infoValue}>{supplier.contact}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="email" size={20} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{supplier.email || 'Not provided'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={20} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{supplier.phone || 'Not provided'}</Text>
              </View>
            </View>

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <MaterialIcons name="place" size={20} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{supplier.address || 'Not provided'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Invoices */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT INVOICES</Text>
            {supplierInvoices.length > 0 && (
              <Text style={styles.viewAll}>View All</Text>
            )}
          </View>

          {supplierInvoices.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons name="receipt-long" size={32} color={theme.textMuted} />
              <Text style={styles.emptyText}>No invoices yet</Text>
              <Pressable style={styles.addInvoiceBtn} onPress={() => router.push('/add-invoice')}>
                <MaterialIcons name="add" size={18} color="#FFF" />
                <Text style={styles.addInvoiceBtnText}>Add Invoice</Text>
              </Pressable>
            </View>
          ) : (
            supplierInvoices.slice(0, 3).map(invoice => (
              <Pressable 
                key={invoice.id} 
                style={styles.invoiceCard}
                onPress={() => router.push(`/invoice/${invoice.id}`)}
              >
                <View style={styles.invoiceIcon}>
                  <MaterialIcons name="receipt" size={20} color={theme.warning} />
                </View>
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceNumber}>#{invoice.invoiceNumber}</Text>
                  <Text style={styles.invoiceDate}>{invoice.date}</Text>
                </View>
                <View style={styles.invoiceRight}>
                  <Text style={styles.invoiceAmount}>
                    {currencySymbol}{(invoice.amount || 0).toLocaleString()}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: invoice.payment_status === 'paid' ? theme.successLight : theme.warningLight }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: invoice.payment_status === 'paid' ? theme.success : theme.warning }
                    ]}>
                      {invoice.payment_status}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
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
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: theme.backgroundSecondary,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  flagContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  flag: {
    fontSize: 32,
  },
  supplierName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  supplierCountry: {
    ...typography.body,
    color: theme.textSecondary,
    marginBottom: spacing.lg,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.border,
  },
  heroStatValue: {
    ...typography.cardValue,
    color: theme.textPrimary,
  },
  heroStatLabel: {
    ...typography.small,
    color: theme.textSecondary,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.card,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionText: {
    ...typography.small,
    color: theme.textPrimary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
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
  viewAll: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoLabel: {
    ...typography.small,
    color: theme.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: theme.textPrimary,
    marginTop: 2,
  },
  emptyCard: {
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
  addInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  addInvoiceBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  invoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  invoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: theme.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  invoiceNumber: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  invoiceDate: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
