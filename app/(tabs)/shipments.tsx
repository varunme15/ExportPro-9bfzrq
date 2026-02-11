import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, RefreshControl, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';


export default function ShipmentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shipments, getBoxTypeById, refreshData, checkShipmentLimit } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const shipmentCheck = checkShipmentLimit();

  const filteredShipments = searchQuery
    ? shipments.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.destination.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shipments;

  const getShipmentStatusText = (shipment: typeof shipments[0]) => {
    const boxCount = shipment.boxes?.length || 0;
    if (boxCount === 0) return 'Draft';
    return `${boxCount} Box${boxCount !== 1 ? 'es' : ''}`;
  };

  const getShipmentStatusColor = (shipment: typeof shipments[0]) => {
    const boxCount = shipment.boxes?.length || 0;
    if (boxCount === 0) return theme.textSecondary;
    return theme.success;
  };

  const calculateShipmentStats = (shipment: typeof shipments[0]) => {
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

  const renderShipment = ({ item }: { item: typeof shipments[0] }) => {
    const stats = calculateShipmentStats(item);
    const statusText = getShipmentStatusText(item);
    const statusColor = getShipmentStatusColor(item);
    const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';

    return (
      <Pressable 
        style={styles.shipmentCard}
        onPress={() => router.push(`/shipment/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>
          <Text style={styles.dateText}>{createdDate}</Text>
        </View>

        <Text style={styles.shipmentName}>{item.name}</Text>
        <View style={styles.destRow}>
          <MaterialIcons name="place" size={16} color={theme.textSecondary} />
          <Text style={styles.destText}>{item.destination}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialIcons name="inventory-2" size={18} color={theme.primary} />
            <Text style={styles.statValue}>{item.boxes.length}</Text>
            <Text style={styles.statLabel}>Boxes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialIcons name="straighten" size={18} color={theme.inventory} />
            <Text style={styles.statValue}>{stats.totalCBM.toFixed(2)}</Text>
            <Text style={styles.statLabel}>CBM</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialIcons name="fitness-center" size={18} color={theme.shipment} />
            <Text style={styles.statValue}>{stats.totalWeight.toFixed(1)}</Text>
            <Text style={styles.statLabel}>kg</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.itemCount}>{stats.totalItems} items packed</Text>
          <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shipments</Text>
        <Pressable style={[styles.addBtn, !shipmentCheck.allowed && { backgroundColor: theme.textMuted }]} onPress={() => {
          if (!shipmentCheck.allowed) {
            Alert.alert('Shipment Limit', shipmentCheck.message || 'Limit reached');
            return;
          }
          router.push('/add-shipment');
        }}>
          <MaterialIcons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search shipments..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <Pressable onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={20} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Shipments List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredShipments}
          renderItem={renderShipment}
          estimatedItemSize={220}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="local-shipping" size={48} color={theme.textMuted} />
              <Text style={styles.emptyText}>No shipments yet</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/add-shipment')}>
                <Text style={styles.emptyBtnText}>Create Shipment</Text>
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
    gap: spacing.sm,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: theme.textPrimary,
  },
  listContainer: {
    flex: 1,
  },
  shipmentCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
  },
  dateText: {
    ...typography.caption,
    color: theme.textMuted,
  },
  shipmentName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  destText: {
    ...typography.body,
    color: theme.textSecondary,
  },
  statsRow: {
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
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
