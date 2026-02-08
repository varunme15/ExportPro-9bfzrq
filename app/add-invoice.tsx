import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { getSupabaseClient, useAuth } from '../template';
import { getCurrencySymbol } from '../constants/config';
import { SavingOverlay } from '../components';

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

interface CropRegion {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AddInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { suppliers, addSupplier, addInvoice, addProduct, checkSimilarSupplier, userSettings, invoices } = useApp();
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

  // Retry functionality state
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [imageQuality, setImageQuality] = useState(0.8);
  const [lastError, setLastError] = useState<string>('');
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null);
  const maxRetries = 3;
  const [isSaving, setIsSaving] = useState(false);

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
          allowsEditing: false, // Disable default editing to use custom crop
          quality: 1, // Get highest quality initially
          base64: false,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Photo library permission is needed.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1,
          base64: false,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setOriginalImageUri(asset.uri);
        setFileUri(asset.uri);
        setFileType('image');
        setRetryCount(0);
        setImageQuality(0.8);
        
        // Get image dimensions for crop
        if (asset.width && asset.height) {
          setImageDimensions({ width: asset.width, height: asset.height });
        }
        
        await processImageWithQuality(asset.uri, 0.8);
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
        setRetryCount(0);
        setIsProcessing(true);
        
        try {
          // Read PDF as base64
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          if (!base64 || base64.length === 0) {
            throw new Error('Failed to read PDF file - empty content');
          }
          
          await processOCR(base64, 'pdf');
        } catch (readError: any) {
          console.error('PDF read error:', readError);
          setIsProcessing(false);
          Alert.alert(
            'PDF Read Error',
            readError.message || 'Could not read PDF file. Please try taking a photo of the invoice instead.',
            [
              { text: 'OK', onPress: () => resetFile() }
            ]
          );
        }
      }
    } catch (error: any) {
      console.error('PDF picker error:', error);
      Alert.alert('Error', error.message || 'Failed to pick PDF file');
    }
  };

  const processImageWithQuality = async (uri: string, quality: number, crop?: CropRegion) => {
    setIsProcessing(true);
    try {
      // Apply image manipulations
      const actions: ImageManipulator.Action[] = [];
      
      if (crop) {
        actions.push({ crop });
      }
      
      // Resize if image is too large (max 2000px on longest side)
      if (imageDimensions.width > 2000 || imageDimensions.height > 2000) {
        const scale = 2000 / Math.max(imageDimensions.width, imageDimensions.height);
        actions.push({
          resize: {
            width: Math.round(imageDimensions.width * scale),
            height: Math.round(imageDimensions.height * scale),
          }
        });
      }
      
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        actions,
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      
      setFileUri(manipResult.uri);
      
      if (manipResult.base64) {
        await processOCR(manipResult.base64, 'image');
      }
    } catch (error: any) {
      console.error('Image processing error:', error);
      handleOCRError(error.message || 'Failed to process image');
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
            // Try to parse as JSON to get the error message
            try {
              const jsonError = JSON.parse(textContent || '{}');
              errorMessage = jsonError.error || textContent || error.message || 'Unknown error';
            } catch {
              errorMessage = textContent || error.message || 'Unknown error';
            }
          } catch {
            errorMessage = `${error.message || 'Failed to read response'}`;
          }
        }
        throw new Error(errorMessage);
      }

      // Check if response contains an error field (edge function returned error)
      if (data?.error) {
        throw new Error(data.error);
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
        setRetryCount(0); // Reset retry count on success
        
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
      } else {
        throw new Error('No data extracted from document');
      }
    } catch (error: any) {
      console.error('OCR error:', error);
      handleOCRError(error.message || 'Could not extract data from file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOCRError = (errorMessage: string) => {
    setLastError(errorMessage);
    setIsProcessing(false);
    
    // For PDFs, show error alert directly since retry options don't apply
    if (fileType === 'pdf') {
      Alert.alert(
        'PDF Processing Failed',
        errorMessage,
        [
          {
            text: 'Try Image Instead',
            onPress: () => {
              resetFile();
            }
          },
          {
            text: 'Enter Manually',
            style: 'cancel'
          }
        ]
      );
      return;
    }
    
    // Auto-retry with lower quality if we haven't exceeded max retries (images only)
    if (retryCount < maxRetries && fileType === 'image' && originalImageUri) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      
      // Reduce quality progressively
      const newQuality = Math.max(0.4, imageQuality - 0.15);
      setImageQuality(newQuality);
      
      // Auto-retry with lower quality
      Alert.alert(
        'OCR Failed',
        `Attempt ${newRetryCount}/${maxRetries} failed. Retrying with adjusted settings...`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => setShowRetryModal(true)
          },
          {
            text: 'Auto-Retry',
            onPress: () => processImageWithQuality(originalImageUri, newQuality)
          },
          {
            text: 'Manual Adjust',
            onPress: () => setShowRetryModal(true)
          }
        ]
      );
    } else {
      // Show retry modal with options
      setShowRetryModal(true);
    }
  };

  const handleManualRetry = async () => {
    if (!originalImageUri) return;
    setShowRetryModal(false);
    await processImageWithQuality(originalImageUri, imageQuality, cropRegion || undefined);
  };

  const handleCropImage = () => {
    setShowRetryModal(false);
    setShowCropModal(true);
  };

  const applyCrop = (region: CropRegion) => {
    setCropRegion(region);
    setShowCropModal(false);
    if (originalImageUri) {
      processImageWithQuality(originalImageUri, imageQuality, region);
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

  // Check for duplicate invoice
  const checkDuplicateInvoice = (supplierId: string, invoiceNum: string): boolean => {
    const normalizedNum = invoiceNum.trim().toLowerCase();
    return invoices.some(inv => 
      inv.supplier_id === supplierId && 
      inv.invoice_number.toLowerCase().trim() === normalizedNum
    );
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

    // Check for duplicate invoice
    if (checkDuplicateInvoice(selectedSupplier, invoiceNumber)) {
      Alert.alert(
        'Duplicate Invoice',
        `Invoice #${invoiceNumber.trim()} already exists for this supplier. Do you want to add it anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: () => saveInvoice() }
        ]
      );
      return;
    }

    await saveInvoice();
  };

  const saveInvoice = async () => {
    if (!user?.id) return;

    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  // Show duplicate warning badge for invoice number
  const isDuplicateInvoice = selectedSupplier && invoiceNumber.trim() && checkDuplicateInvoice(selectedSupplier, invoiceNumber);

  const resetFile = () => {
    setFileUri(null);
    setOriginalImageUri(null);
    setExtractedData(null);
    setRetryCount(0);
    setImageQuality(0.8);
    setCropRegion(null);
    setLastError('');
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
                  <Text style={styles.processingText}>
                    {retryCount > 0 ? `Retrying (${retryCount}/${maxRetries})...` : 'Extracting data...'}
                  </Text>
                  {retryCount > 0 && (
                    <Text style={styles.processingSubtext}>
                      Quality: {Math.round(imageQuality * 100)}%
                    </Text>
                  )}
                </View>
              )}
              <Pressable 
                style={styles.removeFileBtn}
                onPress={resetFile}
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

          {similarWarning && selectedSupplier && (
            <View style={styles.aiExtractedBox}>
              <MaterialIcons name="smart-toy" size={18} color={theme.primary} />
              <Text style={styles.aiExtractedText}>
                AI detected: {similarWarning.name}
              </Text>
            </View>
          )}

          {/* Supplier Selection */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>SELECT SUPPLIER</Text>

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
              style={[styles.input, extractedData && styles.inputExtracted, isDuplicateInvoice && styles.inputWarning]}
              placeholder="Enter invoice number"
              placeholderTextColor={theme.textMuted}
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
            />
            {isDuplicateInvoice && (
              <View style={styles.duplicateWarningBox}>
                <MaterialIcons name="warning" size={16} color={theme.warning} />
                <Text style={styles.duplicateWarningText}>
                  This invoice number already exists for the selected supplier
                </Text>
              </View>
            )}
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

      {/* Retry Options Modal */}
      <Modal
        visible={showRetryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRetryModal(false)}
      >
        <View style={styles.retryModalOverlay}>
          <View style={styles.retryModalContent}>
            <View style={styles.retryModalHeader}>
              <MaterialIcons name="error-outline" size={32} color={theme.error} />
              <Text style={styles.retryModalTitle}>OCR Failed</Text>
            </View>
            
            <Text style={styles.retryModalError} numberOfLines={3}>
              {lastError}
            </Text>

            <View style={styles.retryAttemptInfo}>
              <Text style={styles.retryAttemptText}>
                Attempts: {retryCount}/{maxRetries}
              </Text>
            </View>

            {fileType === 'image' && (
              <>
                <Text style={styles.retryOptionLabel}>IMAGE QUALITY</Text>
                <View style={styles.qualitySliderContainer}>
                  <Text style={styles.qualityLabel}>Low</Text>
                  <View style={styles.qualityOptions}>
                    {[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(q => (
                      <Pressable
                        key={q}
                        style={[
                          styles.qualityOption,
                          imageQuality === q && styles.qualityOptionActive
                        ]}
                        onPress={() => setImageQuality(q)}
                      >
                        <Text style={[
                          styles.qualityOptionText,
                          imageQuality === q && styles.qualityOptionTextActive
                        ]}>
                          {Math.round(q * 100)}%
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.qualityLabel}>High</Text>
                </View>

                <Text style={styles.qualityHint}>
                  Lower quality may help with large or complex images
                </Text>
              </>
            )}

            <View style={styles.retryActions}>
              {fileType === 'image' && (
                <Pressable style={styles.retryActionBtn} onPress={handleCropImage}>
                  <MaterialIcons name="crop" size={20} color={theme.primary} />
                  <Text style={styles.retryActionText}>Crop Image</Text>
                </Pressable>
              )}
              
              <Pressable 
                style={[styles.retryActionBtn, styles.retryActionBtnPrimary]} 
                onPress={handleManualRetry}
              >
                <MaterialIcons name="refresh" size={20} color="#FFF" />
                <Text style={styles.retryActionTextPrimary}>Retry OCR</Text>
              </Pressable>
            </View>

            <View style={styles.retrySecondaryActions}>
              <Pressable 
                style={styles.retrySecondaryBtn}
                onPress={() => {
                  setShowRetryModal(false);
                  resetFile();
                }}
              >
                <Text style={styles.retrySecondaryText}>Choose Different File</Text>
              </Pressable>
              
              <Pressable 
                style={styles.retrySecondaryBtn}
                onPress={() => setShowRetryModal(false)}
              >
                <Text style={styles.retrySecondaryText}>Enter Manually</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Simple Crop Modal */}
      <Modal
        visible={showCropModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCropModal(false)}
      >
        <SafeAreaView style={styles.cropModalContainer}>
          <View style={styles.cropModalHeader}>
            <Pressable onPress={() => setShowCropModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.cropModalTitle}>Crop Image</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.cropContent}>
            {originalImageUri && (
              <Image 
                source={{ uri: originalImageUri }} 
                style={styles.cropPreviewImage}
                resizeMode="contain"
              />
            )}
            
            <Text style={styles.cropInstructions}>
              Select a preset crop area to focus on the invoice content
            </Text>

            <View style={styles.cropPresets}>
              <Pressable 
                style={styles.cropPresetBtn}
                onPress={() => applyCrop({
                  originX: 0,
                  originY: 0,
                  width: imageDimensions.width,
                  height: Math.round(imageDimensions.height * 0.5)
                })}
              >
                <MaterialIcons name="vertical-align-top" size={24} color={theme.primary} />
                <Text style={styles.cropPresetText}>Top Half</Text>
              </Pressable>

              <Pressable 
                style={styles.cropPresetBtn}
                onPress={() => applyCrop({
                  originX: 0,
                  originY: Math.round(imageDimensions.height * 0.5),
                  width: imageDimensions.width,
                  height: Math.round(imageDimensions.height * 0.5)
                })}
              >
                <MaterialIcons name="vertical-align-bottom" size={24} color={theme.primary} />
                <Text style={styles.cropPresetText}>Bottom Half</Text>
              </Pressable>

              <Pressable 
                style={styles.cropPresetBtn}
                onPress={() => applyCrop({
                  originX: Math.round(imageDimensions.width * 0.1),
                  originY: Math.round(imageDimensions.height * 0.1),
                  width: Math.round(imageDimensions.width * 0.8),
                  height: Math.round(imageDimensions.height * 0.8)
                })}
              >
                <MaterialIcons name="center-focus-strong" size={24} color={theme.primary} />
                <Text style={styles.cropPresetText}>Center 80%</Text>
              </Pressable>

              <Pressable 
                style={styles.cropPresetBtn}
                onPress={() => {
                  setCropRegion(null);
                  setShowCropModal(false);
                  if (originalImageUri) {
                    processImageWithQuality(originalImageUri, imageQuality);
                  }
                }}
              >
                <MaterialIcons name="fullscreen" size={24} color={theme.primary} />
                <Text style={styles.cropPresetText}>Full Image</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    <SavingOverlay visible={isSaving} message="Saving Invoice..." />
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
  processingSubtext: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
    ...typography.small,
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
  inputWarning: {
    borderWidth: 1,
    borderColor: theme.warning,
  },
  duplicateWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.warning}15`,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  duplicateWarningText: {
    ...typography.small,
    color: theme.warning,
    flex: 1,
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
  // Retry Modal Styles
  retryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  retryModalContent: {
    backgroundColor: theme.background,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.cardElevated,
  },
  retryModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  retryModalTitle: {
    ...typography.cardValue,
    color: theme.textPrimary,
    marginTop: spacing.sm,
  },
  retryModalError: {
    ...typography.caption,
    color: theme.error,
    backgroundColor: `${theme.error}10`,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  retryAttemptInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  retryAttemptText: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  retryOptionLabel: {
    ...typography.small,
    color: theme.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  qualitySliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  qualityLabel: {
    ...typography.small,
    color: theme.textMuted,
    width: 35,
  },
  qualityOptions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qualityOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: theme.backgroundSecondary,
  },
  qualityOptionActive: {
    backgroundColor: theme.primary,
  },
  qualityOptionText: {
    ...typography.small,
    color: theme.textSecondary,
  },
  qualityOptionTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  qualityHint: {
    ...typography.small,
    color: theme.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  retryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  retryActionBtnPrimary: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  retryActionText: {
    ...typography.bodyBold,
    color: theme.primary,
  },
  retryActionTextPrimary: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  retrySecondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  retrySecondaryBtn: {
    padding: spacing.sm,
  },
  retrySecondaryText: {
    ...typography.caption,
    color: theme.textSecondary,
    textDecorationLine: 'underline',
  },
  // Crop Modal Styles
  cropModalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  cropModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  cropModalTitle: {
    ...typography.bodyBold,
    color: theme.textPrimary,
  },
  cropContent: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  cropPreviewImage: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: 300,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  cropInstructions: {
    ...typography.body,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cropPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  cropPresetBtn: {
    width: (SCREEN_WIDTH - spacing.lg * 4) / 2,
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  cropPresetText: {
    ...typography.caption,
    color: theme.textPrimary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
});
