import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { products, invoices, getSupplierById } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHSCode, setFilterHSCode] = useState<string | null>(null);

  // Get unique HS codes
  const hsCodes = [...new Set(products.map(p => p.hs_code))].sort();

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = searchQuery === '' || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.hs_code.includes(searchQuery) ||
      (p.alternate_names || []).some(n => n.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesHS = !filterHSCode || p.hs_code === filterHSCode;
    return matchesSearch && matchesHS;
  });

  // Calculate stats
  const totalValue = products.reduce((sum, p) => {
    // Calculate average rate from all invoices
    const avgRate = p.invoices && p.invoices.length > 0
      ? p.invoices.reduce((rateSum, inv) => rateSum + inv.rate, 0) / p.invoices.length
      : 0;
    return sum + (p.availableQuantity * avgRate);
  }, 0);
  const totalItems = products.reduce((sum, p) => sum + p.availableQuantity, 0);

  const getProductInvoices = (item: typeof products[0]) => {
    if (!item.invoices || item.invoices.length === 0) {
      return { count: 0, suppliers: [], avgRate: 0 };
    }
    
    // Get unique suppliers from invoices
    const supplierNames = new Set<string>();
    item.invoices.forEach(pi => {
      const invoice = invoices.find(i => i.id === pi.invoice_id);
      if (invoice) {
        const supplier = getSupplierById(invoice.supplier_id);
        if (supplier) supplierNames.add(supplier.name);
      }
    });
    
    const avgRate = item.invoices.reduce((sum, inv) => sum + inv.rate, 0) / item.invoices.length;
    
    return {
      count: item.invoices.length,
      suppliers: Array.from(supplierNames),
      avgRate,
    };
  };

  const renderProduct = ({ item }: { item: typeof products[0] }) => {
    const { count, suppliers, avgRate } = getProductInvoices(item);
    const stockPercentage = (item.availableQuantity / item.quantity) * 100;
    const stockColor = stockPercentage < 30 ? theme.error : stockPercentage < 60 ? theme.warning : theme.success;

    return (
      <Pressable style={styles.productCard}>
        <View style={styles.productHeader}>
          <View style={styles.hsCodeBadge}>
            <Text style={styles.hsCodeText}>{item.hs_code}</Text>
          </View>
          <Text style={styles.productRate}>${avgRate.toFixed(2)}/{item.unit}</Text>
        </View>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        {item.alternate_names && item.alternate_names.length > 0 && (
          <Text style={styles.altNames} numberOfLines={1}>
            Also: {item.alternate_names.join(', ')}
          </Text>
        )}
        <View style={styles.productMeta}>
          <Text style={styles.supplierText} numberOfLines={1}>
            {suppliers.length > 0 ? suppliers.join(', ') : 'No supplier'}
          </Text>
          <Text style={styles.invoiceText}>
            {count} {count === 1 ? 'invoice' : 'invoices'}
          </Text>
        </View>
        <View style={styles.stockRow}>
          <View style={styles.stockBar}>
            <View 
              style={[
                styles.stockFill, 
                { width: `${stockPercentage}%`, backgroundColor: stockColor }
              ]} 
            />
          </View>
          <Text style={[styles.stockText, { color: stockColor }]}>
            {item.available_quantity} / {item.quantity}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/add-invoice')}>
          <MaterialIcons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.primaryLight }]}>
          <MaterialIcons name="inventory-2" size={20} color={theme.primaryDark} />
          <Text style={styles.summaryValue}>{totalItems.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Items</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.successLight }]}>
          <MaterialIcons name="attach-money" size={20} color={theme.success} />
          <Text style={styles.summaryValue}>${(totalValue/1000).toFixed(1)}k</Text>
          <Text style={styles.summaryLabel}>Value</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.warningLight }]}>
          <MaterialIcons name="category" size={20} color={theme.warning} />
          <Text style={styles.summaryValue}>{hsCodes.length}</Text>
          <Text style={styles.summaryLabel}>HS Codes</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products, HS codes..."
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

      {/* HS Code Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        <Pressable
          style={[styles.filterChip, !filterHSCode && styles.filterChipActive]}
          onPress={() => setFilterHSCode(null)}
        >
          <Text style={[styles.filterText, !filterHSCode && styles.filterTextActive]}>All</Text>
        </Pressable>
        {hsCodes.map(code => (
          <Pressable
            key={code}
            style={[styles.filterChip, filterHSCode === code && styles.filterChipActive]}
            onPress={() => setFilterHSCode(filterHSCode === code ? null : code)}
          >
            <Text style={[styles.filterText, filterHSCode === code && styles.filterTextActive]}>
              {code}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Products List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredProducts}
          renderItem={renderProduct}
          estimatedItemSize={170}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory" size={48} color={theme.textMuted} />
              <Text style={styles.emptyText}>No products found</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/add-invoice')}>
                <Text style={styles.emptyBtnText}>Add Invoice</Text>
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
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.cardValue,
    color: theme.textPrimary,
    marginTop: spacing.xs,
  },
  summaryLabel: {
    ...typography.small,
    color: theme.textSecondary,
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
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: theme.textPrimary,
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: spacing.md,
  },
  filterContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: theme.backgroundSecondary,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: theme.primary,
  },
  filterText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContainer: {
    flex: 1,
  },
  productCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    ...shadows.card,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  hsCodeBadge: {
    backgroundColor: `${theme.primary}15`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  hsCodeText: {
    ...typography.small,
    color: theme.primary,
    fontWeight: '600',
  },
  productRate: {
    ...typography.small,
    color: theme.textSecondary,
  },
  productName: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    marginBottom: spacing.xs,
    minHeight: 40,
  },
  altNames: {
    ...typography.small,
    color: theme.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  productMeta: {
    marginBottom: spacing.sm,
  },
  supplierText: {
    ...typography.small,
    color: theme.textSecondary,
  },
  invoiceText: {
    ...typography.small,
    color: theme.textMuted,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stockBar: {
    flex: 1,
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stockFill: {
    height: '100%',
    borderRadius: 3,
  },
  stockText: {
    ...typography.small,
    fontWeight: '600',
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
