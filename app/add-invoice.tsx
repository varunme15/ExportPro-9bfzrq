import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { getSupabaseClient, useAuth } from '../template';
import { getCurrencySymbol } from '../constants/config';

interface ExtractedProduct {
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  hsCode: string;
  selected: boolean;
}

interface ExtractedData {
  supplier: {
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    country: string;
  };
  invoice: {
    invoiceNumber: string;
    date: string;
    totalAmount: number;
  };
  products: ExtractedProduct[];
}

export default function AddInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { suppliers, addSupplier, addInvoice, addProduct, checkSimilarSupplier, userSettings } = useApp();
  const supabase = getSupabaseClient();
  const currencySymbol = getCurrencySymbol(userSettings.currency);

  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState('');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf'>('image');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [matchedSupplier, setMatchedSupplier] = useState<any>(null);
  const [similarWarning, setSimilarWarning] = useState<any>(null);
  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);

  const handleImagePick = async (source: 'camera' | 'library') => {
    try {
      let result;
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Photo library permission is needed.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setFileUri(asset.uri);
        setFileType('image');
        
        if (asset.base64) {
          await processOCR(asset.base64, 'image');
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handlePdfPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setFileUri(asset.uri);
        setFileType('pdf');
        
        // Read PDF as base64
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        await processOCR(base64, 'pdf');
      }
    } catch (error) {
      console.error('PDF picker error:', error);
      Alert.alert('Error', 'Failed to pick PDF file');
    }
  };

  const processOCR = async (base64: string, type: 'image' | 'pdf') => {
    setIsProcessing(true);
    try {
      const body = type === 'pdf' 
        ? { pdfBase64: base64, fileType: 'pdf' }
        : { imageBase64: `data:image/jpeg;base64,${base64}`, fileType: 'image' };

      const { data, error } = await supabase.functions.invoke('invoice-ocr', { body });

      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const statusCode = error.context?.status ?? 500;
            const textContent = await error.context?.text();
            errorMessage = `[Code: ${statusCode}] ${textContent || error.message || 'Unknown error'}`;
          } catch {
            errorMessage = `${error.message || 'Failed to read response'}`;
          }
        }
        throw new Error(errorMessage);
      }

      if (data?.data) {
        const extracted = data.data;
        // Add selected flag to products
        const productsWithSelection = extracted.products.map((p: any) => ({
          ...p,
          selected: true,
        }));
        
        const extractedWithSelection: ExtractedData = {
          ...extracted,
          products: productsWithSelection,
        };
        
        setExtractedData(extractedWithSelection);
        
        // Check for matching supplier
        const similar = checkSimilarSupplier(extracted.supplier.name);
        if (similar) {
          setMatchedSupplier(similar);
          setSelectedSupplier(similar.id);
        }
        
        // Apply invoice data
        setInvoiceNumber(extracted.invoice.invoiceNumber);
        setDate(extracted.invoice.date || new Date().toISOString().split('T')[0]);
        setTotalAmount(extracted.invoice.totalAmount.toString());
        
        // If no existing supplier, create new one
        if (!similar && extracted.supplier.name) {
          const newSupplier = {
            name: extracted.supplier.name,
            contact: extracted.supplier.contactPerson || '',
            email: extracted.supplier.email || '',
            phone: extracted.supplier.phone || '',
            address: extracted.supplier.address || '',
          };
          
          const newSupplierId = await addSupplier(newSupplier);
          setSelectedSupplier(newSupplierId);
          setSimilarWarning(extracted.supplier);
        }
        
        // Show review modal
        setShowReviewModal(true);
      }
    } catch (error: any) {
      console.error('OCR error:', error);
      Alert.alert(
        'OCR Failed',
        error.message || 'Could not extract data from file. Please enter manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleProductSelection = (index: number) => {
    if (!extractedData) return;
    const newProducts = [...extractedData.products];
    newProducts[index] = { ...newProducts[index], selected: !newProducts[index].selected };
    setExtractedData({ ...extractedData, products: newProducts });
  };

  const updateProduct = (index: number, field: keyof ExtractedProduct, value: string | number) => {
    if (!extractedData) return;
    const newProducts = [...extractedData.products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setExtractedData({ ...extractedData, products: newProducts });
  };

  const removeProduct = (index: number) => {
    if (!extractedData) return;
    const newProducts = extractedData.products.filter((_, i) => i !== index);
    setExtractedData({ ...extractedData, products: newProducts });
  };

  const addNewProduct = () => {
    if (!extractedData) return;
    const newProduct: ExtractedProduct = {
      name: '',
      quantity: 1,
      unit: 'pcs',
      rate: 0,
      hsCode: '',
      selected: true,
    };
    setExtractedData({ ...extractedData, products: [...extractedData.products, newProduct] });
    setEditingProductIndex(extractedData.products.length);
  };

  const handleConfirmReview = () => {
    setShowReviewModal(false);
  };

  const handleSave = async () => {
    if (!selectedSupplier || !invoiceNumber.trim()) {
      Alert.alert('Missing Data', 'Please select a supplier and enter invoice number');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      // Create invoice first and get its ID
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          user_id: user.id,
          supplier_id: selectedSupplier,
          invoice_number: invoiceNumber.trim(),
          date,
          payment_status: 'unpaid',
          amount: parseFloat(totalAmount) || 0,
          image_uri: fileUri || undefined,
        }])
        .select()
        .single();

      if (invoiceError || !invoiceData) {
        throw new Error(invoiceError?.message || 'Failed to create invoice');
      }

      const invoiceId = invoiceData.id;

      // Add extracted products (only selected ones)
      if (extractedData?.products && extractedData.products.length > 0) {
        const selectedProducts = extractedData.products.filter(p => p.selected);
        for (const product of selectedProducts) {
          if (product.name.trim()) {
            await addProduct({
              invoice_id: invoiceId,
              name: product.name,
              quantity: product.quantity,
              unit: product.unit || 'pcs',
              rate: product.rate,
              hs_code: product.hsCode || '',
              alternate_names: [],
            });
          }
        }
        
        Alert.alert(
          'Success',
          `Invoice created with ${selectedProducts.length} products!`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Success', 'Invoice created!', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', error.message || 'Failed to save invoice');
    }
  };

  const selectedProductCount = extractedData?.products.filter(p => p.selected).length || 0;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Add Invoice</Text>
          <Pressable 
            style={[styles.saveBtn, (!selectedSupplier || !invoiceNumber.trim()) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!selectedSupplier || !invoiceNumber.trim()}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* OCR Upload Section */}
          <Text style={styles.sectionTitle}>SCAN INVOICE (OPTIONAL)</Text>
          
          {!fileUri ? (
            <View style={styles.uploadSection}>
              <View style={styles.uploadOptions}>
                <Pressable 
                  style={styles.uploadBtn}
                  onPress={() => handleImagePick('camera')}
                  disabled={isProcessing}
                >
                  <MaterialIcons name="camera-alt" size={28} color={theme.primary} />
                  <Text style={styles.uploadBtnText}>Camera</Text>
                </Pressable>
                <Pressable 
                  style={styles.uploadBtn}
                  onPress={() => handleImagePick('library')}
                  disabled={isProcessing}
                >
                  <MaterialIcons name="photo-library" size={28} color={theme.primary} />
                  <Text style={styles.uploadBtnText}>Gallery</Text>
                </Pressable>
                <Pressable 
                  style={styles.uploadBtn}
                  onPress={handlePdfPick}
                  disabled={isProcessing}
                >
                  <MaterialIcons name="picture-as-pdf" size={28} color={theme.error} />
                  <Text style={styles.uploadBtnText}>PDF</Text>
                </Pressable>
              </View>
              <Text style={styles.uploadHint}>Supports images (JPG, PNG) and PDF documents</Text>
            </View>
          ) : (
            <View style={styles.filePreview}>
              {fileType === 'image' ? (
                <Image source={{ uri: fileUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.pdfPreview}>
                  <MaterialIcons name="picture-as-pdf" size={48} color={theme.error} />
                  <Text style={styles.pdfText}>PDF Document</Text>
                </View>
              )}
              {isProcessing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#FFF" />
                  <Text style={styles.processingText}>Extracting data...</Text>
                </View>
              )}
              <Pressable 
                style={styles.removeFileBtn}
                onPress={() => {
                  setFileUri(null);
                  setExtractedData(null);
                }}
              >
                <MaterialIcons name="close" size={20} color="#FFF" />
              </Pressable>
            </View>
          )}

          {extractedData && (
            <Pressable style={styles.reviewCard} onPress={() => setShowReviewModal(true)}>
              <View style={styles.reviewHeader}>
                <MaterialIcons name="check-circle" size={20} color={theme.success} />
                <Text style={styles.reviewTitle}>Data Extracted</Text>
              </View>
              <Text style={styles.reviewNote}>
                {selectedProductCount} of {extractedData.products.length} products selected
              </Text>
              <View style={styles.reviewAction}>
                <Text style={styles.reviewActionText}>Tap to review & edit</Text>
                <MaterialIcons name="chevron-right" size={20} color={theme.primary} />
              </View>
            </Pressable>
          )}

          {/* Supplier Selection */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>SELECT SUPPLIER</Text>
          
          {similarWarning && selectedSupplier && (
            <View style={styles.aiExtractedBox}>
              <MaterialIcons name="smart-toy" size={18} color={theme.primary} />
              <Text style={styles.aiExtractedText}>
                AI detected: {similarWarning.name}
              </Text>
            </View>
          )}

          {matchedSupplier && (
            <View style={styles.matchedSupplierBox}>
              <MaterialIcons name="link" size={18} color={theme.success} />
              <Text style={styles.matchedSupplierText}>
                Matched to existing: {matchedSupplier.name}
              </Text>
            </View>
          )}

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.supplierScroll}
          >
            {suppliers.map(supplier => (
              <Pressable
                key={supplier.id}
                style={[
                  styles.supplierCard,
                  selectedSupplier === supplier.id && styles.supplierCardActive
                ]}
                onPress={() => setSelectedSupplier(supplier.id)}
              >
                <View style={styles.supplierIcon}>
                  <MaterialIcons 
                    name="business" 
                    size={20} 
                    color={selectedSupplier === supplier.id ? '#FFF' : theme.supplier} 
                  />
                </View>
                <Text 
                  style={[
                    styles.supplierName,
                    selectedSupplier === supplier.id && styles.supplierNameActive
                  ]}
                  numberOfLines={2}
                >
                  {supplier.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Invoice Details */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>INVOICE DETAILS</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Invoice Number *</Text>
            <TextInput
              style={[styles.input, extractedData && styles.inputExtracted]}
              placeholder="Enter invoice number"
              placeholderTextColor={theme.textMuted}
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={[styles.input, extractedData && styles.inputExtracted]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textMuted}
              value={date}
              onChangeText={setDate}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Total Amount</Text>
            <TextInput
              style={[styles.input, extractedData && styles.inputExtracted]}
              placeholder="0.00"
              placeholderTextColor={theme.textMuted}
              value={totalAmount}
              onChangeText={setTotalAmount}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <MaterialIcons name="info-outline" size={18} color={theme.primary} />
            <Text style={styles.infoText}>
              {extractedData 
                ? `${selectedProductCount} products will be added. Tap the review card above to edit.`
                : 'Upload an invoice image or PDF to auto-extract data, or enter manually.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowReviewModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>Review Extracted Data</Text>
            <Pressable style={styles.modalConfirmBtn} onPress={handleConfirmReview}>
              <Text style={styles.modalConfirmText}>Done</Text>
            </Pressable>
          </View>

          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Supplier Info */}
            {extractedData?.supplier && (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>SUPPLIER INFORMATION</Text>
                <View style={styles.supplierInfoCard}>
                  <View style={styles.supplierInfoRow}>
                    <MaterialIcons name="business" size={18} color={theme.textSecondary} />
                    <Text style={styles.supplierInfoText}>{extractedData.supplier.name || 'N/A'}</Text>
                  </View>
                  {extractedData.supplier.email && (
                    <View style={styles.supplierInfoRow}>
                      <MaterialIcons name="email" size={18} color={theme.textSecondary} />
                      <Text style={styles.supplierInfoText}>{extractedData.supplier.email}</Text>
                    </View>
                  )}
                  {extractedData.supplier.phone && (
                    <View style={styles.supplierInfoRow}>
                      <MaterialIcons name="phone" size={18} color={theme.textSecondary} />
                      <Text style={styles.supplierInfoText}>{extractedData.supplier.phone}</Text>
                    </View>
                  )}
                  {extractedData.supplier.country && (
                    <View style={styles.supplierInfoRow}>
                      <MaterialIcons name="place" size={18} color={theme.textSecondary} />
                      <Text style={styles.supplierInfoText}>{extractedData.supplier.country}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Invoice Info */}
            {extractedData?.invoice && (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>INVOICE DETAILS</Text>
                <View style={styles.invoiceInfoCard}>
                  <View style={styles.invoiceInfoRow}>
                    <Text style={styles.invoiceInfoLabel}>Invoice #</Text>
                    <Text style={styles.invoiceInfoValue}>{extractedData.invoice.invoiceNumber}</Text>
                  </View>
                  <View style={styles.invoiceInfoRow}>
                    <Text style={styles.invoiceInfoLabel}>Date</Text>
                    <Text style={styles.invoiceInfoValue}>{extractedData.invoice.date}</Text>
                  </View>
                  <View style={styles.invoiceInfoRow}>
                    <Text style={styles.invoiceInfoLabel}>Total</Text>
                    <Text style={[styles.invoiceInfoValue, { color: theme.success }]}>
                      {currencySymbol}{extractedData.invoice.totalAmount.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Products */}
            <View style={styles.reviewSection}>
              <View style={styles.productsSectionHeader}>
                <Text style={styles.reviewSectionTitle}>
                  PRODUCTS ({selectedProductCount}/{extractedData?.products.length || 0})
                </Text>
                <Pressable style={styles.addProductBtn} onPress={addNewProduct}>
                  <MaterialIcons name="add" size={18} color={theme.primary} />
                  <Text style={styles.addProductBtnText}>Add</Text>
                </Pressable>
              </View>

              {extractedData?.products.map((product, index) => (
                <View key={index} style={styles.productReviewCard}>
                  {editingProductIndex === index ? (
                    // Edit mode
                    <View style={styles.productEditForm}>
                      <View style={styles.productEditRow}>
                        <Text style={styles.productEditLabel}>Name</Text>
                        <TextInput
                          style={styles.productEditInput}
                          value={product.name}
                          onChangeText={(v) => updateProduct(index, 'name', v)}
                          placeholder="Product name"
                          placeholderTextColor={theme.textMuted}
                        />
                      </View>
                      <View style={styles.productEditRowDouble}>
                        <View style={styles.productEditHalf}>
                          <Text style={styles.productEditLabel}>Quantity</Text>
                          <TextInput
                            style={styles.productEditInput}
                            value={product.quantity.toString()}
                            onChangeText={(v) => updateProduct(index, 'quantity', parseFloat(v) || 0)}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View style={styles.productEditHalf}>
                          <Text style={styles.productEditLabel}>Unit</Text>
                          <TextInput
                            style={styles.productEditInput}
                            value={product.unit}
                            onChangeText={(v) => updateProduct(index, 'unit', v)}
                          />
                        </View>
                      </View>
                      <View style={styles.productEditRowDouble}>
                        <View style={styles.productEditHalf}>
                          <Text style={styles.productEditLabel}>Rate</Text>
                          <TextInput
                            style={styles.productEditInput}
                            value={product.rate.toString()}
                            onChangeText={(v) => updateProduct(index, 'rate', parseFloat(v) || 0)}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View style={styles.productEditHalf}>
                          <Text style={styles.productEditLabel}>HS Code</Text>
                          <TextInput
                            style={styles.productEditInput}
                            value={product.hsCode}
                            onChangeText={(v) => updateProduct(index, 'hsCode', v)}
                          />
                        </View>
                      </View>
                      <Pressable 
                        style={styles.doneEditBtn}
                        onPress={() => setEditingProductIndex(null)}
                      >
                        <Text style={styles.doneEditText}>Done</Text>
                      </Pressable>
                    </View>
                  ) : (
                    // View mode
                    <>
                      <Pressable 
                        style={styles.productCheckbox}
                        onPress={() => toggleProductSelection(index)}
                      >
                        <MaterialIcons 
                          name={product.selected ? "check-box" : "check-box-outline-blank"} 
                          size={24} 
                          color={product.selected ? theme.primary : theme.textMuted} 
                        />
                      </Pressable>
                      <Pressable 
                        style={[styles.productInfo, !product.selected && styles.productInfoDisabled]}
                        onPress={() => setEditingProductIndex(index)}
                      >
                        <View style={styles.productMainRow}>
                          {product.hsCode && (
                            <View style={styles.hsCodeBadge}>
                              <Text style={styles.hsCodeText}>{product.hsCode}</Text>
                            </View>
                          )}
                          <Text style={styles.productName} numberOfLines={2}>{product.name || 'Unnamed'}</Text>
                        </View>
                        <View style={styles.productDetailsRow}>
                          <Text style={styles.productDetail}>
                            {product.quantity} {product.unit}
                          </Text>
                          <Text style={styles.productDetail}>×</Text>
                          <Text style={styles.productDetail}>
                            {currencySymbol}{product.rate.toFixed(2)}
                          </Text>
                          <Text style={styles.productTotal}>
                            = {currencySymbol}{(product.quantity * product.rate).toFixed(2)}
                          </Text>
                        </View>
                      </Pressable>
                      <View style={styles.productActions}>
                        <Pressable 
                          style={styles.productActionBtn}
                          onPress={() => setEditingProductIndex(index)}
                        >
                          <MaterialIcons name="edit" size={18} color={theme.textSecondary} />
                        </Pressable>
                        <Pressable 
                          style={styles.productActionBtn}
                          onPress={() => removeProduct(index)}
                        >
                          <MaterialIcons name="delete" size={18} color={theme.error} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              ))}

              {(!extractedData?.products || extractedData.products.length === 0) && (
                <View style={styles.noProducts}>
                  <MaterialIcons name="inventory" size={40} color={theme.textMuted} />
                  <Text style={styles.noProductsText}>No products extracted</Text>
                  <Pressable style={styles.addFirstProductBtn} onPress={addNewProduct}>
                    <MaterialIcons name="add" size={18} color="#FFF" />
                    <Text style={styles.addFirstProductText}>Add Product</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Summary */}
            {extractedData?.products && extractedData.products.length > 0 && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Selected Products</Text>
                  <Text style={styles.summaryValue}>{selectedProductCount}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Quantity</Text>
                  <Text style={styles.summaryValue}>
                    {extractedData.products
                      .filter(p => p.selected)
                      .reduce((sum, p) => sum + p.quantity, 0)
                      .toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Total Value</Text>
                  <Text style={styles.summaryTotalValue}>
                    {currencySymbol}{extractedData.products
                      .filter(p => p.selected)
                      .reduce((sum, p) => sum + (p.quantity * p.rate), 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  saveBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  saveBtnDisabled: {
    backgroundColor: theme.border,
  },
  saveBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  sectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
  },
  uploadSection: {
    marginBottom: spacing.lg,
  },
  uploadOptions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: {
    ...typography.small,
    color: theme.textPrimary,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  uploadHint: {
    ...typography.small,
    color: theme.textMuted,
    textAlign: 'center',
  },
  filePreview: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pdfPreview: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfText: {
    ...typography.caption,
    color: theme.textSecondary,
    marginTop: spacing.sm,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: '#FFF',
    marginTop: spacing.md,
    ...typography.body,
  },
  removeFileBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCard: {
    backgroundColor: `${theme.success}15`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  reviewTitle: {
    ...typography.bodyBold,
    color: theme.success,
  },
  reviewNote: {
    ...typography.caption,
    color: theme.textSecondary,
    marginBottom: spacing.sm,
  },
  reviewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  reviewActionText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  aiExtractedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.primary}15`,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  aiExtractedText: {
    ...typography.caption,
    color: theme.primary,
    flex: 1,
  },
  matchedSupplierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.success}15`,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  matchedSupplierText: {
    ...typography.caption,
    color: theme.success,
    flex: 1,
  },
  supplierScroll: {
    marginBottom: spacing.md,
  },
  supplierCard: {
    width: 120,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginRight: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  supplierCardActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primaryDark,
  },
  supplierIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: `${theme.supplier}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  supplierName: {
    ...typography.small,
    color: theme.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
  },
  supplierNameActive: {
    color: '#FFF',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
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
  inputExtracted: {
    borderWidth: 1,
    borderColor: theme.success,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${theme.primary}10`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: theme.textSecondary,
    flex: 1,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  modalConfirmBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalConfirmText: {
    ...typography.bodyBold,
    color: theme.primary,
  },
  reviewSection: {
    marginBottom: spacing.xl,
  },
  reviewSectionTitle: {
    ...typography.sectionHeader,
    color: theme.textSecondary,
    marginBottom: spacing.md,
  },
  supplierInfoCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  supplierInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  supplierInfoText: {
    ...typography.body,
    color: theme.textPrimary,
    flex: 1,
  },
  invoiceInfoCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  invoiceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  invoiceInfoLabel: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  invoiceInfoValue: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  productsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addProductBtnText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  productReviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  productCheckbox: {
    marginRight: spacing.sm,
  },
  productInfo: {
    flex: 1,
  },
  productInfoDisabled: {
    opacity: 0.5,
  },
  productMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
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
  productName: {
    ...typography.body,
    color: theme.textPrimary,
    flex: 1,
  },
  productDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  productDetail: {
    ...typography.small,
    color: theme.textSecondary,
  },
  productTotal: {
    ...typography.small,
    color: theme.success,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  productActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  productActionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productEditForm: {
    flex: 1,
  },
  productEditRow: {
    marginBottom: spacing.sm,
  },
  productEditRowDouble: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  productEditHalf: {
    flex: 1,
  },
  productEditLabel: {
    ...typography.small,
    color: theme.textSecondary,
    marginBottom: spacing.xs,
  },
  productEditInput: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.caption,
    color: theme.textPrimary,
  },
  doneEditBtn: {
    backgroundColor: theme.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  doneEditText: {
    ...typography.caption,
    color: '#FFF',
    fontWeight: '600',
  },
  noProducts: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  noProductsText: {
    ...typography.body,
    color: theme.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  addFirstProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  addFirstProductText: {
    ...typography.bodyBold,
    color: '#FFF',
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
  summaryTotal: {
    borderBottomWidth: 0,
    paddingTop: spacing.md,
  },
  summaryTotalLabel: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.success,
  },
});
