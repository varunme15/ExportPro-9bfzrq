import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme, typography, spacing, borderRadius, shadows } from '../../constants/theme';

interface UpgradeBannerProps {
  message: string;
  currentCount?: number;
  limit?: number;
  resourceType?: string;
}

export function UpgradeBanner({ message, currentCount, limit, resourceType }: UpgradeBannerProps) {
  return (
    <View style={styles.banner}>
      <View style={styles.iconContainer}>
        <MaterialIcons name="lock" size={18} color={theme.warning} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.message}>{message}</Text>
        {currentCount !== undefined && limit !== undefined ? (
          <Text style={styles.countText}>
            {currentCount}/{limit} {resourceType || 'items'} used
          </Text>
        ) : null}
      </View>
      <View style={styles.upgradeBadge}>
        <Text style={styles.upgradeText}>PRO</Text>
      </View>
    </View>
  );
}

interface LimitModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  currentCount?: number;
  limit?: number;
}

export function LimitReachedModal({ visible, onClose, title, message, currentCount, limit }: LimitModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalIcon}>
            <MaterialIcons name="lock-outline" size={40} color={theme.warning} />
          </View>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          {currentCount !== undefined && limit !== undefined ? (
            <View style={styles.limitBar}>
              <View style={styles.limitBarFill}>
                <View
                  style={[
                    styles.limitBarProgress,
                    { width: `${Math.min(100, (currentCount / limit) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.limitBarText}>{currentCount}/{limit}</Text>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCloseBtn} onPress={onClose}>
              <Text style={styles.modalCloseBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.warning}15`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: `${theme.warning}30`,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '500',
  },
  countText: {
    ...typography.small,
    color: theme.textSecondary,
    marginTop: 2,
  },
  upgradeBadge: {
    backgroundColor: theme.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  upgradeText: {
    ...typography.small,
    color: '#FFF',
    fontWeight: '700',
    fontSize: 10,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.background,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...shadows.cardElevated,
  },
  modalIcon: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    backgroundColor: `${theme.warning}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalMessage: {
    ...typography.body,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  limitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  limitBarFill: {
    flex: 1,
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  limitBarProgress: {
    height: '100%',
    backgroundColor: theme.warning,
    borderRadius: 4,
  },
  limitBarText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  modalActions: {
    width: '100%',
  },
  modalCloseBtn: {
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
});
