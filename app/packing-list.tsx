import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function PackingListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shipmentId } = useLocalSearchParams();
  const { shipments, getBoxTypeById, getProductById } = useApp();

  const shipment = shipments.find(s => s.id === shipmentId);
  
  if (!shipment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Shipment not found</Text>
      </SafeAreaView>
    );
  }

  const calculateTotals = () => {
    let totalNetWeight = 0;
    let totalGrossWeight = 0;
    let totalCBM = 0;
    let totalItems = 0;

    shipment.boxes.forEach(box => {
      totalNetWeight += box.netWeight;
      totalGrossWeight += box.grossWeight;
      const boxType = getBoxTypeById(box.boxTypeId);
      if (boxType) {
        totalCBM += (boxType.length * boxType.width * boxType.height) / 1000000;
      }
      box.products.forEach(bp => {
        totalItems += bp.quantity;
      });
    });

    return { totalNetWeight, totalGrossWeight, totalCBM, totalItems };
  };

  const totals = calculateTotals();

  const handleExport = () => {
    Alert.alert(
      'Export Packing List',
      'Packing list will be exported as Excel file.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => Alert.alert('Success', 'Packing list exported!') },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Packing List</Text>
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

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{shipment.boxes.length}</Text>
              <Text style={styles.summaryLabel}>Boxes</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totals.totalItems}</Text>
              <Text style={styles.summaryLabel}>Items</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totals.totalNetWeight.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Net kg</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totals.totalGrossWeight.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Gross kg</Text>
            </View>
            <View style={[styles.summaryItem, { width: '100%' }]}>
              <Text style={[styles.summaryValue, { color: theme.primary }]}>
                {totals.totalCBM.toFixed(4)} m³
              </Text>
              <Text style={styles.summaryLabel}>Total CBM</Text>
            </View>
          </View>
        </View>

        {/* Boxes Table */}
        <Text style={styles.sectionTitle}>BOX DETAILS</Text>
        
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 0.5 }]}>#</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Size (cm)</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Net kg</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Gross kg</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>CBM</Text>
        </View>

        {shipment.boxes.map(box => {
          const boxType = getBoxTypeById(box.boxTypeId);
          const cbm = boxType 
            ? ((boxType.length * boxType.width * boxType.height) / 1000000).toFixed(4)
            : '0.0000';

          return (
            <View key={box.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 0.5 }]}>{box.boxNumber}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>
                {boxType ? `${boxType.length}×${boxType.width}×${boxType.height}` : '-'}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{box.netWeight.toFixed(1)}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{box.grossWeight.toFixed(1)}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{cbm}</Text>
            </View>
          );
        })}

        {/* Table Footer */}
        <View style={styles.tableFooter}>
          <Text style={[styles.tableFooterText, { flex: 0.5 }]}>Total</Text>
          <Text style={[styles.tableFooterText, { flex: 1.5 }]}>{shipment.boxes.length} boxes</Text>
          <Text style={[styles.tableFooterText, { flex: 1 }]}>{totals.totalNetWeight.toFixed(1)}</Text>
          <Text style={[styles.tableFooterText, { flex: 1 }]}>{totals.totalGrossWeight.toFixed(1)}</Text>
          <Text style={[styles.tableFooterText, { flex: 1 }]}>{totals.totalCBM.toFixed(4)}</Text>
        </View>

        {/* Box Contents */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>BOX CONTENTS</Text>
        
        {shipment.boxes.map(box => (
          <View key={box.id} style={styles.boxContentCard}>
            <View style={styles.boxContentHeader}>
              <View style={styles.boxNumber}>
                <Text style={styles.boxNumberText}>#{box.boxNumber}</Text>
              </View>
              <Text style={styles.boxContentTitle}>
                {getBoxTypeById(box.boxTypeId)?.name || 'Unknown'}
              </Text>
            </View>
            
            {box.products.length === 0 ? (
              <Text style={styles.emptyBox}>No products</Text>
            ) : (
              box.products.map((bp, idx) => {
                const product = getProductById(bp.productId);
                return (
                  <View key={idx} style={styles.contentItem}>
                    <View style={styles.contentInfo}>
                      <Text style={styles.contentName}>{product?.name || 'Unknown'}</Text>
                      <Text style={styles.contentHS}>HS: {product?.hsCode}</Text>
                    </View>
                    <Text style={styles.contentQty}>{bp.quantity} {product?.unit}</Text>
                  </View>
                );
              })
            )}
          </View>
        ))}

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
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  summaryCard: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  summaryTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryItem: {
    width: '22%',
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.cardValue,
    color: theme.textPrimary,
  },
  summaryLabel: {
    ...typography.small,
    color: theme.textSecondary,
  },
  sectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.primary,
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
    padding: spacing.md,
  },
  tableHeaderText: {
    ...typography.small,
    color: '#FFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tableCell: {
    ...typography.caption,
    color: theme.textPrimary,
    textAlign: 'center',
  },
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    padding: spacing.md,
  },
  tableFooterText: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  boxContentCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  boxContentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  boxNumber: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  boxNumberText: {
    ...typography.small,
    color: '#FFF',
    fontWeight: '600',
  },
  boxContentTitle: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  emptyBox: {
    ...typography.caption,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  contentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  contentInfo: {
    flex: 1,
  },
  contentName: {
    ...typography.caption,
    color: theme.textPrimary,
  },
  contentHS: {
    ...typography.small,
    color: theme.textSecondary,
  },
  contentQty: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '600',
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
