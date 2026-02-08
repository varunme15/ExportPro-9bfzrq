import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getCurrencySymbol } from '../../constants/config';

export default function ShipmentDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { shipments, products, invoices, deleteShipment, removeBoxFromShipment, getBoxTypeById, getProductById, getCustomerById, getSupplierById, userSettings } = useApp();
  const currencySymbol = getCurrencySymbol(userSettings.currency);

  const shipment = shipments.find(s => s.id === id);
  const customer = shipment?.customer_id ? getCustomerById(shipment.customer_id) : null;
  
  if (!shipment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Shipment not found</Text>
      </SafeAreaView>
    );
  }

  const getShipmentStatusText = () => {
    const boxCount = shipment.boxes?.length || 0;
    if (boxCount === 0) return 'Draft';
    return `${boxCount} Box${boxCount !== 1 ? 'es' : ''}`;
  };

  const getShipmentStatusColor = () => {
    const boxCount = shipment.boxes?.length || 0;
    if (boxCount === 0) return theme.textSecondary;
    return theme.success;
  };

  const calculateStats = () => {
    let totalWeight = 0;
    let totalCBM = 0;
    let totalItems = 0;

    shipment.boxes.forEach(box => {
      totalWeight += box.weight || 0;
      const boxType = getBoxTypeById(box.box_type_id);
      if (boxType) {
        // Parse dimensions string (e.g., "60x45x40") to calculate CBM
        const dims = boxType.dimensions.split('x').map(Number);
        if (dims.length === 3) {
          totalCBM += (dims[0] * dims[1] * dims[2]) / 1000000;
        }
      }
      box.products.forEach(p => {
        totalItems += p.quantity;
      });
    });

    return { totalWeight, totalCBM, totalItems };
  };

  const stats = calculateStats();

  // Get all invoices related to this shipment with product mapping
  const getShipmentInvoices = () => {
    const invoiceMap = new Map<string, {
      invoice: any;
      supplier: any;
      products: Array<{ product: any; quantity: number; rate: number }>;
    }>();

    // Iterate through all boxes and products
    shipment.boxes.forEach(box => {
      box.products.forEach(boxProduct => {
        const product = getProductById(boxProduct.product_id);
        if (product && product.invoices && product.invoices.length > 0) {
          // Get all invoices linked to this product
          product.invoices.forEach(productInvoice => {
            const invoiceId = productInvoice.invoice_id;
            const invoice = invoices.find(inv => inv.id === invoiceId);
            const supplier = invoice ? getSupplierById(invoice.supplier_id) : null;

            if (invoice && supplier) {
              if (!invoiceMap.has(invoiceId)) {
                invoiceMap.set(invoiceId, {
                  invoice,
                  supplier,
                  products: []
                });
              }

              const existing = invoiceMap.get(invoiceId)!.products.find(
                p => p.product.id === product.id
              );

              if (existing) {
                existing.quantity += boxProduct.quantity;
              } else {
                invoiceMap.get(invoiceId)!.products.push({
                  product,
                  quantity: boxProduct.quantity,
                  rate: productInvoice.rate
                });
              }
            }
          });
        }
      });
    });

    return Array.from(invoiceMap.values());
  };

  const shipmentInvoices = getShipmentInvoices();

  const generateInvoiceMappingExcel = async () => {
    if (shipmentInvoices.length === 0) {
      Alert.alert('No Invoices', 'This shipment has no invoices to export.');
      return;
    }

    try {
      console.log('Starting Excel generation...');
      
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        ['Shipment Invoice Mapping'],
        [''],
        ['Shipment Name:', shipment.name],
        ['Destination:', shipment.destination],
        ['Lot Number:', shipment.lot_number || 'N/A'],
        ['Export Date:', new Date().toLocaleDateString()],
        [''],
        ['Summary Statistics'],
        ['Total Invoices:', shipmentInvoices.length],
        ['Unique Products:', shipmentInvoices.reduce((sum, inv) => sum + inv.products.length, 0)],
        ['Total Items:', shipmentInvoices.reduce((sum, inv) => sum + inv.products.reduce((s, p) => s + p.quantity, 0), 0)],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
      console.log('Summary sheet created');

      // Create a sheet for each invoice
      shipmentInvoices.forEach(({ invoice, supplier, products: invoiceProducts }, index) => {
        const currency = userSettings.currency || 'USD';
        const sheetData = [
          [`Invoice #${invoice.invoice_number}`],
          [''],
          ['Supplier Information'],
          ['Supplier Name:', supplier.name],
          ['Contact:', supplier.contact || 'N/A'],
          ['Email:', supplier.email || 'N/A'],
          ['Phone:', supplier.phone || 'N/A'],
          [''],
          ['Invoice Details'],
          ['Invoice Number:', invoice.invoice_number],
          ['Date:', invoice.date],
          ['Total Amount:', `${currency} ${(invoice.amount || 0).toLocaleString()}`],
          [''],
          ['Products in Shipment'],
          ['#', 'Product Name', 'HS Code', 'Quantity', 'Unit', 'Rate', 'Total Value'],
        ];

        // Add product rows
        invoiceProducts.forEach((item, idx) => {
          const totalValue = item.quantity * item.rate;
          sheetData.push([
            idx + 1,
            item.product.name,
            item.product.hs_code || 'N/A',
            item.quantity,
            item.product.unit,
            `${currency} ${item.rate.toFixed(2)}`,
            `${currency} ${totalValue.toFixed(2)}`
          ]);
        });

        // Add totals
        const totalQty = invoiceProducts.reduce((sum, p) => sum + p.quantity, 0);
        const totalValue = invoiceProducts.reduce((sum, p) => sum + (p.quantity * p.rate), 0);
        sheetData.push(
          [''],
          ['', '', '', totalQty, '', '', `${currency} ${totalValue.toFixed(2)}`]
        );

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Set column widths
        ws['!cols'] = [
          { wch: 5 },
          { wch: 40 },
          { wch: 12 },
          { wch: 10 },
          { wch: 8 },
          { wch: 12 },
          { wch: 15 }
        ];

        // Use shortened sheet name if needed (Excel has 31 char limit)
        const sheetName = `Invoice ${index + 1}`.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });
      console.log('Invoice sheets created');

      // Complete Product List Sheet
      const allProductsData = [
        ['Complete Product List'],
        [''],
        ['Product Name', 'HS Code', 'Quantity', 'Unit', 'Invoice #', 'Supplier']
      ];

      shipmentInvoices.forEach(({ invoice, supplier, products: invoiceProducts }) => {
        invoiceProducts.forEach(item => {
          allProductsData.push([
            item.product.name,
            item.product.hs_code || 'N/A',
            item.quantity,
            item.product.unit,
            invoice.invoice_number,
            supplier.name
          ]);
        });
      });

      const allProductsSheet = XLSX.utils.aoa_to_sheet(allProductsData);
      allProductsSheet['!cols'] = [
        { wch: 40 },
        { wch: 12 },
        { wch: 10 },
        { wch: 8 },
        { wch: 15 },
        { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(wb, allProductsSheet, 'All Products');
      console.log('All products sheet created');

      // Write file
      console.log('Writing Excel file...');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `${shipment.name.replace(/[^a-z0-9]/gi, '_')}_Invoice_Mapping.xlsx`;
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
        dialogTitle: 'Export Invoice Mapping',
        UTI: 'com.microsoft.excel.xlsx'
      });
      console.log('File shared successfully');

    } catch (error: any) {
      console.error('Excel export error:', error);
      console.error('Error details:', error.message, error.stack);
      Alert.alert('Error', `Failed to generate Excel file: ${error.message || 'Unknown error'}`);
    }
  };

  const generateInvoiceMappingPDF = async () => {
    if (shipmentInvoices.length === 0) {
      Alert.alert('No Invoices', 'This shipment has no invoices to export.');
      return;
    }

    try {
      const currency = userSettings.currency || 'USD';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              @page { margin: 20px; }
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { border-bottom: 4px solid ${theme.primary}; padding-bottom: 15px; margin-bottom: 20px; }
              .header h1 { margin: 0; font-size: 24px; color: ${theme.textPrimary}; }
              .header .shipment-info { font-size: 14px; color: #666; margin-top: 10px; }
              .invoice-section { margin-bottom: 30px; page-break-inside: avoid; }
              .invoice-header { background: ${theme.primaryLight}; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
              .supplier-name { font-size: 18px; font-weight: bold; color: ${theme.primaryDark}; margin-bottom: 5px; }
              .invoice-details { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 10px; }
              .detail-item { font-size: 13px; color: #666; }
              .detail-label { font-weight: 600; color: #333; }
              .products-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              .products-table th { background: #f5f5f5; padding: 10px; text-align: left; border: 1px solid #ddd; font-size: 12px; }
              .products-table td { padding: 10px; border: 1px solid #ddd; font-size: 13px; }
              .products-table tr:nth-child(even) { background: #fafafa; }
              .summary { background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 30px; }
              .summary h3 { margin: 0 0 10px 0; font-size: 16px; color: ${theme.primary}; }
              .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
              .summary-item { text-align: center; }
              .summary-value { font-size: 20px; font-weight: bold; color: ${theme.textPrimary}; }
              .summary-label { font-size: 12px; color: #666; margin-top: 5px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Shipment Invoice Mapping</h1>
              <div class="shipment-info">
                <strong>Shipment:</strong> ${shipment.name} | 
                <strong>Destination:</strong> ${shipment.destination} | 
                ${shipment.lot_number ? `<strong>Lot:</strong> ${shipment.lot_number} | ` : ''}
                <strong>Date:</strong> ${new Date().toLocaleDateString()}
              </div>
            </div>

            ${shipmentInvoices.map(({ invoice, supplier, products: invoiceProducts }) => `
              <div class="invoice-section">
                <div class="invoice-header">
                  <div class="supplier-name">📦 ${supplier.name}</div>
                  <div class="invoice-details">
                    <div class="detail-item">
                      <span class="detail-label">Invoice #:</span> ${invoice.invoice_number}
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Date:</span> ${invoice.date}
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Total Amount:</span> ${currency} ${(invoice.amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <table class="products-table">
                  <thead>
                    <tr>
                      <th style="width: 5%;">#</th>
                      <th style="width: 45%;">Product Name</th>
                      <th style="width: 15%;">HS Code</th>
                      <th style="width: 15%;">Quantity</th>
                      <th style="width: 10%;">Unit</th>
                      <th style="width: 10%;">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${invoiceProducts.map((item, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>${item.product.name}</td>
                        <td>${item.product.hs_code || 'N/A'}</td>
                        <td><strong>${item.quantity}</strong></td>
                        <td>${item.product.unit}</td>
                        <td>${currency} ${item.rate.toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <div>
              <img src= ${invoice.image_uri}></img>
              </div>
            `).join('')}

            <div class="summary">
              <h3>📊 Shipment Summary</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <div class="summary-value">${shipmentInvoices.length}</div>
                  <div class="summary-label">Total Invoices</div>
                </div>
                <div class="summary-item">
                  <div class="summary-value">${shipmentInvoices.reduce((sum, inv) => sum + inv.products.length, 0)}</div>
                  <div class="summary-label">Unique Products</div>
                </div>
                <div class="summary-item">
                  <div class="summary-value">${shipmentInvoices.reduce((sum, inv) => sum + inv.products.reduce((s, p) => s + p.quantity, 0), 0)}</div>
                  <div class="summary-label">Total Items</div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate invoice mapping PDF');
      console.error(error);
    }
  };

  const generateLabelHTML = (shipmentData: any, box: any, customerData: any, boxType: any, settings: any) => {
    const dimensions = boxType?.dimensions || 'N/A';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page { margin: 20px; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .label { border: 3px solid #000; padding: 30px; margin-bottom: 30px; page-break-after: always; }
            .label:last-child { page-break-after: auto; }
            .header { border-bottom: 4px solid ${theme.primary}; padding-bottom: 15px; margin-bottom: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .number-section { display: flex; gap: 15px; margin-bottom: 20px; }
            .number-box { flex: 1; background: ${theme.primaryLight}; padding: 15px; text-align: center; border-radius: 8px; }
            .number-label { font-size: 11px; font-weight: bold; color: ${theme.primaryDark}; }
            .number-value { font-size: 24px; font-weight: bold; color: ${theme.primaryDark}; margin-top: 5px; }
            .party { background: #f5f5f5; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
            .party-title { font-size: 12px; font-weight: bold; color: #666; margin-bottom: 10px; }
            .party-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
            .party-address { font-size: 14px; color: #666; }
            .details { border-top: 1px solid #ddd; padding-top: 15px; margin-bottom: 15px; }
            .detail-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .detail-label { color: #666; }
            .detail-value { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">
              <h1>SHIPPING LABEL</h1>
            </div>
            <div class="number-section">
              <div class="number-box">
                <div class="number-label">LOT NUMBER</div>
                <div class="number-value">${shipmentData.lot_number || 'N/A'}</div>
              </div>
              <div class="number-box">
                <div class="number-label">BOX NUMBER</div>
                <div class="number-value">#${box.box_number}</div>
              </div>
            </div>
            <div class="party">
              <div class="party-title">📤 CONSIGNOR (FROM)</div>
              <div class="party-name">${settings.name || 'N/A'}</div>
              <div class="party-address">${settings.address || ''}</div>
              <div class="party-address">${[settings.city, settings.state, settings.country].filter(Boolean).join(', ')}</div>
            </div>
            <div class="party">
              <div class="party-title">📥 CONSIGNEE (TO)</div>
              <div class="party-name">${customerData ? customerData.name : shipmentData.destination}</div>
              ${customerData ? `
                <div class="party-address">${customerData.address || ''}</div>
                <div class="party-address">${[customerData.city, customerData.state, customerData.country].filter(Boolean).join(', ')}</div>
              ` : ''}
            </div>
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">Box Type:</span>
                <span class="detail-value">${boxType?.name || 'Unknown'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Dimensions:</span>
                <span class="detail-value">${dimensions}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Weight:</span>
                <span class="detail-value">${(box.weight || 0).toFixed(2)} kg</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleGenerateAllLabels = async () => {
    if (shipment.boxes.length === 0) {
      Alert.alert('No Boxes', 'This shipment has no boxes yet.');
      return;
    }

    try {
      let allLabelsHTML = shipment.boxes.map(box => {
        const boxType = getBoxTypeById(box.box_type_id);
        return generateLabelHTML(shipment, box, customer, boxType, userSettings).replace('<!DOCTYPE html>', '').replace('<html>', '').replace('</html>', '').replace('<head>', '').replace('</head>', '').replace('<body>', '').replace('</body>', '');
      }).join('');

      const fullHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              @page { margin: 20px; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
              .label { border: 3px solid #000; padding: 30px; margin-bottom: 30px; page-break-after: always; }
              .label:last-child { page-break-after: auto; margin-bottom: 0; }
              .header { border-bottom: 4px solid ${theme.primary}; padding-bottom: 15px; margin-bottom: 20px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .number-section { display: flex; gap: 15px; margin-bottom: 20px; }
              .number-box { flex: 1; background: ${theme.primaryLight}; padding: 15px; text-align: center; border-radius: 8px; }
              .number-label { font-size: 11px; font-weight: bold; color: ${theme.primaryDark}; }
              .number-value { font-size: 24px; font-weight: bold; color: ${theme.primaryDark}; margin-top: 5px; }
              .party { background: #f5f5f5; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
              .party-title { font-size: 12px; font-weight: bold; color: #666; margin-bottom: 10px; }
              .party-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
              .party-address { font-size: 14px; color: #666; }
              .details { border-top: 1px solid #ddd; padding-top: 15px; margin-bottom: 15px; }
              .detail-row { display: flex; justify-content: space-between; padding: 5px 0; }
              .detail-label { color: #666; }
              .detail-value { font-weight: bold; }
            </style>
          </head>
          <body>
            ${allLabelsHTML}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: fullHTML });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate labels PDF');
      console.error(error);
    }
  };

  const handleDeleteBox = (boxId: string) => {
    Alert.alert(
      'Remove Box',
      'Are you sure? Products will be returned to inventory.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => removeBoxFromShipment(shipment.id, boxId)
        },
      ]
    );
  };

  const handleDeleteShipment = () => {
    Alert.alert(
      'Delete Shipment',
      'Are you sure? All boxes and their products will be returned to inventory.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteShipment(shipment.id);
            router.back();
          }
        },
      ]
    );
  };

  const statusText = getShipmentStatusText();
  const statusColor = getShipmentStatusColor();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Shipment Details</Text>
        <Pressable style={styles.menuBtn} onPress={handleDeleteShipment}>
          <MaterialIcons name="delete-outline" size={24} color={theme.error} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Shipment Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.shipmentName}>{shipment.name}</Text>
              {shipment.lot_number && (
                <View style={styles.lotRow}>
                  <MaterialIcons name="tag" size={14} color={theme.primary} />
                  <Text style={styles.lotText}>Lot: {shipment.lot_number}</Text>
                </View>
              )}
              <View style={styles.destRow}>
                <MaterialIcons name="place" size={16} color={theme.textSecondary} />
                <Text style={styles.destText}>{shipment.destination}</Text>
              </View>
              {customer && (
                <Pressable 
                  style={styles.customerRow}
                  onPress={() => router.push(`/customer/${customer.id}`)}
                >
                  <MaterialIcons name="business" size={16} color={theme.textSecondary} />
                  <Text style={styles.customerText}>{customer.name}</Text>
                  <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
                </Pressable>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusText.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="inventory-2" size={24} color={theme.primary} />
            <Text style={styles.statValue}>{shipment.boxes.length}</Text>
            <Text style={styles.statLabel}>Boxes</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="category" size={24} color={theme.inventory} />
            <Text style={styles.statValue}>{stats.totalItems}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="straighten" size={24} color={theme.shipment} />
            <Text style={styles.statValue}>{stats.totalCBM.toFixed(2)}</Text>
            <Text style={styles.statLabel}>CBM</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="fitness-center" size={24} color={theme.supplier} />
            <Text style={styles.statValue}>{stats.totalWeight.toFixed(1)}</Text>
            <Text style={styles.statLabel}>kg</Text>
          </View>
        </View>

        {/* Boxes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>BOXES ({shipment.boxes.length})</Text>
            <Pressable 
              style={styles.addBoxBtn}
              onPress={() => router.push(`/add-box?shipmentId=${shipment.id}`)}
            >
              <MaterialIcons name="add" size={18} color={theme.primary} />
              <Text style={styles.addBoxText}>Add Box</Text>
            </Pressable>
          </View>

          {shipment.boxes.length === 0 ? (
            <View style={styles.emptyBoxes}>
              <MaterialIcons name="inbox" size={48} color={theme.textMuted} />
              <Text style={styles.emptyText}>No boxes added yet</Text>
              <Pressable 
                style={styles.emptyAddBtn}
                onPress={() => router.push(`/add-box?shipmentId=${shipment.id}`)}
              >
                <MaterialIcons name="add" size={18} color="#FFF" />
                <Text style={styles.emptyAddBtnText}>Add First Box</Text>
              </Pressable>
            </View>
          ) : (
            shipment.boxes.map(box => {
              const boxType = getBoxTypeById(box.box_type_id);
              return (
                <Pressable 
                  key={box.id} 
                  style={styles.boxCard}
                  onPress={() => router.push(`/box/${box.id}?shipmentId=${shipment.id}`)}
                >
                  <View style={styles.boxHeader}>
                    <View style={styles.boxNumber}>
                      <Text style={styles.boxNumberText}>#{box.box_number}</Text>
                    </View>
                    <View style={styles.boxInfo}>
                      <Text style={styles.boxType}>{boxType?.name || 'Unknown'}</Text>
                      <Text style={styles.boxDimensions}>
                        {boxType?.dimensions || 'N/A'}
                      </Text>
                    </View>
                    <Pressable 
                      style={styles.boxDeleteBtn}
                      onPress={() => handleDeleteBox(box.id)}
                    >
                      <MaterialIcons name="close" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>

                  <View style={styles.boxStats}>
                    <View style={styles.boxStatItem}>
                      <Text style={styles.boxStatValue}>{box.products.length}</Text>
                      <Text style={styles.boxStatLabel}>Products</Text>
                    </View>
                    <View style={styles.boxStatItem}>
                      <Text style={styles.boxStatValue}>{(box.weight || 0).toFixed(1)}</Text>
                      <Text style={styles.boxStatLabel}>kg</Text>
                    </View>
                    <View style={styles.boxStatItem}>
                      <Text style={styles.boxStatValue}>
                        {box.products.reduce((sum, p) => sum + p.quantity, 0)}
                      </Text>
                      <Text style={styles.boxStatLabel}>Items</Text>
                    </View>
                  </View>

                  {box.products.length > 0 && (
                    <View style={styles.boxProducts}>
                      {box.products.slice(0, 3).map((bp, idx) => {
                        const product = getProductById(bp.product_id);
                        return (
                          <View key={idx} style={styles.boxProductItem}>
                            <Text style={styles.boxProductName} numberOfLines={1}>
                              {product?.name || 'Unknown'}
                            </Text>
                            <Text style={styles.boxProductQty}>×{bp.quantity}</Text>
                          </View>
                        );
                      })}
                      {box.products.length > 3 && (
                        <Text style={styles.moreProducts}>
                          +{box.products.length - 3} more products
                        </Text>
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {/* Supplier Invoices Section */}
        {shipmentInvoices.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>SUPPLIER INVOICES ({shipmentInvoices.length})</Text>
              <View style={styles.exportButtonsRow}>
                <Pressable 
                  style={styles.exportInvoicesBtn}
                  onPress={generateInvoiceMappingExcel}
                >
                  <MaterialIcons name="table-chart" size={16} color={theme.success} />
                  <Text style={[styles.exportInvoicesText, { color: theme.success }]}>Excel</Text>
                </Pressable>
                <Pressable 
                  style={styles.exportInvoicesBtn}
                  onPress={generateInvoiceMappingPDF}
                >
                  <MaterialIcons name="picture-as-pdf" size={16} color={theme.primary} />
                  <Text style={styles.exportInvoicesText}>PDF</Text>
                </Pressable>
              </View>
            </View>
            {shipmentInvoices.map(({ invoice, supplier, products: invoiceProducts }) => (
              <Pressable
                key={invoice.id}
                style={styles.invoiceCard}
                onPress={() => router.push(`/invoice/${invoice.id}`)}
              >
                <View style={styles.invoiceHeader}>
                  <View style={styles.supplierBadge}>
                    <MaterialIcons name="business" size={16} color={theme.supplier} />
                    <Text style={styles.supplierBadgeText}>{supplier.name}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                </View>

                <View style={styles.invoiceInfo}>
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Invoice #:</Text>
                    <Text style={styles.invoiceValue}>{invoice.invoice_number}</Text>
                  </View>
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Date:</Text>
                    <Text style={styles.invoiceValue}>{invoice.date}</Text>
                  </View>
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Total Amount:</Text>
                    <Text style={styles.invoiceValue}>
                      {currencySymbol} {(invoice.amount || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.productsSection}>
                  <Text style={styles.productsSectionTitle}>
                    Products in this shipment ({invoiceProducts.length}):
                  </Text>
                  {invoiceProducts.map((item, idx) => (
                    <View key={idx} style={styles.productMappingRow}>
                      <View style={styles.productDot} />
                      <Text style={styles.productMappingName} numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      <Text style={styles.productMappingQty}>×{item.quantity}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Documents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DOCUMENTS</Text>
          <View style={styles.documentsRow}>
            <Pressable 
              style={styles.documentBtn}
              onPress={() => router.push(`/packing-list?shipmentId=${shipment.id}`)}
            >
              <View style={[styles.documentIcon, { backgroundColor: theme.primaryLight }]}>
                <MaterialIcons name="list-alt" size={24} color={theme.primaryDark} />
              </View>
              <Text style={styles.documentText}>Packing List</Text>
            </Pressable>
            <Pressable 
              style={styles.documentBtn}
              onPress={() => router.push(`/generate-invoice?shipmentId=${shipment.id}`)}
            >
              <View style={[styles.documentIcon, { backgroundColor: theme.warningLight }]}>
                <MaterialIcons name="receipt" size={24} color={theme.warning} />
              </View>
              <Text style={styles.documentText}>Commercial Invoice</Text>
            </Pressable>
          </View>
          
          {/* Generate All Labels Button */}
          {shipment.boxes.length > 0 && (
            <Pressable 
              style={styles.generateAllBtn}
              onPress={handleGenerateAllLabels}
            >
              <MaterialIcons name="qr-code" size={20} color="#FFF" />
              <Text style={styles.generateAllText}>
                Generate All Box Labels ({shipment.boxes.length})
              </Text>
              <MaterialIcons name="picture-as-pdf" size={20} color="#FFF" />
            </Pressable>
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
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: theme.surface,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shipmentName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  lotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  lotText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  destText: {
    ...typography.body,
    color: theme.textSecondary,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  customerText: {
    ...typography.caption,
    color: theme.textSecondary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
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
  addBoxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addBoxText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  emptyBoxes: {
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
  boxCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  boxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  boxNumber: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxNumberText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  boxInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  boxType: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  boxDimensions: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  boxDeleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxStats: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  boxStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  boxStatValue: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  boxStatLabel: {
    ...typography.small,
    color: theme.textSecondary,
  },
  boxProducts: {
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    paddingTop: spacing.md,
  },
  boxProductItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  boxProductName: {
    ...typography.caption,
    color: theme.textSecondary,
    flex: 1,
  },
  boxProductQty: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  moreProducts: {
    ...typography.small,
    color: theme.primary,
    marginTop: spacing.xs,
  },
  documentsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  documentBtn: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  documentIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  documentText: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  generateAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  generateAllText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  invoiceCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  supplierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.supplier}15`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  supplierBadgeText: {
    ...typography.caption,
    color: theme.supplier,
    fontWeight: '600',
  },
  invoiceInfo: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  invoiceLabel: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  invoiceValue: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  productsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    paddingTop: spacing.md,
  },
  productsSectionTitle: {
    ...typography.small,
    color: theme.textSecondary,
    marginBottom: spacing.sm,
  },
  productMappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  productDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.primary,
  },
  productMappingName: {
    ...typography.caption,
    color: theme.textSecondary,
    flex: 1,
  },
  productMappingQty: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '700',
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exportInvoicesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    ...shadows.card,
  },
  exportInvoicesText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
});
