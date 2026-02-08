import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { theme, typography, spacing, borderRadius } from '../../constants/theme';

interface SavingOverlayProps {
  visible: boolean;
  message?: string;
}

export function SavingOverlay({ visible, message = 'Saving...' }: SavingOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    ...typography.body,
    color: theme.textPrimary,
    marginTop: spacing.md,
    fontWeight: '500',
  },
});
