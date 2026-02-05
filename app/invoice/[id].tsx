import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp, Payment } from '../../contexts/AppContext';
import { getCurrencySymbol } from '../../constants/config';

export default function InvoiceDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { 
    invoices, 
    products, 
    getSupplierById, 
    deleteInvoice, 
    updateInvoice, 
    userSettings,
    payments,
    addPayment,
    deletePayment,
    getPaymentsByInvoice,
    getInvoicePaidAmount,
  } = useApp();
  const currencySymbol = getCurrencySymbol(userSettings.currency);

  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Payment calculations
  const invoicePayments = getPaymentsByInvoice(invoice.id);
  const totalPaid = getInvoicePaidAmount(invoice.id);
  const remainingAmount = Math.max(0, invoice.amount - totalPaid);
  const paidPercentage = invoice.amount > 0 ? Math.min(100, (totalPaid / invoice.amount) * 100) : 0;

  // Determine actual payment status
  const actualStatus = totalPaid >= invoice.amount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }

    if (amount > remainingAmount) {
      Alert.alert(
        'Overpayment',
        `This payment (${currencySymbol}${amount.toFixed(2)}) exceeds the remaining balance (${currencySymbol}${remainingAmount.toFixed(2)}). Continue anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => submitPayment(amount) }
        ]
      );
      return;
    }

    await submitPayment(amount);
  };

  const submitPayment = async (amount: number) => {
    setIsSubmitting(true);
    try {
      await addPayment({
        invoice_id: invoice.id,
        amount,
        payment_date: new Date(paymentDate).toISOString(),
        notes: paymentNotes.trim() || undefined,
      });
      
      setShowAddPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error adding payment:', error);
      Alert.alert('Error', 'Failed to add payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = (payment: Payment) => {
    Alert.alert(
      'Delete Payment',
      `Delete payment of ${currencySymbol}${payment.amount.toFixed(2)} from ${formatDate(payment.payment_date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deletePayment(payment.id)
        }
      ]
    );
  };

  const handleMarkFullyPaid = () => {
    if (remainingAmount <= 0) {
      Alert.alert('Already Paid', 'This invoice is already fully paid');
      return;
    }

    Alert.alert(
      'Mark as Fully Paid',
      `Add payment of ${currencySymbol}${remainingAmount.toFixed(2)} to mark this invoice as fully paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm',
          onPress: async () => {
            await addPayment({
              invoice_id: invoice.id,
              amount: remainingAmount,
              payment_date: new Date().toISOString(),
              notes: 'Marked as fully paid',
            });
          }
        }
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Invoice',
      `Are you sure you want to delete invoice #${invoice.invoice_number}? All products and payment records will also be deleted.`,
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return { bg: theme.successLight, text: theme.success };
      case 'partial': return { bg: `${theme.warning}20`, text: theme.warning };
      default: return { bg: `${theme.error}20`, text: theme.error };
    }
  };

  const statusColor = getStatusColor(actualStatus);

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
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>
                {actualStatus}
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
        </View>

        {/* Payment Progress Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAYMENT STATUS</Text>
          <View style={styles.paymentProgressCard}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${paidPercentage}%`,
                      backgroundColor: actualStatus === 'paid' ? theme.success : actualStatus === 'partial' ? theme.warning : theme.border
                    }
                  ]} 
                />
              </View>
              <Text style={styles.progressPercentage}>{Math.round(paidPercentage)}%</Text>
            </View>

            {/* Amount Details */}
            <View style={styles.paymentAmounts}>
              <View style={styles.paymentAmountItem}>
                <Text style={styles.paymentAmountLabel}>Paid</Text>
                <Text style={[styles.paymentAmountValue, { color: theme.success }]}>
                  {currencySymbol}{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.paymentAmountDivider} />
              <View style={styles.paymentAmountItem}>
                <Text style={styles.paymentAmountLabel}>Remaining</Text>
                <Text style={[styles.paymentAmountValue, { color: remainingAmount > 0 ? theme.error : theme.textMuted }]}>
                  {currencySymbol}{remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.paymentActions}>
              <Pressable 
                style={[styles.addPaymentBtn, remainingAmount <= 0 && styles.btnDisabled]}
                onPress={() => setShowAddPaymentModal(true)}
                disabled={remainingAmount <= 0}
              >
                <MaterialIcons name="add" size={18} color={remainingAmount > 0 ? '#FFF' : theme.textMuted} />
                <Text style={[styles.addPaymentBtnText, remainingAmount <= 0 && styles.btnTextDisabled]}>
                  Record Payment
                </Text>
              </Pressable>
              {remainingAmount > 0 && (
                <Pressable style={styles.markPaidBtn} onPress={handleMarkFullyPaid}>
                  <MaterialIcons name="check-circle" size={18} color={theme.success} />
                  <Text style={styles.markPaidBtnText}>Mark Fully Paid</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Payment History */}
        {invoicePayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PAYMENT HISTORY ({invoicePayments.length})</Text>
            <View style={styles.paymentHistoryCard}>
              {invoicePayments.map((payment, index) => (
                <View 
                  key={payment.id} 
                  style={[
                    styles.paymentHistoryItem,
                    index === invoicePayments.length - 1 && styles.paymentHistoryItemLast
                  ]}
                >
                  <View style={styles.paymentHistoryIcon}>
                    <MaterialIcons name="payment" size={20} color={theme.success} />
                  </View>
                  <View style={styles.paymentHistoryContent}>
                    <View style={styles.paymentHistoryHeader}>
                      <Text style={styles.paymentHistoryAmount}>
                        {currencySymbol}{payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>
                      <Text style={styles.paymentHistoryDate}>
                        {formatShortDate(payment.payment_date)}
                      </Text>
                    </View>
                    {payment.notes && (
                      <Text style={styles.paymentHistoryNotes} numberOfLines={2}>
                        {payment.notes}
                      </Text>
                    )}
                    <Text style={styles.paymentHistoryTimestamp}>
                      Recorded: {formatDate(payment.created_at || payment.payment_date)}
                    </Text>
                  </View>
                  <Pressable 
                    style={styles.paymentDeleteBtn}
                    onPress={() => handleDeletePayment(payment)}
                  >
                    <MaterialIcons name="close" size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

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

      {/* Add Payment Modal */}
      <Modal
        visible={showAddPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPaymentModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => setShowAddPaymentModal(false)}
          />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHandle} />
            
            <Text style={styles.modalTitle}>Record Payment</Text>
            
            <View style={styles.modalInvoiceInfo}>
              <Text style={styles.modalInvoiceLabel}>Invoice #{invoice.invoice_number}</Text>
              <Text style={styles.modalInvoiceRemaining}>
                Remaining: {currencySymbol}{remainingAmount.toFixed(2)}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Amount *</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor={theme.textMuted}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              {remainingAmount > 0 && (
                <Pressable 
                  style={styles.quickFillBtn}
                  onPress={() => setPaymentAmount(remainingAmount.toFixed(2))}
                >
                  <Text style={styles.quickFillText}>
                    Fill remaining ({currencySymbol}{remainingAmount.toFixed(2)})
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
                value={paymentDate}
                onChangeText={setPaymentDate}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="e.g., Bank transfer, Check #123"
                placeholderTextColor={theme.textMuted}
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable 
                style={styles.modalCancelBtn}
                onPress={() => setShowAddPaymentModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalSubmitBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleAddPayment}
                disabled={isSubmitting}
              >
                <Text style={styles.modalSubmitText}>
                  {isSubmitting ? 'Saving...' : 'Add Payment'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: spacing.md,
  },
  // Payment Progress Card
  paymentProgressCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: theme.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  progressPercentage: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    width: 45,
    textAlign: 'right',
  },
  paymentAmounts: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  paymentAmountItem: {
    flex: 1,
    alignItems: 'center',
  },
  paymentAmountDivider: {
    width: 1,
    backgroundColor: theme.border,
    marginHorizontal: spacing.md,
  },
  paymentAmountLabel: {
    ...typography.small,
    color: theme.textSecondary,
    marginBottom: spacing.xs,
  },
  paymentAmountValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  paymentActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addPaymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  addPaymentBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  markPaidBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.success,
  },
  markPaidBtnText: {
    ...typography.bodyBold,
    color: theme.success,
  },
  btnDisabled: {
    backgroundColor: theme.border,
    borderColor: theme.border,
  },
  btnTextDisabled: {
    color: theme.textMuted,
  },
  // Payment History
  paymentHistoryCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    ...shadows.card,
    overflow: 'hidden',
  },
  paymentHistoryItem: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  paymentHistoryItemLast: {
    borderBottomWidth: 0,
  },
  paymentHistoryIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: `${theme.success}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  paymentHistoryContent: {
    flex: 1,
  },
  paymentHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  paymentHistoryAmount: {
    ...typography.bodyBold,
    color: theme.success,
  },
  paymentHistoryDate: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  paymentHistoryNotes: {
    ...typography.small,
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  paymentHistoryTimestamp: {
    ...typography.small,
    color: theme.textMuted,
  },
  paymentDeleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  // Products Section
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalInvoiceInfo: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  modalInvoiceLabel: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  modalInvoiceRemaining: {
    ...typography.caption,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textSecondary,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    paddingVertical: spacing.md,
  },
  quickFillBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  quickFillText: {
    ...typography.small,
    color: theme.primary,
    textDecorationLine: 'underline',
  },
  notesInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: theme.backgroundSecondary,
  },
  modalCancelText: {
    ...typography.bodyBold,
    color: theme.textSecondary,
  },
  modalSubmitBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: theme.primary,
  },
  modalSubmitText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
});
