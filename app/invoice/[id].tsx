import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getCurrencySymbol } from '../../constants/config';

export default function InvoiceDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { invoices, products, getSupplierById, deleteInvoice, updateInvoice, userSettings } = useApp();
  const currencySymbol = getCurrencySymbol(userSettings.currency);

  const invoice = invoices.find(i => i.id === id);
  
  if (!invoice) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Invoice not found</Text>
      </SafeAreaView>
    );
  }

  const supplier = getSupplierById(invoice.supplier_id);
  const invoiceProducts = products.filter(p => 
    p.invoices && p.invoices.some(pi => pi.invoice_id === invoice.id)
  );
  
  // Calculate total value using invoice-specific rates
  const totalValue = invoiceProducts.reduce((sum, p) => {
    const invoiceLink = p.invoices?.find(pi => pi.invoice_id === invoice.id);
    const quantity = invoiceLink?.quantity || 0;
    const rate = invoiceLink?.rate || 0;
    return sum + (quantity * rate);
  }, 0);

  const handleMarkProcessed = () => {
    updateInvoice(invoice.id, { payment_status: 'paid' });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Invoice',
      `Are you sure you want to delete invoice #${invoice.invoice_number}? All products will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteInvoice(invoice.id);
            router.back();
          }
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: typeof products[0] }) => {
    const stockPercentage = (item.available_quantity / item.quantity) * 100;
    const stockColor = stockPercentage < 30 ? theme.error : stockPercentage < 60 ? theme.warning : theme.success;
    
    // Get invoice-specific quantity and rate
    const invoiceLink = item.invoices?.find(pi => pi.invoice_id === invoice.id);
    const invoiceQuantity = invoiceLink?.quantity || 0;
    const invoiceRate = invoiceLink?.rate || 0;
    const itemValue = invoiceQuantity * invoiceRate;

    return (
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <View style={styles.hsCodeBadge}>
            <Text style={styles.hsCodeText}>{item.hs_code}</Text>
          </View>
          <Text style={styles.productValue}>
            {currencySymbol}{itemValue.toLocaleString()}
          </Text>
        </View>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        {item.alternate_names && item.alternate_names.length > 0 && (
          <Text style={styles.altNames} numberOfLines={1}>
            Also: {item.alternate_names.join(', ')}
          </Text>
        )}
        <View style={styles.productStats}>
          <Text style={styles.productQty}>
            {invoiceQuantity} {item.unit} × {currencySymbol}{invoiceRate.toFixed(2)}
          </Text>
          <View style={styles.stockIndicator}>
            <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
            <Text style={[styles.stockText, { color: stockColor }]}>
              {item.available_quantity} avail
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Invoice Details</Text>
        <Pressable style={styles.menuBtn} onPress={handleDelete}>
          <MaterialIcons name="delete-outline" size={24} color={theme.error} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice Info Card */}
        <View style={styles.invoiceCard}>
          <View style={styles.invoiceHeader}>
            <View>
              <Text style={styles.invoiceLabel}>Invoice Number</Text>
              <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
            </View>
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

          <View style={styles.invoiceRow}>
            <View style={styles.invoiceRowItem}>
              <MaterialIcons name="business" size={18} color={theme.textSecondary} />
              <Text style={styles.invoiceRowText}>{supplier?.name || 'Unknown'}</Text>
            </View>
            <View style={styles.invoiceRowItem}>
              <MaterialIcons name="calendar-today" size={18} color={theme.textSecondary} />
              <Text style={styles.invoiceRowText}>{invoice.date}</Text>
            </View>
          </View>

          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>
              {currencySymbol}{(invoice.amount || 0).toLocaleString()}
            </Text>
          </View>

          {invoice.payment_status === 'unpaid' && (
            <Pressable style={styles.markProcessedBtn} onPress={handleMarkProcessed}>
              <MaterialIcons name="check-circle" size={18} color="#FFF" />
              <Text style={styles.markProcessedText}>Mark as Paid</Text>
            </Pressable>
          )}
        </View>

        {/* Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PRODUCTS ({invoiceProducts.length})</Text>
            <Pressable 
              style={styles.addProductBtn}
              onPress={() => router.push(`/add-product?invoiceId=${invoice.id}`)}
            >
              <MaterialIcons name="add" size={18} color={theme.primary} />
              <Text style={styles.addProductText}>Add</Text>
            </Pressable>
          </View>

          {invoiceProducts.length === 0 ? (
            <View style={styles.emptyProducts}>
              <MaterialIcons name="inventory" size={40} color={theme.textMuted} />
              <Text style={styles.emptyText}>No products added yet</Text>
              <Pressable 
                style={styles.emptyAddBtn}
                onPress={() => router.push(`/add-product?invoiceId=${invoice.id}`)}
              >
                <MaterialIcons name="add" size={18} color="#FFF" />
                <Text style={styles.emptyAddBtnText}>Add Product</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.productsList}>
              {invoiceProducts.map(product => (
                <View key={product.id}>
                  {renderProduct({ item: product })}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Summary Card */}
        {invoiceProducts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SUMMARY</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Products</Text>
                <Text style={styles.summaryValue}>{invoiceProducts.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Quantity</Text>
                <Text style={styles.summaryValue}>
                  {invoiceProducts.reduce((sum, p) => {
                    const invoiceLink = p.invoices?.find(pi => pi.invoice_id === invoice.id);
                    return sum + (invoiceLink?.quantity || 0);
                  }, 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Calculated Value</Text>
                <Text style={[styles.summaryValue, { color: theme.success }]}>
                  {currencySymbol}{totalValue.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        )}
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
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceCard: {
    backgroundColor: theme.surface,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  invoiceLabel: {
    ...typography.small,
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  invoiceNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    marginBottom: spacing.lg,
  },
  invoiceRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  invoiceRowText: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  totalSection: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  totalLabel: {
    ...typography.small,
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.primary,
    marginTop: spacing.xs,
  },
  markProcessedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  markProcessedText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
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
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addProductText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  emptyProducts: {
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
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  emptyAddBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  productsList: {
    gap: spacing.md,
  },
  productCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
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
  productValue: {
    ...typography.bodyBold,
    color: theme.success,
  },
  productName: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  altNames: {
    ...typography.small,
    color: theme.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  productStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productQty: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  stockIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stockText: {
    ...typography.small,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  summaryLabel: {
    ...typography.body,
    color: theme.textSecondary,
  },
  summaryValue: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
});
