import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { SHIPMENT_STATUS, PAYMENT_STATUS } from '../../constants/config';

export default function CustomerDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { customers, getCustomerById, getShipmentsByCustomer, getInvoicesByCustomer } = useApp();

  const customer = getCustomerById(id as string);
  const shipments = getShipmentsByCustomer(id as string);
  const invoices = getInvoicesByCustomer(id as string);

  if (!customer) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Customer not found</Text>
      </SafeAreaView>
    );
  }

  const totalValue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const paidAmount = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const unpaidInvoices = invoices.filter(inv => (inv.paymentStatus || PAYMENT_STATUS.UNPAID) !== PAYMENT_STATUS.PAID);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Customer Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.customerIcon}>
            <MaterialIcons name="business" size={32} color={theme.primary} />
          </View>
          <Text style={styles.customerName}>{customer.name}</Text>
          
          <View style={styles.contactRow}>
            <MaterialIcons name="email" size={16} color={theme.textSecondary} />
            <Text style={styles.contactText}>{customer.email}</Text>
          </View>
          {customer.phone && (
            <View style={styles.contactRow}>
              <MaterialIcons name="phone" size={16} color={theme.textSecondary} />
              <Text style={styles.contactText}>{customer.phone}</Text>
            </View>
          )}
          <View style={styles.contactRow}>
            <MaterialIcons name="place" size={16} color={theme.textSecondary} />
            <Text style={styles.contactText}>
              {[customer.city, customer.state, customer.country].filter(Boolean).join(', ')}
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="local-shipping" size={24} color={theme.shipment} />
            <Text style={styles.statValue}>{shipments.length}</Text>
            <Text style={styles.statLabel}>Shipments</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="receipt" size={24} color={theme.inventory} />
            <Text style={styles.statValue}>{invoices.length}</Text>
            <Text style={styles.statLabel}>Invoices</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="attach-money" size={24} color={theme.success} />
            <Text style={styles.statValue}>${(totalValue / 1000).toFixed(1)}k</Text>
            <Text style={styles.statLabel}>Total Value</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="money-off" size={24} color={theme.error} />
            <Text style={styles.statValue}>{unpaidInvoices.length}</Text>
            <Text style={styles.statLabel}>Unpaid</Text>
          </View>
        </View>

        {/* Shipments Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SHIPMENTS ({shipments.length})</Text>
          {shipments.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No shipments yet</Text>
            </View>
          ) : (
            shipments.map(shipment => (
              <Pressable 
                key={shipment.id} 
                style={styles.shipmentCard}
                onPress={() => router.push(`/shipment/${shipment.id}`)}
              >
                <View style={styles.shipmentHeader}>
                  <View>
                    <Text style={styles.shipmentName}>{shipment.name}</Text>
                    <Text style={styles.shipmentDate}>{shipment.createdAt}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${theme.primary}15` }]}>
                    <Text style={[styles.statusText, { color: theme.primary }]}>
                      {shipment.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.shipmentFooter}>
                  <View style={styles.destInfo}>
                    <MaterialIcons name="place" size={14} color={theme.textMuted} />
                    <Text style={styles.destText}>{shipment.destination}</Text>
                  </View>
                  <Text style={styles.boxCount}>{shipment.boxes.length} boxes</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* Invoices Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INVOICES ({invoices.length})</Text>
          {invoices.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No invoices yet</Text>
            </View>
          ) : (
            invoices.map(invoice => {
              const paymentStatus = invoice.paymentStatus || PAYMENT_STATUS.UNPAID;
              const statusColor = paymentStatus === PAYMENT_STATUS.PAID ? theme.success : 
                                  paymentStatus === PAYMENT_STATUS.PARTIAL ? theme.warning : theme.error;
              return (
                <Pressable 
                  key={invoice.id} 
                  style={styles.invoiceCard}
                  onPress={() => router.push(`/invoice/${invoice.id}`)}
                >
                  <View style={styles.invoiceHeader}>
                    <View>
                      <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                      <Text style={styles.invoiceDate}>{invoice.date}</Text>
                    </View>
                    <View style={styles.invoiceRight}>
                      <Text style={styles.invoiceAmount}>
                        ${invoice.totalAmount.toLocaleString()}
                      </Text>
                      <View style={[styles.paymentBadge, { backgroundColor: `${statusColor}15` }]}>
                        <Text style={[styles.paymentText, { color: statusColor }]}>
                          {paymentStatus.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {invoice.paidAmount && invoice.paidAmount > 0 && (
                    <View style={styles.paymentProgress}>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { width: `${(invoice.paidAmount / invoice.totalAmount) * 100}%`, backgroundColor: statusColor }
                          ]} 
                        />
                      </View>
                      <Text style={styles.progressText}>
                        ${invoice.paidAmount.toLocaleString()} paid
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
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
    paddingVertical: spacing.md,
    backgroundColor: theme.background,
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
  infoCard: {
    backgroundColor: theme.surface,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  customerIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: spacing.lg,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  contactText: {
    ...typography.body,
    color: theme.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    width: '47%',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },
  statValue: {
    ...typography.cardValue,
    color: theme.textPrimary,
    marginTop: spacing.sm,
  },
  statLabel: {
    ...typography.small,
    color: theme.textSecondary,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
  },
  emptySection: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  emptyText: {
    ...typography.body,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  shipmentCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  shipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  shipmentName: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  shipmentDate: {
    ...typography.small,
    color: theme.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
  },
  shipmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  destInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  destText: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  boxCount: {
    ...typography.caption,
    color: theme.textMuted,
  },
  invoiceCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceNumber: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  invoiceDate: {
    ...typography.small,
    color: theme.textSecondary,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  paymentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  paymentText: {
    ...typography.small,
    fontWeight: '600',
  },
  paymentProgress: {
    marginTop: spacing.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.borderLight,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  progressText: {
    ...typography.small,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
});
