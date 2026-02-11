import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, RefreshControl, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

export default function SuppliersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { suppliers, invoices, products, getInvoicesBySupplier, refreshData, checkSupplierLimit } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const supplierCheck = checkSupplierLimit();

  const filteredSuppliers = suppliers.filter(s => 
    searchQuery === '' || 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSupplierStats = (supplierId: string) => {
    const supplierInvoices = getInvoicesBySupplier(supplierId);
    const supplierProducts = supplierInvoices.flatMap(inv => 
      products.filter(p => p.invoiceId === inv.id)
    );
    const totalValue = supplierProducts.reduce((sum, p) => sum + (p.availableQuantity * p.rate), 0);
    return {
      invoiceCount: supplierInvoices.length,
      productCount: supplierProducts.length,
      totalValue,
    };
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

  const renderSupplier = ({ item }: { item: typeof suppliers[0] }) => {
    const stats = getSupplierStats(item.id);

    return (
      <Pressable 
        style={styles.supplierCard}
        onPress={() => router.push(`/supplier/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.flagContainer}>
            <Text style={styles.flag}>{getCountryFlag(item.country)}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.supplierName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.countryText}>{item.country}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
        </View>

        <View style={styles.contactRow}>
          <View style={styles.contactItem}>
            <MaterialIcons name="person" size={16} color={theme.textSecondary} />
            <Text style={styles.contactText} numberOfLines={1}>{item.contactPerson}</Text>
          </View>
          <View style={styles.contactItem}>
            <MaterialIcons name="email" size={16} color={theme.textSecondary} />
            <Text style={styles.contactText} numberOfLines={1}>{item.email}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.invoiceCount}</Text>
            <Text style={styles.statLabel}>Invoices</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.productCount}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.success }]}>
              ${(stats.totalValue/1000).toFixed(1)}k
            </Text>
            <Text style={styles.statLabel}>Value</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Suppliers</Text>
        <Pressable style={[styles.addBtn, !supplierCheck.allowed && { backgroundColor: theme.textMuted }]} onPress={() => {
          if (!supplierCheck.allowed) {
            Alert.alert('Supplier Limit', supplierCheck.message || 'Limit reached');
            return;
          }
          router.push('/add-supplier');
        }}>
          <MaterialIcons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{suppliers.length}</Text>
          <Text style={styles.summaryLabel}>Total Suppliers</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {[...new Set(suppliers.map(s => s.country))].length}
          </Text>
          <Text style={styles.summaryLabel}>Countries</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search suppliers..."
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

      {/* Suppliers List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredSuppliers}
          renderItem={renderSupplier}
          estimatedItemSize={180}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="business" size={48} color={theme.textMuted} />
              <Text style={styles.emptyText}>No suppliers found</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/add-supplier')}>
                <Text style={styles.emptyBtnText}>Add Supplier</Text>
              </Pressable>
            </View>
          }
        />
      </View>
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
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.cardValue,
    color: theme.primary,
  },
  summaryLabel: {
    ...typography.caption,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: theme.textPrimary,
  },
  listContainer: {
    flex: 1,
  },
  supplierCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  flagContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  flag: {
    fontSize: 24,
  },
  headerInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  countryText: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  contactRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactText: {
    ...typography.caption,
    color: theme.textSecondary,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.border,
  },
  statValue: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  statLabel: {
    ...typography.small,
    color: theme.textSecondary,
    marginTop: 2,
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
});
