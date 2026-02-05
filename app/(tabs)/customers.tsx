import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

export default function CustomersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { customers, getShipmentsByCustomer, getInvoicesByCustomer } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderCustomer = ({ item }: { item: typeof customers[0] }) => {
    const shipments = getShipmentsByCustomer(item.id);
    const invoices = getInvoicesByCustomer(item.id);
    const totalValue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    return (
      <Pressable 
        style={styles.customerCard}
        onPress={() => router.push(`/customer/${item.id}`)}
      >
        <View style={styles.customerHeader}>
          <View style={styles.customerIcon}>
            <MaterialIcons name="business" size={24} color={theme.primary} />
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{item.name}</Text>
            <View style={styles.locationRow}>
              <MaterialIcons name="place" size={14} color={theme.textSecondary} />
              <Text style={styles.locationText}>{item.city}, {item.country}</Text>
            </View>
          </View>
        </View>

        <View style={styles.customerStats}>
          <View style={styles.statItem}>
            <MaterialIcons name="local-shipping" size={18} color={theme.shipment} />
            <Text style={styles.statValue}>{shipments.length}</Text>
            <Text style={styles.statLabel}>Shipments</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialIcons name="receipt" size={18} color={theme.inventory} />
            <Text style={styles.statValue}>{invoices.length}</Text>
            <Text style={styles.statLabel}>Invoices</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialIcons name="attach-money" size={18} color={theme.success} />
            <Text style={styles.statValue}>${(totalValue / 1000).toFixed(1)}k</Text>
            <Text style={styles.statLabel}>Total Value</Text>
          </View>
        </View>

        <View style={styles.customerFooter}>
          <View style={styles.contactInfo}>
            <MaterialIcons name="email" size={14} color={theme.textMuted} />
            <Text style={styles.contactText}>{item.email}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/add-customer')}>
          <MaterialIcons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customers..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={20} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Customer List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredCustomers}
          renderItem={renderCustomer}
          estimatedItemSize={180}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="people-outline" size={48} color={theme.textMuted} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No customers found' : 'No customers yet'}
              </Text>
              {!searchQuery && (
                <Pressable style={styles.emptyBtn} onPress={() => router.push('/add-customer')}>
                  <Text style={styles.emptyBtnText}>Add Customer</Text>
                </Pressable>
              )}
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    ...typography.body,
    color: theme.textPrimary,
  },
  listContainer: {
    flex: 1,
  },
  customerCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  customerHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  customerIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationText: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  customerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
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
    marginTop: spacing.xs,
  },
  statLabel: {
    ...typography.small,
    color: theme.textSecondary,
  },
  customerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  contactText: {
    ...typography.caption,
    color: theme.textSecondary,
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
