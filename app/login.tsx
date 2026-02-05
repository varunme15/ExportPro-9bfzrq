import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { theme, typography, spacing, borderRadius, shadows } from '../constants/theme';

type AuthMode = 'login' | 'register' | 'forgot';

export default function LoginScreen() {
  const { signInWithPassword, signUpWithPassword, sendOTP, verifyOTPAndLogin, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleSendOTP = async () => {
    if (!email.trim()) {
      showAlert('Error', 'Please enter your email address');
      return;
    }

    if (!email.includes('@')) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password.trim() || password.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    const { error } = await sendOTP(email);
    if (error) {
      showAlert('Error', error);
      return;
    }

    setOtpSent(true);
    showAlert('Success', 'Verification code sent to your email');
  };

  const handleVerifyAndRegister = async () => {
    if (!otp.trim() || otp.length !== 4) {
      showAlert('Error', 'Please enter the 4-digit verification code');
      return;
    }

    const { error, user } = await verifyOTPAndLogin(email, otp, { password });
    if (error) {
      showAlert('Error', error);
      return;
    }

    // AuthRouter will handle navigation automatically
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Error', 'Please enter your email and password');
      return;
    }

    const { error, user } = await signInWithPassword(email, password);
    if (error) {
      showAlert('Error', error);
      return;
    }

    // AuthRouter will handle navigation automatically
  };

  const handleForgotSendOTP = async () => {
    if (!email.trim()) {
      showAlert('Error', 'Please enter your email address');
      return;
    }

    if (!email.includes('@')) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }

    const { error } = await sendOTP(email);
    if (error) {
      showAlert('Error', error);
      return;
    }

    setOtpSent(true);
    showAlert('Success', 'Password reset code sent to your email');
  };

  const handleResetPassword = async () => {
    if (!otp.trim() || otp.length !== 4) {
      showAlert('Error', 'Please enter the 4-digit verification code');
      return;
    }

    if (!newPassword.trim() || newPassword.length < 6) {
      showAlert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    const { error, user } = await verifyOTPAndLogin(email, otp, { password: newPassword });
    if (error) {
      showAlert('Error', error);
      return;
    }

    showAlert('Success', 'Password reset successfully! You are now logged in.');
    // AuthRouter will handle navigation automatically
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setOtpSent(false);
    setShowPassword(false);
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    resetForm();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo/Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <MaterialIcons name="local-shipping" size={48} color={theme.primary} />
            </View>
            <Text style={styles.appName}>ExportPro</Text>
            <Text style={styles.tagline}>Manage Your Export Business</Text>
          </View>

          {/* Auth Form */}
          <View style={styles.formContainer}>
            {/* Mode Selector (Login/Register) */}
            {mode !== 'forgot' && (
              <View style={styles.modeSelector}>
                <Pressable
                  style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
                  onPress={() => switchMode('login')}
                >
                  <Text style={[styles.modeBtnText, mode === 'login' && styles.modeBtnTextActive]}>
                    Login
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modeBtn, mode === 'register' && styles.modeBtnActive]}
                  onPress={() => switchMode('register')}
                >
                  <Text style={[styles.modeBtnText, mode === 'register' && styles.modeBtnTextActive]}>
                    Register
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Forgot Password Header */}
            {mode === 'forgot' && (
              <View style={styles.forgotHeader}>
                <Pressable style={styles.backToLogin} onPress={() => switchMode('login')}>
                  <MaterialIcons name="arrow-back" size={20} color={theme.textSecondary} />
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </Pressable>
                <Text style={styles.forgotTitle}>Reset Password</Text>
                <Text style={styles.forgotSubtitle}>
                  {otpSent 
                    ? 'Enter the verification code and your new password'
                    : 'Enter your email to receive a verification code'
                  }
                </Text>
              </View>
            )}

            {/* Email Input - Show for login, register (before OTP), forgot (before OTP) */}
            {(mode === 'login' || (mode === 'register' && !otpSent) || (mode === 'forgot' && !otpSent)) && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="email" size={20} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor={theme.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!operationLoading}
                  />
                </View>
              </View>
            )}

            {/* Password Input (Login & Register only) */}
            {mode !== 'forgot' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="lock" size={20} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter password (min 6 characters)"
                    placeholderTextColor={theme.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!otpSent && !operationLoading}
                  />
                  <Pressable 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.passwordToggle}
                  >
                    <MaterialIcons 
                      name={showPassword ? "visibility" : "visibility-off"} 
                      size={20} 
                      color={theme.textMuted} 
                    />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Confirm Password (Register only) */}
            {mode === 'register' && !otpSent && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="lock" size={20} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor={theme.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!operationLoading}
                  />
                </View>
              </View>
            )}

            {/* OTP Input (Register - after OTP sent) */}
            {mode === 'register' && otpSent && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="verified-user" size={20} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 4-digit code"
                    placeholderTextColor={theme.textMuted}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={4}
                    editable={!operationLoading}
                  />
                </View>
                <Text style={styles.inputHint}>
                  Check your email for the verification code
                </Text>
              </View>
            )}

            {/* Forgot Password - OTP and New Password Inputs */}
            {mode === 'forgot' && otpSent && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="verified-user" size={20} color={theme.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 4-digit code"
                      placeholderTextColor={theme.textMuted}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={4}
                      editable={!operationLoading}
                    />
                  </View>
                  <Text style={styles.inputHint}>
                    Code sent to {email}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="lock" size={20} color={theme.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter new password (min 6 characters)"
                      placeholderTextColor={theme.textMuted}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!operationLoading}
                    />
                    <Pressable 
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.passwordToggle}
                    >
                      <MaterialIcons 
                        name={showPassword ? "visibility" : "visibility-off"} 
                        size={20} 
                        color={theme.textMuted} 
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="lock" size={20} color={theme.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter new password"
                      placeholderTextColor={theme.textMuted}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!operationLoading}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Action Buttons */}
            {mode === 'login' ? (
              <>
                <Pressable
                  style={[styles.submitBtn, operationLoading && styles.submitBtnDisabled]}
                  onPress={handleLogin}
                  disabled={operationLoading}
                >
                  {operationLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="login" size={20} color="#FFF" />
                      <Text style={styles.submitBtnText}>Login to ExportPro</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={styles.forgotPasswordBtn}
                  onPress={() => switchMode('forgot')}
                  disabled={operationLoading}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </Pressable>
              </>
            ) : mode === 'register' ? (
              <>
                {!otpSent ? (
                  <Pressable
                    style={[styles.submitBtn, operationLoading && styles.submitBtnDisabled]}
                    onPress={handleSendOTP}
                    disabled={operationLoading}
                  >
                    {operationLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="send" size={20} color="#FFF" />
                        <Text style={styles.submitBtnText}>Send Verification Code</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      style={[styles.submitBtn, operationLoading && styles.submitBtnDisabled]}
                      onPress={handleVerifyAndRegister}
                      disabled={operationLoading}
                    >
                      {operationLoading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <>
                          <MaterialIcons name="check-circle" size={20} color="#FFF" />
                          <Text style={styles.submitBtnText}>Verify & Create Account</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.resendBtn}
                      onPress={() => setOtpSent(false)}
                      disabled={operationLoading}
                    >
                      <Text style={styles.resendBtnText}>Resend Code</Text>
                    </Pressable>
                  </>
                )}
              </>
            ) : (
              /* Forgot Password Mode */
              <>
                {!otpSent ? (
                  <Pressable
                    style={[styles.submitBtn, operationLoading && styles.submitBtnDisabled]}
                    onPress={handleForgotSendOTP}
                    disabled={operationLoading}
                  >
                    {operationLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="send" size={20} color="#FFF" />
                        <Text style={styles.submitBtnText}>Send Reset Code</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      style={[styles.submitBtn, operationLoading && styles.submitBtnDisabled]}
                      onPress={handleResetPassword}
                      disabled={operationLoading}
                    >
                      {operationLoading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <>
                          <MaterialIcons name="lock-reset" size={20} color="#FFF" />
                          <Text style={styles.submitBtnText}>Reset Password</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.resendBtn}
                      onPress={() => setOtpSent(false)}
                      disabled={operationLoading}
                    >
                      <Text style={styles.resendBtnText}>Change Email</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {/* Features List - Only show for login/register */}
            {mode !== 'forgot' && (
              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>
                  {mode === 'login' ? 'Welcome Back!' : 'Start Your Free Trial'}
                </Text>
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="check-circle" size={16} color={theme.success} />
                    <Text style={styles.featureText}>Manage suppliers & invoices</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="check-circle" size={16} color={theme.success} />
                    <Text style={styles.featureText}>Track inventory & shipments</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="check-circle" size={16} color={theme.success} />
                    <Text style={styles.featureText}>AI-powered invoice scanning</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="check-circle" size={16} color={theme.success} />
                    <Text style={styles.featureText}>Generate professional documents</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginVertical: spacing.xl * 2,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.xl,
    backgroundColor: `${theme.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.body,
    color: theme.textSecondary,
  },
  formContainer: {
    flex: 1,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.xl,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  modeBtnActive: {
    backgroundColor: theme.primary,
  },
  modeBtnText: {
    ...typography.bodyBold,
    color: theme.textSecondary,
  },
  modeBtnTextActive: {
    color: '#FFF',
  },
  forgotHeader: {
    marginBottom: spacing.xl,
  },
  backToLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  backToLoginText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  forgotTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  forgotSubtitle: {
    ...typography.body,
    color: theme.textSecondary,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.caption,
    color: theme.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  inputIcon: {
    marginLeft: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: theme.textPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  passwordToggle: {
    padding: spacing.md,
  },
  inputHint: {
    ...typography.small,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
    ...shadows.button,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    ...typography.bodyBold,
    color: '#FFF',
    fontSize: 16,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  resendBtnText: {
    ...typography.caption,
    color: theme.primary,
    fontWeight: '600',
  },
  forgotPasswordBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  forgotPasswordText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  featuresContainer: {
    marginTop: spacing.xl * 2,
    padding: spacing.lg,
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    ...shadows.card,
  },
  featuresTitle: {
    ...typography.bodyBold,
    color: theme.textPrimary,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  featuresList: {
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.caption,
    color: theme.textSecondary,
  },
});
