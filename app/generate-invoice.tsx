import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { getCurrencySymbol } from '../constants/config';

interface LineItem {
  hsCode: string;
  description: string;
  products: Array<{
    productId: string;
    name: string;
    quantity: number;
    rate: number;
    unit: string;
  }>;
  totalQuantity: number;
  totalValue: number;
}

export default function GenerateInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shipmentId } = useLocalSearchParams();
  const { shipments, getProductById, userSettings, getCustomerById } = useApp();

  const shipment = shipments.find(s => s.id === shipmentId);
  const customer = shipment?.customer_id ? getCustomerById(shipment.customer_id) : null;
  const currencySymbol = getCurrencySymbol(userSettings.currency);
  
  if (!shipment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Shipment not found</Text>
      </SafeAreaView>
    );
  }

  // Collect all products from all boxes
  const allProducts = useMemo(() => {
    const productMap = new Map<string, { quantity: number; product: ReturnType<typeof getProductById> }>();
    
    shipment.boxes.forEach(box => {
      box.products.forEach(bp => {
        const existing = productMap.get(bp.product_id);
        const product = getProductById(bp.product_id);
        if (existing) {
          existing.quantity += bp.quantity;
        } else {
          productMap.set(bp.product_id, { quantity: bp.quantity, product });
        }
      });
    });

    return productMap;
  }, [shipment]);

  // Group by HS Code initially
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    const hsCodeMap = new Map<string, LineItem>();
    
    allProducts.forEach(({ quantity, product }, productId) => {
      if (!product) return;
      
      const existing = hsCodeMap.get(product.hs_code);
      // Get average rate from product invoices
      const avgRate = product.invoices && product.invoices.length > 0
        ? product.invoices.reduce((sum: number, inv: any) => sum + inv.rate, 0) / product.invoices.length
        : 0;
      
      if (existing) {
        existing.products.push({
          productId,
          name: product.name,
          quantity,
          rate: avgRate,
          unit: product.unit,
        });
        existing.totalQuantity += quantity;
        existing.totalValue += quantity * avgRate;
      } else {
        hsCodeMap.set(product.hs_code, {
          hsCode: product.hs_code,
          description: '',
          products: [{
            productId,
            name: product.name,
            quantity,
            rate: avgRate,
            unit: product.unit,
          }],
          totalQuantity: quantity,
          totalValue: quantity * avgRate,
        });
      }
    });

    return Array.from(hsCodeMap.values());
  });

  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');

  const handleUpdateDescription = (hsCode: string) => {
    setLineItems(prev => prev.map(item => 
      item.hsCode === hsCode ? { ...item, description: editDescription } : item
    ));
    setEditingItem(null);
    setEditDescription('');
  };

  const handleSplitItem = (hsCode: string, productId: string) => {
    const sourceItem = lineItems.find(item => item.hsCode === hsCode);
    if (!sourceItem || sourceItem.products.length <= 1) return;

    const productToSplit = sourceItem.products.find(p => p.productId === productId);
    if (!productToSplit) return;

    // Remove from source
    const newSourceProducts = sourceItem.products.filter(p => p.productId !== productId);
    const newSourceItem = {
      ...sourceItem,
      products: newSourceProducts,
      totalQuantity: newSourceProducts.reduce((sum, p) => sum + p.quantity, 0),
      totalValue: newSourceProducts.reduce((sum, p) => sum + (p.quantity * p.rate), 0),
    };

    // Create new line item
    const newItem: LineItem = {
      hsCode: `${hsCode}-${Date.now()}`,
      description: productToSplit.name,
      products: [productToSplit],
      totalQuantity: productToSplit.quantity,
      totalValue: productToSplit.quantity * productToSplit.rate,
    };

    setLineItems(prev => [
      ...prev.filter(item => item.hsCode !== hsCode),
      newSourceItem,
      newItem,
    ]);
  };

  const handleExport = async () => {
    const missingDescriptions = lineItems.filter(item => !item.description.trim());
    if (missingDescriptions.length > 0) {
      Alert.alert('Missing Descriptions', 'Please add descriptions to all line items before exporting.');
      return;
    }

    try {
      console.log('Starting commercial invoice Excel generation...');
      
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Build invoice data array
      const invoiceData = [
        // Title
        ['', '', '', '', 'COMMERCIAL INVOICE', '', '', ''],
        [''],
        
        // Exporter and Invoice Info Row
        ['Exporter:', '', '', '', 'Invoice no. & Date', '', '', 'Exporter IE Code no.'],
        [`M/s ${userSettings.name}`, '', '', '', shipment.name, new Date().toLocaleDateString(), '', ''],
        [userSettings.name, '', '', '', "Buyer's Order No.", '', '', ''],
        [userSettings.address, '', '', '', shipment.lot_number || 'N/A', '', '', ''],
        [`${userSettings.city}, ${userSettings.state} ${userSettings.country}`, '', '', '', 'Other Reference (s)', '', '', ''],
        [''],
        
        // Consignee and Buyer Row
        ['Consignee:', '', '', '', 'Buyer (if other than consignee)', '', '', ''],
        [customer ? customer.name : shipment.destination, '', '', '', 'Same as Consignee', '', '', ''],
        [customer ? customer.address : '', '', '', '', '', '', '', ''],
        [customer ? `${customer.city}, ${customer.state}, ${customer.country}` : shipment.destination, '', '', '', '', '', '', ''],
        [''],
        
        // Shipping Details
        ['Pre-carriage by:', '', 'Place of Receipt by Pre-carrier', '', 'Country of Origin of Goods', '', '', 'Country of final destination'],
        ['ROAD', '', userSettings.city + ', ' + userSettings.country, '', '', userSettings.country, '', customer?.country || 'N/A'],
        ['Vessel/Flight No.', '', 'Port of Loading', '', 'Terms of Delivery and Payment:', '', '', ''],
        ['', '', userSettings.city, '', 'ADVANCE', '', '', ''],
        ['Port of Discharge', '', 'Final Destination', '', `${shipment.destination}`, '', '', ''],
        [customer?.city || shipment.destination, '', customer ? `${customer.city}, ${customer.country}` : shipment.destination, '', '', '', '', ''],
        [''],
        
        // Product Table Header
        ['Mark & No./', '', 'Description of Goods', '', '', '', 'Quantity', 'Rate', 'Amount'],
        ['Container No. etc', '', '', 'HS Code', 'DBK Code', 'PACKING', 'PKGS', userSettings.currency, userSettings.currency],
      ];

      // Add line items
      lineItems.forEach((item, idx) => {
        const avgUnitPrice = item.totalValue / item.totalQuantity;
        invoiceData.push([
          '',
          idx + 1,
          item.description,
          item.hsCode.split('-')[0],
          '',
          '',
          item.totalQuantity,
          avgUnitPrice.toFixed(2),
          item.totalValue.toFixed(2)
        ]);
      });

      // Add spacing and totals
      invoiceData.push(
        [''],
        [''],
        ['', '', '', '', '', '', '', '', totalValue.toFixed(2)],
        ['', '', 'Export with Payment of IGST', '', '', '', '', '', ''],
        ['', '', 'Taxable Value', '', '', '', 'Insurance', '', ''],
        ['', '', 'IGST', '', '', '', 'Freight', '', ''],
        ['', '', '', '', '', 'Total units', '', 'G. Total', totalValue.toFixed(2)],
        ['Amount (in words)', '', '', '', '', '', '', '', ''],
        [`${userSettings.currency} ${numberToWords(totalValue)}`, '', '', '', '', '', '', '', ''],
        [''],
        ['', '', '', '', '', '', '', userSettings.name, ''],
        [''],
        ['Declaration:', '', '', '', '', '', '', '', ''],
        ['We declare that invoice shows the actual price of goods', '', '', '', '', '', '', 'Authorised Signatory', ''],
        ['described and that all particulars are true and correct.', '', '', '', '', '', '', 'Signature & Date', '']
      );

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(invoiceData);

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },   // Mark & No
        { wch: 6 },   // #
        { wch: 45 },  // Description
        { wch: 12 },  // HS Code
        { wch: 10 },  // DBK Code
        { wch: 10 },  // Packing
        { wch: 10 },  // Quantity
        { wch: 12 },  // Rate
        { wch: 15 }   // Amount
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
      console.log('Commercial invoice worksheet created');

      // Create detailed breakdown sheet
      const detailData = [
        ['DETAILED PRODUCT BREAKDOWN'],
        [''],
        ['Line #', 'HS Code', 'Product Name', 'Quantity', 'Unit', 'Rate', 'Value']
      ];

      lineItems.forEach((item, idx) => {
        item.products.forEach(product => {
          detailData.push([
            idx + 1,
            item.hsCode.split('-')[0],
            product.name,
            product.quantity,
            product.unit,
            product.rate.toFixed(2),
            (product.quantity * product.rate).toFixed(2)
          ]);
        });
      });

      const detailWs = XLSX.utils.aoa_to_sheet(detailData);
      detailWs['!cols'] = [
        { wch: 8 },
        { wch: 12 },
        { wch: 40 },
        { wch: 10 },
        { wch: 8 },
        { wch: 12 },
        { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, detailWs, 'Detailed Breakdown');
      console.log('Detail sheet created');

      // Write file
      console.log('Writing Excel file...');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `${shipment.name.replace(/[^a-z0-9]/gi, '_')}_Commercial_Invoice.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      console.log('File path:', fileUri);
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('File written successfully');

      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('File was not created successfully');
      }

      console.log('Sharing file...');
      await shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Commercial Invoice',
        UTI: 'com.microsoft.excel.xlsx'
      });
      console.log('File shared successfully');

    } catch (error: any) {
      console.error('Excel export error:', error);
      console.error('Error details:', error.message, error.stack);
      Alert.alert('Error', `Failed to generate Excel file: ${error.message || 'Unknown error'}`);
    }
  };

  // Helper function to convert number to words (simple implementation)
  const numberToWords = (num: number): string => {
    // Simple implementation - in production you'd want a more complete converter
    if (num === 0) return 'Zero';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convertLessThanThousand = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    };
    
    let intPart = Math.floor(num);
    const decPart = Math.round((num - intPart) * 100);
    
    let result = '';
    
    if (intPart >= 1000000) {
      result += convertLessThanThousand(Math.floor(intPart / 1000000)) + ' Million ';
      intPart %= 1000000;
    }
    if (intPart >= 1000) {
      result += convertLessThanThousand(Math.floor(intPart / 1000)) + ' Thousand ';
      intPart %= 1000;
    }
    if (intPart > 0) {
      result += convertLessThanThousand(intPart);
    }
    
    if (decPart > 0) {
      result += ' and ' + convertLessThanThousand(decPart) + ' Cents';
    }
    
    return result.trim();
  };

  const totalValue = lineItems.reduce((sum, item) => sum + item.totalValue, 0);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Commercial Invoice</Text>
        <Pressable style={styles.exportBtn} onPress={handleExport}>
          <MaterialIcons name="download" size={20} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Shipment Info */}
        <View style={styles.shipmentInfo}>
          <Text style={styles.shipmentName}>{shipment.name}</Text>
          <Text style={styles.shipmentDest}>{shipment.destination}</Text>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="info" size={20} color={theme.primary} />
          <Text style={styles.infoBannerText}>
            Products are grouped by HS Code. Tap a product to split it into a separate line item. Add descriptions for each line.
          </Text>
        </View>

        {/* Line Items */}
        <Text style={styles.sectionTitle}>LINE ITEMS ({lineItems.length})</Text>
        
        {lineItems.map((item, idx) => (
          <View key={item.hsCode} style={styles.lineItemCard}>
            <View style={styles.lineItemHeader}>
              <View style={styles.lineItemNumber}>
                <Text style={styles.lineItemNumberText}>{idx + 1}</Text>
              </View>
              <View style={styles.lineItemHS}>
                <Text style={styles.hsLabel}>HS CODE</Text>
                <Text style={styles.hsValue}>{item.hsCode.split('-')[0]}</Text>
              </View>
              <View style={styles.lineItemTotals}>
                <Text style={styles.totalQty}>{item.totalQuantity} pcs</Text>
                <Text style={styles.totalVal}>{currencySymbol}{item.totalValue.toLocaleString()}</Text>
              </View>
            </View>

            {/* Description */}
            {editingItem === item.hsCode ? (
              <View style={styles.descriptionEdit}>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Enter line item description..."
                  placeholderTextColor={theme.textMuted}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  autoFocus
                  multiline
                />
                <View style={styles.descriptionActions}>
                  <Pressable 
                    style={styles.descCancelBtn}
                    onPress={() => setEditingItem(null)}
                  >
                    <Text style={styles.descCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.descSaveBtn}
                    onPress={() => handleUpdateDescription(item.hsCode)}
                  >
                    <Text style={styles.descSaveText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable 
                style={styles.descriptionBox}
                onPress={() => {
                  setEditingItem(item.hsCode);
                  setEditDescription(item.description);
                }}
              >
                {item.description ? (
                  <Text style={styles.descriptionText}>{item.description}</Text>
                ) : (
                  <Text style={styles.descriptionPlaceholder}>
                    Tap to add description...
                  </Text>
                )}
                <MaterialIcons name="edit" size={16} color={theme.textMuted} />
              </Pressable>
            )}

            {/* Products */}
            <View style={styles.productsSection}>
              <Text style={styles.productsTitle}>Products in this line:</Text>
              {item.products.map(product => (
                <Pressable 
                  key={product.productId} 
                  style={styles.productRow}
                  onPress={() => item.products.length > 1 && handleSplitItem(item.hsCode, product.productId)}
                >
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                    <Text style={styles.productDetails}>
                      {product.quantity} {product.unit} × {currencySymbol}{product.rate.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.productValue}>
                    <Text style={styles.productValueText}>
                      {currencySymbol}{(product.quantity * product.rate).toLocaleString()}
                    </Text>
                    {item.products.length > 1 && (
                      <MaterialIcons name="call-split" size={16} color={theme.primary} />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Line Items</Text>
            <Text style={styles.summaryValue}>{lineItems.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Products</Text>
            <Text style={styles.summaryValue}>{allProducts.size}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.totalLabel}>TOTAL VALUE</Text>
            <Text style={styles.totalValue}>{currencySymbol}{totalValue.toLocaleString()}</Text>
          </View>
        </View>

        {/* Export Button */}
        <Pressable style={styles.exportFullBtn} onPress={handleExport}>
          <MaterialIcons name="file-download" size={20} color="#FFF" />
          <Text style={styles.exportFullBtnText}>Export as Excel</Text>
        </Pressable>
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
  exportBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shipmentInfo: {
    marginBottom: spacing.lg,
  },
  shipmentName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  shipmentDest: {
    ...typography.body,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${theme.primary}10`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  infoBannerText: {
    ...typography.caption,
    color: theme.textSecondary,
    flex: 1,
  },
  sectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
  },
  lineItemCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lineItemNumber: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  lineItemNumberText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  lineItemHS: {
    flex: 1,
  },
  hsLabel: {
    ...typography.small,
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  hsValue: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  lineItemTotals: {
    alignItems: 'flex-end',
  },
  totalQty: {
    ...typography.small,
    color: theme.textSecondary,
  },
  totalVal: {
    ...typography.bodyBold,
    color: theme.success,
  },
  descriptionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  descriptionText: {
    ...typography.body,
    color: theme.textPrimary,
    flex: 1,
  },
  descriptionPlaceholder: {
    ...typography.body,
    color: theme.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  descriptionEdit: {
    marginBottom: spacing.md,
  },
  descriptionInput: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: theme.textPrimary,
    borderWidth: 2,
    borderColor: theme.primary,
    minHeight: 60,
  },
  descriptionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  descCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  descCancelText: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  descSaveBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.primary,
    borderRadius: borderRadius.sm,
  },
  descSaveText: {
    ...typography.caption,
    color: '#FFF',
    fontWeight: '600',
  },
  productsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    paddingTop: spacing.md,
  },
  productsTitle: {
    ...typography.small,
    color: theme.textSecondary,
    marginBottom: spacing.sm,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...typography.caption,
    color: theme.textPrimary,
  },
  productDetails: {
    ...typography.small,
    color: theme.textSecondary,
  },
  productValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  productValueText: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
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
  summaryTotal: {
    borderBottomWidth: 0,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  totalLabel: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.success,
  },
  exportFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  exportFullBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
});
