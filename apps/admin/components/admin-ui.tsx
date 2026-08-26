// Provides reusable buttons, fields, modals, status chips, and other administrator UI building blocks.

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  type TextInputProps,
  View,
} from 'react-native';

import { Text, TextInput } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import { adminUiStyles as styles } from '@/stylesheets/admin-ui.styles';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function ActionButton({
  children,
  disabled = false,
  icon,
  onPress,
  variant = 'primary',
}: {
  children: ReactNode;
  disabled?: boolean;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'quiet' && styles.buttonQuiet,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {icon ? <Ionicons color={variant === 'primary' ? colors.onAccent : colors.accent} name={icon} size={17} /> : null}
      <Text style={[styles.buttonText, variant === 'primary' ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
      <Ionicons color={colors.accent} name={icon} size={20} />
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={[styles.input, props.multiline && styles.inputMultiline]}
        {...props}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.segmented}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected && styles.segmentSelected]}>
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function StatusChip({ children, emphasized = false }: { children: ReactNode; emphasized?: boolean }) {
  return (
    <View style={[styles.chip, emphasized && styles.chipEmphasized]}>
      <Text style={[styles.chipText, emphasized && styles.chipTextEmphasized]}>{children}</Text>
    </View>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <Ionicons color={colors.accent} name="information-circle-outline" size={19} />
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

export function EmptyState({ icon, text, title }: { icon: IconName; text: string; title: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons color={colors.accent} name={icon} size={28} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function ModalShell({
  children,
  onClose,
  title,
  visible,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <IconButton accessibilityLabel="Close" icon="close" onPress={onClose} />
        </View>
        <View style={styles.modalBody}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
