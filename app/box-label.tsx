import React, { useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Share } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function BoxLabelScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shipmentId, boxId } = useLocalSearchParams();
  const { userSettings, getBoxById, shipments, getCustomerById, getBoxTypeById } = useApp();

  const shipment = shipments.find(s => s.id === shipmentId);
  const box = getBoxById(shipmentId as string, boxId as string);
  const customer = shipment?.customer_id ? getCustomerById(shipment.customer_id) : null;
  const boxType = box ? getBoxTypeById(box.box_type_id) : null;

  if (!shipment || !box) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Box not found</Text>
      </SafeAreaView>
    );
  }

  const qrData = `exp://box/${shipmentId}/${boxId}`;
  const qrCodeRef = useRef<any>(null);

  const generateLabelHTML = (shipmentData: any, boxData: any, customerData: any, boxTypeData: any, settings: any) => {
    const dimensions = boxTypeData?.dimensions || 'N/A';
    const weight = boxData.weight || 0;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .label { border: 3px solid #000; padding: 30px; max-width: 600px; margin: 0 auto; }
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
            .qr-section { text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
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
                <div class="number-value">#${boxData.box_number}</div>
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
                <span class="detail-value">${boxTypeData?.name || 'Unknown'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Dimensions:</span>
                <span class="detail-value">${dimensions}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Weight:</span>
                <span class="detail-value">${weight.toFixed(2)} kg</span>
              </div>
            </div>
            <div class="qr-section">
              <p>Scan for box details</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    try {
      const html = generateLabelHTML(shipment, box, customer, boxType, userSettings);
      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF label');
    }
  };

  const handleShare = async () => {
    try {
      const html = generateLabelHTML(shipment, box, customer, boxType, userSettings);
      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Error', 'Failed to share PDF label');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Box Label</Text>
        <Pressable style={styles.printBtn} onPress={handlePrint}>
          <MaterialIcons name="print" size={20} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Label Preview */}
        <View style={styles.labelContainer}>
          <View style={styles.label}>
            {/* Header */}
            <View style={styles.labelHeader}>
              <Text style={styles.labelTitle}>SHIPPING LABEL</Text>
            </View>

            {/* Lot & Box Numbers */}
            <View style={styles.numberSection}>
              <View style={styles.numberBox}>
                <Text style={styles.numberLabel}>LOT NUMBER</Text>
                <Text style={styles.numberValue}>{shipment.lot_number || 'N/A'}</Text>
              </View>
              <View style={styles.numberBox}>
                <Text style={styles.numberLabel}>BOX NUMBER</Text>
                <Text style={styles.numberValue}>#{box.box_number}</Text>
              </View>
            </View>

            {/* Consignor */}
            <View style={styles.partySection}>
              <View style={styles.partyHeader}>
                <MaterialIcons name="upload" size={18} color={theme.primary} />
                <Text style={styles.partyTitle}>CONSIGNOR (FROM)</Text>
              </View>
              <Text style={styles.partyName}>{userSettings.name || 'N/A'}</Text>
              <Text style={styles.partyAddress}>{userSettings.address || ''}</Text>
              <Text style={styles.partyLocation}>
                {[userSettings.city, userSettings.state, userSettings.country].filter(Boolean).join(', ')}
              </Text>
            </View>

            {/* Consignee */}
            <View style={styles.partySection}>
              <View style={styles.partyHeader}>
                <MaterialIcons name="download" size={18} color={theme.success} />
                <Text style={styles.partyTitle}>CONSIGNEE (TO)</Text>
              </View>
              {customer ? (
                <>
                  <Text style={styles.partyName}>{customer.name}</Text>
                  <Text style={styles.partyAddress}>{customer.address || ''}</Text>
                  <Text style={styles.partyLocation}>
                    {[customer.city, customer.state, customer.country].filter(Boolean).join(', ')}
                  </Text>
                </>
              ) : (
                <Text style={styles.partyName}>{shipment.destination}</Text>
              )}
            </View>

            {/* Box Details */}
            <View style={styles.detailsSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Box Type:</Text>
                <Text style={styles.detailValue}>{boxType?.name || 'Unknown'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Dimensions:</Text>
                <Text style={styles.detailValue}>
                  {boxType?.dimensions || 'N/A'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Weight:</Text>
                <Text style={styles.detailValue}>{(box.weight || 0).toFixed(2)} kg</Text>
              </View>
            </View>

            {/* QR Code */}
            <View style={styles.qrSection}>
              <QRCode
                value={qrData}
                size={120}
                backgroundColor="white"
              />
              <Text style={styles.qrText}>Scan for box details</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={handlePrint}>
            <MaterialIcons name="picture-as-pdf" size={20} color={theme.primary} />
            <Text style={styles.actionText}>Export PDF</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={handleShare}>
            <MaterialIcons name="share" size={20} color={theme.primary} />
            <Text style={styles.actionText}>Share PDF</Text>
          </Pressable>
        </View>

        <View style={styles.infoNote}>
          <MaterialIcons name="info-outline" size={18} color={theme.primary} />
          <Text style={styles.infoText}>
            Export as PDF to print on A4 or letter-size paper. Share the PDF via email, messaging apps, or save to files.
          </Text>
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
  printBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  label: {
    backgroundColor: '#FFF',
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: theme.border,
  },
  labelHeader: {
    borderBottomWidth: 3,
    borderBottomColor: theme.primary,
    paddingBottom: spacing.md,
    marginBottom: spacing.lg,
  },
  labelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  numberSection: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  numberBox: {
    flex: 1,
    backgroundColor: theme.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  numberLabel: {
    ...typography.small,
    color: theme.primaryDark,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  numberValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.primaryDark,
  },
  partySection: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  partyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  partyTitle: {
    ...typography.small,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  partyName: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  partyAddress: {
    ...typography.body,
    color: theme.textSecondary,
  },
  partyLocation: {
    ...typography.body,
    color: theme.textSecondary,
  },
  detailsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  detailValue: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  qrSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  qrText: {
    ...typography.small,
    color: theme.textSecondary,
    marginTop: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  actionText: {
    ...typography.bodyBold,
    color: theme.primary,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${theme.primary}10`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: theme.textSecondary,
    flex: 1,
  },
});
