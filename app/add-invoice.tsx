import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { theme, typography, spacing, shadows, borderRadius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { getSupabaseClient, useAuth } from '../template';

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
  products: Array<{
    name: string;
    quantity: number;
    unit: string;
    rate: number;
    hsCode: string;
  }>;
}

export default function AddInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { suppliers, addSupplier, addInvoice, addProduct, checkSimilarSupplier } = useApp();
  const supabase = getSupabaseClient();

  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [matchedSupplier, setMatchedSupplier] = useState<any>(null);
  const [similarWarning, setSimilarWarning] = useState<any>(null);

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
        setImageUri(asset.uri);
        
        if (asset.base64) {
          await processInvoiceOCR(asset.base64);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const processInvoiceOCR = async (base64: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('invoice-ocr', {
        body: { imageBase64: `data:image/jpeg;base64,${base64}` }
      });

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
        const extracted = data.data as ExtractedData;
        setExtractedData(extracted);
        
        // Check for matching supplier
        const similar = checkSimilarSupplier(extracted.supplier.name);
        if (similar) {
          setMatchedSupplier(similar);
          Alert.alert(
            'Supplier Match Found',
            `Found similar supplier: "${similar.name}". Would you like to use this supplier or create a new one?`,
            [
              { 
                text: 'Use Existing', 
                onPress: async () => {
                  setSelectedSupplier(similar.id);
                  await applyExtractedData(extracted, similar.id);
                }
              },
              { 
                text: 'Create New', 
                onPress: async () => await applyExtractedData(extracted, null) 
              },
            ]
          );
        } else {
          await applyExtractedData(extracted, null);
        }
        
        setShowReview(true);
      }
    } catch (error: any) {
      console.error('OCR error:', error);
      Alert.alert(
        'OCR Failed',
        error.message || 'Could not extract data from invoice. Please enter manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const applyExtractedData = async (extracted: ExtractedData, existingSupplierId: string | null) => {
    // Apply invoice data
    setInvoiceNumber(extracted.invoice.invoiceNumber);
    setDate(extracted.invoice.date || new Date().toISOString().split('T')[0]);
    setTotalAmount(extracted.invoice.totalAmount.toString());
    
    // If no existing supplier, create new one and set it as selected
    if (!existingSupplierId && extracted.supplier.name) {
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
    } else if (existingSupplierId) {
      setSelectedSupplier(existingSupplierId);
    }
  };

  const handleSaveWithOCR = async () => {
    if (!extractedData) {
      await handleSave();
      return;
    }

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
          image_uri: imageUri || undefined,
        }])
        .select()
        .single();

      if (invoiceError || !invoiceData) {
        throw new Error(invoiceError?.message || 'Failed to create invoice');
      }

      const invoiceId = invoiceData.id;

      // Add extracted products
      if (extractedData.products && extractedData.products.length > 0) {
        for (const product of extractedData.products) {
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

      // Refresh data to show new invoice
      Alert.alert(
        'Success',
        `Invoice created with ${extractedData.products?.length || 0} products extracted from image!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', error.message || 'Failed to save invoice');
    }
  };

  const handleSave = async () => {
    if (!selectedSupplier || !invoiceNumber.trim()) {
      return;
    }

    try {
      await addInvoice({
        supplier_id: selectedSupplier,
        invoice_number: invoiceNumber.trim(),
        date,
        payment_status: 'unpaid',
        amount: parseFloat(totalAmount) || 0,
        image_uri: imageUri || undefined,
      });

      router.back();
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', error.message || 'Failed to save invoice');
    }
  };

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
            onPress={extractedData ? handleSaveWithOCR : handleSave}
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
          
          {!imageUri ? (
            <View style={styles.uploadOptions}>
              <Pressable 
                style={styles.uploadBtn}
                onPress={() => handleImagePick('camera')}
                disabled={isProcessing}
              >
                <MaterialIcons name="camera-alt" size={32} color={theme.primary} />
                <Text style={styles.uploadBtnText}>Take Photo</Text>
              </Pressable>
              <Pressable 
                style={styles.uploadBtn}
                onPress={() => handleImagePick('library')}
                disabled={isProcessing}
              >
                <MaterialIcons name="photo-library" size={32} color={theme.primary} />
                <Text style={styles.uploadBtnText}>Choose Image</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.imagePreview}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              {isProcessing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#FFF" />
                  <Text style={styles.processingText}>Extracting data...</Text>
                </View>
              )}
              <Pressable 
                style={styles.removeImageBtn}
                onPress={() => {
                  setImageUri(null);
                  setExtractedData(null);
                  setShowReview(false);
                }}
              >
                <MaterialIcons name="close" size={20} color="#FFF" />
              </Pressable>
            </View>
          )}

          {showReview && extractedData && (
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <MaterialIcons name="check-circle" size={20} color={theme.success} />
                <Text style={styles.reviewTitle}>Data Extracted - Review & Edit</Text>
              </View>
              <Text style={styles.reviewNote}>
                {extractedData.products?.length || 0} products found. Review the data below and make any corrections before saving.
              </Text>
            </View>
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
                ? `OCR extracted ${extractedData.products?.length || 0} products. They will be added automatically when you save.`
                : 'Upload an invoice image to auto-extract supplier and product details, or enter manually.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  uploadOptions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: {
    ...typography.caption,
    color: theme.textPrimary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: 200,
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
  removeImageBtn: {
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
});
