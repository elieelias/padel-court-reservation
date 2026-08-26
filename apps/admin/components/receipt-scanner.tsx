// Scans or accepts receipt codes and displays the matching reservation receipt details.

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, Notice, StatusChip } from '@/components/admin-ui';
import { Text, TextInput } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import { formatDateTime, formatTimeRange } from '@/lib/date';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { receiptScannerStyles as styles } from '@/stylesheets/receipt-scanner.styles';

type Reservation = Tables<'reservations'>;
type ReceiptReservation = Reservation & {
  host_email: string | null;
  host_full_name: string | null;
  host_phone_number: string | null;
  host_username: string;
};

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatReceiptDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function ReceiptScannerModal({
  onClose,
  timeZone,
  visible,
}: {
  onClose: () => void;
  timeZone: string;
  visible: boolean;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [reservation, setReservation] = useState<ReceiptReservation | null>(null);
  const scanLock = useRef(false);

  useEffect(() => {
    if (!visible) return;
    scanLock.current = false;
    setProcessing(false);
    setScanPaused(false);
    setTorchEnabled(false);
    setError('');
    setManualCode('');
    setReservation(null);
  }, [visible]);

  async function lookupReceipt(receiptValue: string) {
    const lookupValue = receiptValue.trim();
    if (!lookupValue) {
      setError('Enter the backup code shown on the receipt.');
      return;
    }
    if (scanLock.current || processing) return;
    scanLock.current = true;
    setScanPaused(true);
    setError('');
    setProcessing(true);
    const { data, error: lookupError } = await supabase
      .rpc('admin_lookup_reservation_receipt', { p_receipt_value: lookupValue })
      .maybeSingle();
    setProcessing(false);

    if (lookupError) {
      setError('The receipt could not be checked. Try again.');
      scanLock.current = false;
      return;
    }
    if (!data) {
      setError('No reservation matches this receipt.');
      scanLock.current = false;
      return;
    }
    setReservation(data as ReceiptReservation);
  }

  async function scanReceipt(result: BarcodeScanningResult) {
    await lookupReceipt(result.data);
  }

  function tryAgain() {
    scanLock.current = false;
    setError('');
    setReservation(null);
    setScanPaused(false);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Reservation receipt</Text>
            <Text style={styles.headerTitle}>{reservation ? 'Receipt details' : 'Find receipt'}</Text>
          </View>
          <Pressable accessibilityLabel="Close receipt scanner" accessibilityRole="button" onPress={onClose} style={styles.headerButton}>
            <Ionicons color={colors.white} name="close" size={24} />
          </Pressable>
        </View>

        {reservation ? (
          <ScrollView contentContainerStyle={styles.receiptScroll}>
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedIcon}><Ionicons color={colors.white} name="checkmark" size={22} /></View>
              <View style={styles.flexField}>
                <Text style={styles.verifiedTitle}>Reservation found</Text>
                <Text style={styles.verifiedCopy}>These details were loaded from the court database.</Text>
              </View>
            </View>

            <View style={styles.passCodeBlock}>
              <Text style={styles.passCodeLabel}>Pass code</Text>
              <Text selectable style={styles.passCode}>{reservation.pass_code}</Text>
            </View>

            <View style={styles.chipRow}>
              <StatusChip emphasized={reservation.status === 'confirmed'}>{reservation.status}</StatusChip>
              <StatusChip emphasized={reservation.payment_status === 'unpaid'}>Cash {reservation.payment_status}</StatusChip>
            </View>

            {['cancelled', 'expired'].includes(reservation.status) ? (
              <Notice>This receipt belongs to a reservation that is no longer active.</Notice>
            ) : null}

            <ReceiptGroup title="Player">
              <ReceiptRow label="Name" value={reservation.host_full_name || reservation.host_username || 'Player account'} />
              <ReceiptRow label="Username" value={reservation.host_username ? `@${reservation.host_username}` : 'Not available'} />
              <ReceiptRow label="Phone" value={reservation.host_phone_number || 'Not added'} />
              <ReceiptRow label="Email" value={reservation.host_email || 'Not available'} />
            </ReceiptGroup>

            <ReceiptGroup title="Reservation">
              <ReceiptRow label="Date" value={formatReceiptDate(reservation.start_at, timeZone)} />
              <ReceiptRow label="Time" value={formatTimeRange(reservation.start_at, reservation.end_at, timeZone)} />
              <ReceiptRow label="Type" value={titleCase(reservation.type)} />
              <ReceiptRow label="Players" value={String(reservation.initial_player_count)} />
              <ReceiptRow label="Price" value={`$${Number(reservation.price).toFixed(2)}`} />
            </ReceiptGroup>

            <ReceiptGroup title="Cash payment">
              <ReceiptRow label="Status" value={titleCase(reservation.payment_status)} />
              <ReceiptRow label="Confirmed" value={reservation.payment_confirmed_at ? formatDateTime(reservation.payment_confirmed_at, timeZone) : 'Not received'} />
            </ReceiptGroup>

            <ActionButton icon="scan-outline" onPress={tryAgain}>Scan another receipt</ActionButton>
          </ScrollView>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.lookupStage}>
            {permission == null ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={colors.white} size="large" />
                <Text style={styles.stateText}>Checking camera access…</Text>
              </View>
            ) : !permission.granted ? (
              <View style={styles.permissionCard}>
                <View style={styles.permissionIcon}><Ionicons color={colors.accent} name="camera-outline" size={30} /></View>
                <Text style={styles.permissionTitle}>Camera access is required</Text>
                <Text style={styles.permissionCopy}>Allow camera access to scan the QR code shown on a player’s reservation receipt.</Text>
                {permission.canAskAgain ? (
                  <ActionButton icon="camera-outline" onPress={() => void requestPermission()}>Allow camera access</ActionButton>
                ) : (
                  <ActionButton icon="settings-outline" onPress={() => void Linking.openSettings()}>Open settings</ActionButton>
                )}
              </View>
            ) : (
              <View style={styles.cameraStage}>
                <CameraView
                  active={visible && !reservation}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  enableTorch={torchEnabled}
                  facing="back"
                  onBarcodeScanned={scanPaused || processing ? undefined : (result) => void scanReceipt(result)}
                  onMountError={() => {
                    scanLock.current = false;
                    setScanPaused(true);
                    setError('The camera could not be opened.');
                  }}
                  style={styles.camera}>
                  <View pointerEvents="none" style={styles.scanOverlay}>
                    <View style={styles.scanFrame}>
                      <View style={[styles.corner, styles.cornerTopLeft]} />
                      <View style={[styles.corner, styles.cornerTopRight]} />
                      <View style={[styles.corner, styles.cornerBottomLeft]} />
                      <View style={[styles.corner, styles.cornerBottomRight]} />
                      <View style={styles.scanLine} />
                    </View>
                  </View>
                </CameraView>

                <View style={styles.cameraFooter}>
                  <View style={styles.cameraCopy}>
                    <Text style={styles.cameraTitle}>{processing ? 'Checking receipt…' : 'Place the QR code inside the frame'}</Text>
                    <Text style={styles.cameraInstruction}>The reservation details will appear after the code is verified.</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={torchEnabled ? 'Turn flashlight off' : 'Turn flashlight on'}
                    accessibilityRole="button"
                    onPress={() => setTorchEnabled((value) => !value)}
                    style={[styles.torchButton, torchEnabled && styles.torchButtonActive]}>
                    <Ionicons color={torchEnabled ? colors.accent : colors.white} name={torchEnabled ? 'flash' : 'flash-outline'} size={22} />
                  </Pressable>
                </View>
              </View>
            )}

            <View style={styles.manualLookup}>
              <View style={styles.manualHeading}>
                <View style={styles.manualIcon}><Ionicons color={colors.accent} name="keypad-outline" size={20} /></View>
                <View style={styles.flexField}>
                  <Text style={styles.manualTitle}>Enter receipt code</Text>
                  <Text style={styles.manualCopy}>Use the backup code printed below the QR code.</Text>
                </View>
              </View>
              <View style={styles.manualForm}>
                <TextInput
                  accessibilityLabel="Receipt backup code"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!processing}
                  maxLength={40}
                  onChangeText={(value) => setManualCode(value.toUpperCase())}
                  onSubmitEditing={() => void lookupReceipt(manualCode)}
                  placeholder="A1B2C3D4E5"
                  placeholderTextColor="#7F8490"
                  returnKeyType="search"
                  selectionColor={colors.accent}
                  style={styles.manualInput}
                  value={manualCode}
                />
                <Pressable
                  accessibilityLabel="Find receipt"
                  accessibilityRole="button"
                  disabled={processing || !manualCode.trim()}
                  onPress={() => void lookupReceipt(manualCode)}
                  style={({ pressed }) => [styles.manualButton, pressed && styles.manualButtonPressed, (processing || !manualCode.trim()) && styles.manualButtonDisabled]}>
                  {processing ? <ActivityIndicator color={colors.onAccent} size="small" /> : <Ionicons color={colors.onAccent} name="arrow-forward" size={21} />}
                </Pressable>
              </View>
              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable accessibilityRole="button" onPress={tryAgain}><Text style={styles.tryAgain}>Try again</Text></Pressable>
                </View>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function ReceiptGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.detailGroup}>
      <Text style={styles.detailGroupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}
