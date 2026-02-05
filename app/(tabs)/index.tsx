import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { SHIPMENT_STATUS, getCurrencySymbol, formatCurrencyCompact } from '../../constants/config';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { suppliers, invoices, products, shipments, userSettings } = useApp();
  const currencySymbol = getCurrencySymbol(userSettings.currency);

  // Calculate total inventory value using average rate from all invoices
  const totalInventoryValue = products.reduce((sum, p) => {
    const avgRate = p.invoices && p.invoices.length > 0
      ? p.invoices.reduce((rateSum, inv) => rateSum + inv.rate, 0) / p.invoices.length
      : 0;
    return sum + (p.available_quantity * avgRate);
  }, 0);
  const totalInventoryItems = products.reduce((sum, p) => sum + p.available_quantity, 0);
  const activeShipments = shipments.length; // All shipments are considered active now
  const pendingInvoices = invoices.filter(i => i.payment_status === 'unpaid').length;

  const recentShipments = shipments.slice(0, 3);

  const lowStockProducts = products
    .filter(p => p.available_quantity < p.quantity * 0.3)
    .slice(0, 4);

  const getShipmentStatusText = (shipment: any) => {
    const boxCount = shipment.boxes?.length || 0;
    if (boxCount === 0) return 'Draft';
    return `${boxCount} Box${boxCount !== 1 ? 'es' : ''}`;
  };

  const getShipmentStatusColor = (shipment: any) => {
    const boxCount = shipment.boxes?.length || 0;
    if (boxCount === 0) return theme.textSecondary;
    return theme.success;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.title}>ExportPro</Text>
          </View>
          <Pressable style={styles.notificationBtn}>
            <MaterialIcons name="notifications-none" size={24} color={theme.textPrimary} />
          </Pressable>
        </View>

        {/* Hero Card - Inventory Value */}
        <View style={styles.heroCard}>
          <View style={styles.heroCardGradient}>
            <Text style={styles.heroLabel}>TOTAL INVENTORY VALUE</Text>
            <Text style={styles.heroValue}>{currencySymbol}{totalInventoryValue.toLocaleString()}</Text>
            <View style={styles.heroSubRow}>
              <MaterialIcons name="inventory-2" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroSubText}>{totalInventoryItems.toLocaleString()} items in stock</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <Pressable style={styles.statCard} onPress={() => router.push('/(tabs)/suppliers')}>
            <View style={[styles.statIcon, { backgroundColor: `${theme.supplier}15` }]}>
              <MaterialIcons name="business" size={20} color={theme.supplier} />
            </View>
            <Text style={styles.statValue}>{suppliers.length}</Text>
            <Text style={styles.statLabel}>Suppliers</Text>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/(tabs)/inventory')}>
            <View style={[styles.statIcon, { backgroundColor: `${theme.warning}15` }]}>
              <MaterialIcons name="receipt-long" size={20} color={theme.warning} />
            </View>
            <Text style={styles.statValue}>{pendingInvoices}</Text>
            <Text style={styles.statLabel}>Pending Invoices</Text>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/(tabs)/shipments')}>
            <View style={[styles.statIcon, { backgroundColor: `${theme.shipment}15` }]}>
              <MaterialIcons name="local-shipping" size={20} color={theme.shipment} />
            </View>
            <Text style={styles.statValue}>{activeShipments}</Text>
            <Text style={styles.statLabel}>Active Shipments</Text>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/(tabs)/inventory')}>
            <View style={[styles.statIcon, { backgroundColor: `${theme.inventory}15` }]}>
              <MaterialIcons name="category" size={20} color={theme.inventory} />
            </View>
            <Text style={styles.statValue}>{products.length}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </Pressable>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/add-supplier')}>
            <View style={[styles.actionIcon, { backgroundColor: theme.supplier }]}>
              <MaterialIcons name="person-add" size={20} color="#FFF" />
            </View>
            <Text style={styles.actionText}>Add Supplier</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/add-invoice')}>
            <View style={[styles.actionIcon, { backgroundColor: theme.warning }]}>
              <MaterialIcons name="add-circle" size={20} color="#FFF" />
            </View>
            <Text style={styles.actionText}>Add Invoice</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/add-shipment')}>
            <View style={[styles.actionIcon, { backgroundColor: theme.shipment }]}>
              <MaterialIcons name="add-box" size={20} color="#FFF" />
            </View>
            <Text style={styles.actionText}>New Shipment</Text>
          </Pressable>
        </View>

        {/* Active Shipments */}
        {recentShipments.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ACTIVE SHIPMENTS</Text>
              <Pressable onPress={() => router.push('/(tabs)/shipments')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            {recentShipments.map((shipment) => (
              <Pressable 
                key={shipment.id} 
                style={styles.shipmentCard}
                onPress={() => router.push(`/shipment/${shipment.id}`)}
              >
                <View style={styles.shipmentInfo}>
                  <Text style={styles.shipmentName}>{shipment.name}</Text>
                  <Text style={styles.shipmentDest}>{shipment.destination}</Text>
                </View>
                <View style={styles.shipmentRight}>
                  <View style={[styles.statusBadge, { backgroundColor: `${getShipmentStatusColor(shipment)}15` }]}>
                    <Text style={[styles.statusText, { color: getShipmentStatusColor(shipment) }]}>
                      {getShipmentStatusText(shipment).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.boxCount}>{shipment.boxes?.length || 0} boxes</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>LOW STOCK ALERT</Text>
              <MaterialIcons name="warning" size={18} color={theme.error} />
            </View>
            <View style={styles.lowStockCard}>
              {lowStockProducts.map((product) => (
                <View key={product.id} style={styles.lowStockItem}>
                  <View style={styles.lowStockInfo}>
                    <Text style={styles.lowStockName} numberOfLines={1}>{product.name}</Text>
                    <Text style={styles.lowStockHS}>HS: {product.hs_code}</Text>
                  </View>
                  <View style={styles.lowStockQty}>
                    <Text style={styles.lowStockValue}>{product.available_quantity}</Text>
                    <Text style={styles.lowStockTotal}>/ {product.quantity}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
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
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  greeting: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    ...shadows.cardElevated,
  },
  heroCardGradient: {
    backgroundColor: theme.primary,
    padding: spacing.xl,
  },
  heroLabel: {
    ...typography.heroLabel,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.xs,
  },
  heroValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: spacing.sm,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroSubText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.8)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    width: '47%',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.cardValue,
    color: theme.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
  },
  seeAll: {
    ...typography.body,
    color: theme.primary,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionText: {
    ...typography.small,
    color: theme.textPrimary,
    textAlign: 'center',
  },
  shipmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  shipmentInfo: {
    flex: 1,
  },
  shipmentName: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  shipmentDest: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  shipmentRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
  },
  boxCount: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  lowStockCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.errorLight,
    ...shadows.card,
  },
  lowStockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  lowStockInfo: {
    flex: 1,
  },
  lowStockName: {
    ...typography.body,
    color: theme.textPrimary,
  },
  lowStockHS: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  lowStockQty: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  lowStockValue: {
    ...typography.bodyBold,
    color: theme.error,
  },
  lowStockTotal: {
    ...typography.caption,
    color: theme.textSecondary,
  },
});
