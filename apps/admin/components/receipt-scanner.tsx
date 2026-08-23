import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, Notice, StatusChip } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors, layout } from '@/constants/admin-theme';
import { formatDateTime, formatTimeRange } from '@/lib/date';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Reservation = Tables<'reservations'>;
type ReceiptPlayer = {
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  username: string;
};

const receiptPrefix = 'padel-one:reservation:';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function receiptToken(value: string) {
  const payload = value.trim();
  if (!payload.toLowerCase().startsWith(receiptPrefix)) return null;
  const token = payload.slice(receiptPrefix.length);
  return uuidPattern.test(token) ? token : null;
}

export function ReceiptScannerModal({
  onClose,
  playerById,
  timeZone,
  visible,
}: {
  onClose: () => void;
  playerById: Map<string, ReceiptPlayer>;
  timeZone: string;
  visible: boolean;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const scanLock = useRef(false);

  useEffect(() => {
    if (!visible) return;
    scanLock.current = false;
    setProcessing(false);
    setScanPaused(false);
    setTorchEnabled(false);
    setError('');
    setReservation(null);
  }, [visible]);

  async function scanReceipt(result: BarcodeScanningResult) {
    if (scanLock.current) return;
    scanLock.current = true;
    setScanPaused(true);
    setError('');

    const token = receiptToken(result.data);
    if (!token) {
      setError('This QR code is not a Padel One reservation receipt.');
      scanLock.current = false;
      return;
    }

    setProcessing(true);
    const { data, error: lookupError } = await supabase
      .from('reservations')
      .select('*')
      .eq('pass_token', token)
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
    setReservation(data);
  }

  function tryAgain() {
    scanLock.current = false;
    setError('');
    setReservation(null);
    setScanPaused(false);
  }

  const player = reservation ? playerById.get(reservation.host_id) : undefined;

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Reservation receipt</Text>
            <Text style={styles.headerTitle}>{reservation ? 'Receipt details' : 'Scan QR code'}</Text>
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
              <ReceiptRow label="Name" value={player?.full_name || player?.username || 'Player account'} />
              <ReceiptRow label="Username" value={player?.username ? `@${player.username}` : 'Not available'} />
              <ReceiptRow label="Phone" value={player?.phone_number || 'Not added'} />
              <ReceiptRow label="Email" value={player?.email || 'Not available'} />
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
        ) : permission == null ? (
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
              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable accessibilityRole="button" onPress={tryAgain}><Text style={styles.tryAgain}>Try again</Text></Pressable>
                </View>
              ) : null}
            </View>
          </View>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05070C' },
  header: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: layout.gutter,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D35',
  },
  eyebrow: { color: '#AEB8D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.6, marginTop: 4 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#454955' },
  cameraStage: { flex: 1 },
  camera: { flex: 1 },
  scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2, 5, 12, 0.24)' },
  scanFrame: { width: 254, height: 254, position: 'relative' },
  corner: { width: 42, height: 42, position: 'absolute', borderColor: colors.accent },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5 },
  cornerBottomRight: { right: 0, bottom: 0, borderRightWidth: 5, borderBottomWidth: 5 },
  scanLine: { position: 'absolute', top: '50%', left: 18, right: 18, height: 2, backgroundColor: colors.accent },
  cameraFooter: { minHeight: 178, padding: layout.gutter, gap: 15, backgroundColor: '#05070C' },
  cameraCopy: { paddingRight: 62 },
  cameraTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  cameraInstruction: { color: '#AEB1BA', fontSize: 13, lineHeight: 19, marginTop: 5 },
  torchButton: { position: 'absolute', top: 20, right: 20, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#454955' },
  torchButtonActive: { backgroundColor: colors.surface, borderColor: colors.white },
  errorCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#454955' },
  errorText: { flex: 1, color: '#FFCFD7', fontSize: 13, lineHeight: 18 },
  tryAgain: { color: colors.white, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  stateText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  permissionCard: { margin: layout.gutter, marginTop: 56, gap: 16, padding: 20, backgroundColor: colors.surface, borderLeftWidth: 6, borderLeftColor: colors.accent },
  permissionIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paleAccent },
  permissionTitle: { color: colors.text, fontSize: 23, fontWeight: '900', letterSpacing: -0.7 },
  permissionCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  receiptScroll: { flexGrow: 1, gap: 18, padding: layout.gutter, paddingBottom: 48, backgroundColor: colors.background },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: colors.text },
  verifiedIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  verifiedTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  verifiedCopy: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  passCodeBlock: { padding: 18, backgroundColor: colors.accent },
  passCodeLabel: { color: '#D8E1FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  passCode: { color: colors.white, fontSize: 34, fontWeight: '900', letterSpacing: 3, marginTop: 7 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailGroup: { borderTopWidth: 1, borderTopColor: colors.text },
  detailGroupTitle: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingVertical: 11, textTransform: 'uppercase' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 12 },
  detailLabel: { color: colors.muted, fontSize: 13 },
  detailValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  flexField: { flex: 1 },
});
