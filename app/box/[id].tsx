import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme, typography, spacing, shadows, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

export default function BoxDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, shipmentId } = useLocalSearchParams();
  const { shipments, products, getBoxTypeById, getProductById, updateBoxProducts } = useApp();

  const shipment = shipments.find(s => s.id === shipmentId);
  const box = shipment?.boxes.find(b => b.id === id);
  
  if (!box || !shipment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Box not found</Text>
      </SafeAreaView>
    );
  }

  const boxType = getBoxTypeById(box.boxTypeId);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get available products (with inventory > 0)
  const availableProducts = products.filter(p => p.availableQuantity > 0);
  const filteredProducts = availableProducts.filter(p => 
    searchQuery === '' || 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.hsCode.includes(searchQuery)
  );

  const handleAddProduct = (productId: string, qty: number) => {
    const existingIndex = box.products.findIndex(p => p.productId === productId);
    let newProducts = [...box.products];
    
    if (existingIndex >= 0) {
      newProducts[existingIndex] = {
        ...newProducts[existingIndex],
        quantity: newProducts[existingIndex].quantity + qty,
      };
    } else {
      newProducts.push({ productId, quantity: qty });
    }

    updateBoxProducts(shipment.id, box.id, newProducts);
    setShowAddProduct(false);
    setSearchQuery('');
  };

  const handleRemoveProduct = (productId: string) => {
    Alert.alert(
      'Remove Product',
      'Remove this product from the box? It will be returned to inventory.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            const newProducts = box.products.filter(p => p.productId !== productId);
            updateBoxProducts(shipment.id, box.id, newProducts);
          }
        },
      ]
    );
  };

  const handleUpdateQuantity = (productId: string, newQty: number) => {
    const product = getProductById(productId);
    const currentBoxQty = box.products.find(p => p.productId === productId)?.quantity || 0;
    const maxAvailable = (product?.availableQuantity || 0) + currentBoxQty;

    if (newQty <= 0) {
      handleRemoveProduct(productId);
      return;
    }

    if (newQty > maxAvailable) {
      Alert.alert('Insufficient Stock', `Only ${maxAvailable} items available.`);
      return;
    }

    const newProducts = box.products.map(p => 
      p.productId === productId ? { ...p, quantity: newQty } : p
    );
    updateBoxProducts(shipment.id, box.id, newProducts);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Box #{box.boxNumber}</Text>
        <Pressable 
          style={styles.labelBtn}
          onPress={() => router.push(`/box-label?shipmentId=${shipmentId}&boxId=${id}`)}
        >
          <MaterialIcons name="qr-code" size={20} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Box Info */}
        <View style={styles.boxInfoCard}>
          <View style={styles.boxHeader}>
            <View style={styles.boxIcon}>
              <MaterialIcons name="inbox" size={32} color={theme.primary} />
            </View>
            <View style={styles.boxDetails}>
              <Text style={styles.boxType}>{boxType?.name || 'Unknown'}</Text>
              <Text style={styles.boxDimensions}>
                {boxType ? `${boxType.length} × ${boxType.width} × ${boxType.height} cm` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.boxStats}>
            <View style={styles.boxStatItem}>
              <Text style={styles.boxStatValue}>{box.products.length}</Text>
              <Text style={styles.boxStatLabel}>Products</Text>
            </View>
            <View style={styles.boxStatItem}>
              <Text style={styles.boxStatValue}>
                {box.products.reduce((sum, p) => sum + p.quantity, 0)}
              </Text>
              <Text style={styles.boxStatLabel}>Items</Text>
            </View>
            <View style={styles.boxStatItem}>
              <Text style={styles.boxStatValue}>{box.netWeight.toFixed(1)}</Text>
              <Text style={styles.boxStatLabel}>Net kg</Text>
            </View>
            <View style={styles.boxStatItem}>
              <Text style={styles.boxStatValue}>{box.grossWeight.toFixed(1)}</Text>
              <Text style={styles.boxStatLabel}>Gross kg</Text>
            </View>
          </View>
        </View>

        {/* Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PRODUCTS IN BOX</Text>
            <Pressable 
              style={styles.addBtn}
              onPress={() => setShowAddProduct(true)}
            >
              <MaterialIcons name="add" size={18} color={theme.primary} />
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>

          {box.products.length === 0 ? (
            <View style={styles.emptyProducts}>
              <MaterialIcons name="inventory" size={48} color={theme.textMuted} />
              <Text style={styles.emptyText}>No products in this box</Text>
              <Pressable 
                style={styles.emptyAddBtn}
                onPress={() => setShowAddProduct(true)}
              >
                <MaterialIcons name="add" size={18} color="#FFF" />
                <Text style={styles.emptyAddBtnText}>Add Products</Text>
              </Pressable>
            </View>
          ) : (
            box.products.map(bp => {
              const product = getProductById(bp.productId);
              if (!product) return null;

              return (
                <View key={bp.productId} style={styles.productCard}>
                  <View style={styles.productInfo}>
                    <View style={styles.hsCodeBadge}>
                      <Text style={styles.hsCodeText}>{product.hsCode}</Text>
                    </View>
                    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                    <Text style={styles.productRate}>${product.rate.toFixed(2)}/{product.unit}</Text>
                  </View>
                  
                  <View style={styles.qtyControls}>
                    <Pressable 
                      style={styles.qtyBtn}
                      onPress={() => handleUpdateQuantity(bp.productId, bp.quantity - 1)}
                    >
                      <MaterialIcons name="remove" size={20} color={theme.textSecondary} />
                    </Pressable>
                    <Text style={styles.qtyValue}>{bp.quantity}</Text>
                    <Pressable 
                      style={styles.qtyBtn}
                      onPress={() => handleUpdateQuantity(bp.productId, bp.quantity + 1)}
                    >
                      <MaterialIcons name="add" size={20} color={theme.primary} />
                    </Pressable>
                  </View>

                  <Pressable 
                    style={styles.removeBtn}
                    onPress={() => handleRemoveProduct(bp.productId)}
                  >
                    <MaterialIcons name="delete-outline" size={20} color={theme.error} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        {/* Total Value */}
        {box.products.length > 0 && (
          <View style={styles.section}>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Box Value</Text>
              <Text style={styles.totalValue}>
                ${box.products.reduce((sum, bp) => {
                  const product = getProductById(bp.productId);
                  return sum + (product ? bp.quantity * product.rate : 0);
                }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Product Modal */}
      {showAddProduct && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product to Box</Text>
              <Pressable onPress={() => setShowAddProduct(false)}>
                <MaterialIcons name="close" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.productList}>
              {filteredProducts.map(product => {
                const inBox = box.products.find(p => p.productId === product.id);
                return (
                  <Pressable 
                    key={product.id} 
                    style={styles.productOption}
                    onPress={() => handleAddProduct(product.id, 1)}
                  >
                    <View style={styles.productOptionInfo}>
                      <View style={styles.hsCodeBadge}>
                        <Text style={styles.hsCodeText}>{product.hsCode}</Text>
                      </View>
                      <Text style={styles.productOptionName} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.productOptionStock}>
                        Available: {product.availableQuantity} {product.unit}
                        {inBox ? ` (${inBox.quantity} in box)` : ''}
                      </Text>
                    </View>
                    <MaterialIcons name="add-circle-outline" size={24} color={theme.primary} />
                  </Pressable>
                );
              })}
              {filteredProducts.length === 0 && (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>No products found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
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
  labelBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxInfoCard: {
    backgroundColor: theme.surface,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  boxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  boxIcon: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDetails: {
    marginLeft: spacing.md,
  },
  boxType: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  boxDimensions: {
    ...typography.caption,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  boxStats: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addBtnText: {
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
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  productInfo: {
    flex: 1,
  },
  hsCodeBadge: {
    backgroundColor: `${theme.primary}15`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  hsCodeText: {
    ...typography.small,
    color: theme.primary,
    fontWeight: '600',
  },
  productName: {
    ...typography.body,
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  productRate: {
    ...typography.small,
    color: theme.textSecondary,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  removeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCard: {
    backgroundColor: theme.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
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
    color: theme.success,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '80%',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: theme.textPrimary,
  },
  productList: {
    maxHeight: 400,
  },
  productOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  productOptionInfo: {
    flex: 1,
  },
  productOptionName: {
    ...typography.body,
    color: theme.textPrimary,
    marginTop: spacing.xs,
  },
  productOptionStock: {
    ...typography.small,
    color: theme.textSecondary,
    marginTop: 2,
  },
  noResults: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  noResultsText: {
    ...typography.body,
    color: theme.textMuted,
  },
});
