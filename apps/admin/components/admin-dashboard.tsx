// Composes the main administrator dashboard and switches between its feature tabs.

import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

import { IconButton, LoadingBlock, Notice } from '@/components/admin-ui';
import { AdminAccountNotifications } from '@/components/admin-account-notifications';
import { AdministratorAccountsModal } from '@/components/administrator-accounts';
import { AnalyticsPanel } from '@/components/analytics-panel';
import { AuditHistoryPanel } from '@/components/audit-history';
import { adminDashboardStyles as styles } from '@/stylesheets/dashboard-home.styles';
import { Text } from '@/components/branded-text';
import {
  FacilityHoursPanel,
  FacilityInformationPanel,
  FacilityPricingPanel,
} from '@/components/facility-settings';
import {
  BlockedPeriodsPanel,
  FacilityEventEditModal,
  FacilityEventsPanel,
  IssueReportsPanel,
} from '@/components/facility-management';
import { OpenCourtManagementModal } from '@/components/open-court-management';
import { PaymentsPanel } from '@/components/payments-panel';
import { PlayerEditModal, PlayersPanel } from '@/components/player-management';
import { ReceiptScannerModal } from '@/components/receipt-scanner';
import { ReservationArchiveModal } from '@/components/reservation-archive';
import {
  BookingDatePicker,
  ReservationDetailsModal,
  ReservationEditModal,
  SchedulePanel,
} from '@/components/schedule-management';
import { colors } from '@/constants/admin-theme';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';
import {
  periodLabel as analyticsPeriodLabel,
  periodStart as analyticsPeriodStart,
  shiftPeriod as shiftAnalyticsPeriod,
} from '@/lib/admin-periods';
import type { FacilitySection, TabName } from '@/lib/admin-types';
import { todayKey } from '@/lib/date';

const tabs: { icon: keyof typeof Ionicons.glyphMap; label: string; value: TabName }[] = [
  { icon: 'calendar-outline', label: 'Schedule', value: 'schedule' },
  { icon: 'card-outline', label: 'Payments', value: 'payments' },
  { icon: 'business-outline', label: 'Facility', value: 'facility' },
  { icon: 'people-outline', label: 'Players', value: 'players' },
  { icon: 'bar-chart-outline', label: 'Analytics', value: 'analytics' },
];

export function AdminDashboard({ administratorName, isMainAdministrator }: { administratorName: string | null; isMainAdministrator: boolean }) {
  const {
    activeTab, setActiveTab,
    facilitySection, setFacilitySection,
    selectedDate, setSelectedDate,
    paymentDate, setPaymentDate,
    paymentPeriod, setPaymentPeriod,
    paymentReservations,
    analyticsDate, setAnalyticsDate,
    analyticsPeriod, setAnalyticsPeriod,
    analyticsReservations,
    previousAnalyticsReservations,
    facilityEvents,
    issueReports,
    scheduleRules,
    players,
    auditEntries,
    settings,
    loading,
    refreshing,
    message,
    busyAction,
    selectedReservation, setSelectedReservation,
    editingReservation, setEditingReservation,
    editingEvent, setEditingEvent,
    editingPlayer, setEditingPlayer,
    archiveVisible, setArchiveVisible,
    administratorAccountsVisible, setAdministratorAccountsVisible,
    openCourtsVisible, setOpenCourtsVisible,
    scannerVisible, setScannerVisible,
    timeZone,
    dateHeading,
    playerById,
    playerNameById,
    selectedReservations,
    selectedBlocks,
    upcomingBlockedPeriods,
    unpaidCount,
    scheduleRule,
    reservationParticipants,
    refresh,
    confirmPayment,
    cancelReservation,
    saveReservation,
    saveFacilityInformation,
    saveFacilityHours,
    saveFacilityPricing,
    createBlockedPeriod,
    deleteBlockedPeriod,
    createFacilityEvent,
    saveFacilityEvent,
    deleteFacilityEvent,
    updateIssueReport,
    savePlayer,
    deletePlayer,
    openArchivedReservation,
    signOut,
  } = useAdminDashboard();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} tintColor={colors.accent} />}>
        <View style={styles.headerBar}>
          <View style={styles.headerIdentity}>
            <Text numberOfLines={1} style={styles.productName}>{settings?.facility_name || 'Padel Court'}</Text>
            <Text style={styles.adminName}>{administratorName || 'Administrator'}</Text>
          </View>
          <View style={styles.headerActions}>
            <AdminAccountNotifications timeZone={timeZone} />
            <IconButton accessibilityLabel="Scan reservation receipt" icon="scan-outline" onPress={() => setScannerVisible(true)} />
            <IconButton accessibilityLabel="Sign out" icon="log-out-outline" onPress={() => void signOut()} />
          </View>
        </View>

        {activeTab === 'schedule' ? (
          <>
            <View style={styles.dateHero}>
              <Text style={styles.dateNumeral}>{dateHeading.numeral}</Text>
              <View style={styles.dateCopy}>
                <Text style={styles.dateWeekday}>{dateHeading.weekday}</Text>
                <Text style={styles.dateMonth}>{dateHeading.monthYear}</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <Stat label="Reservations" value={String(selectedReservations.length)} />
              <Stat label="Unpaid" value={String(unpaidCount)} />
              <Stat label="Blocked" value={String(selectedBlocks.length)} />
            </View>
          </>
        ) : null}

        {message ? <Notice>{message}</Notice> : null}
        {loading ? <LoadingBlock label="Loading administrator data…" /> : (
          <View style={styles.sectionBody}>
            {activeTab === 'schedule' ? (
              <View style={styles.panelStack}>
                <BookingDatePicker onSelectDate={setSelectedDate} selectedDate={selectedDate} timeZone={timeZone} />
                <SchedulePanel
                  blocks={selectedBlocks}
                  dateLabel={dateHeading.long}
                  onOpenArchive={() => setArchiveVisible(true)}
                  onOpenCourts={() => setOpenCourtsVisible(true)}
                  onSelectReservation={setSelectedReservation}
                  playerById={playerById}
                  reservations={selectedReservations}
                  rule={scheduleRule}
                  timeZone={timeZone}
                />
              </View>
            ) : null}
            {activeTab === 'payments' ? (
              <PaymentsPanel
                busyAction={busyAction}
                canMoveNext={analyticsPeriodStart(paymentDate, paymentPeriod) < analyticsPeriodStart(todayKey(timeZone), paymentPeriod)}
                onChangePeriod={setPaymentPeriod}
                onMarkPaid={confirmPayment}
                onMovePeriod={(amount) => setPaymentDate((current) => shiftAnalyticsPeriod(current, paymentPeriod, amount))}
                period={paymentPeriod}
                periodLabel={analyticsPeriodLabel(paymentDate, paymentPeriod)}
                playerNameById={playerNameById}
                reservations={paymentReservations}
                timeZone={timeZone}
              />
            ) : null}
            {activeTab === 'facility' ? (
              <View style={styles.panelStack}>
                <FacilitySectionNavigation onChange={setFacilitySection} value={facilitySection} />
                {facilitySection === 'information' && settings ? (
                  <FacilityInformationPanel
                    busy={busyAction === 'save-facility-information'}
                    onSave={saveFacilityInformation}
                    settings={settings}
                  />
                ) : null}
                {facilitySection === 'hours' ? (
                  <FacilityHoursPanel
                    busy={busyAction === 'save-facility-hours'}
                    onSave={saveFacilityHours}
                    rules={scheduleRules}
                  />
                ) : null}
                {facilitySection === 'pricing' && settings ? (
                  <FacilityPricingPanel
                    busy={busyAction === 'save-facility-pricing'}
                    onSave={saveFacilityPricing}
                    settings={settings}
                  />
                ) : null}
                {facilitySection === 'blocked' ? (
                  <BlockedPeriodsPanel
                    busy={busyAction}
                    defaultDate={selectedDate}
                    onCreate={createBlockedPeriod}
                    onDelete={deleteBlockedPeriod}
                    periods={upcomingBlockedPeriods}
                    timeZone={timeZone}
                  />
                ) : null}
                {facilitySection === 'events' ? (
                  <FacilityEventsPanel
                    busy={busyAction}
                    defaultDate={selectedDate}
                    events={facilityEvents}
                    onCreate={createFacilityEvent}
                    onDelete={deleteFacilityEvent}
                    onEdit={setEditingEvent}
                    timeZone={timeZone}
                  />
                ) : null}
                {facilitySection === 'reports' ? (
                  <IssueReportsPanel
                    busy={busyAction}
                    onUpdate={updateIssueReport}
                    playerById={playerById}
                    reports={issueReports}
                    timeZone={timeZone}
                  />
                ) : null}
                {facilitySection === 'audit' ? (
                  <AuditHistoryPanel entries={auditEntries} timeZone={timeZone} />
                ) : null}
              </View>
            ) : null}
            {activeTab === 'players' ? (
              <PlayersPanel
                isMainAdministrator={isMainAdministrator}
                onEdit={setEditingPlayer}
                onManageAdministrators={() => setAdministratorAccountsVisible(true)}
                players={players}
              />
            ) : null}
            {activeTab === 'analytics' ? (
              <AnalyticsPanel
                dateKey={analyticsDate}
                onChangeDate={setAnalyticsDate}
                onChangePeriod={setAnalyticsPeriod}
                period={analyticsPeriod}
                players={players}
                previousReservations={previousAnalyticsReservations}
                reservations={analyticsReservations}
                scheduleRules={scheduleRules}
                timeZone={timeZone}
              />
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const selected = tab.value === activeTab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={[styles.tab, selected && styles.tabSelected]}>
              <Ionicons color={selected ? colors.onAccent : colors.accent} name={tab.icon} size={20} />
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ReservationDetailsModal
        busy={busyAction}
        onCancel={cancelReservation}
        onClose={() => setSelectedReservation(null)}
        onConfirmPayment={confirmPayment}
        onEdit={(reservation) => {
          setSelectedReservation(null);
          setEditingReservation(reservation);
        }}
        player={selectedReservation ? playerById.get(selectedReservation.host_id) : undefined}
        participants={selectedReservation ? reservationParticipants.filter((item) => item.reservation_id === selectedReservation.id).map((item) => ({ player: playerById.get(item.player_id), role: item.role })) : []}
        reservation={selectedReservation}
        timeZone={timeZone}
      />
      <ReservationArchiveModal
        onClose={() => setArchiveVisible(false)}
        onSelectReservation={(reservation) => void openArchivedReservation(reservation)}
        timeZone={timeZone}
        visible={archiveVisible}
      />
      <OpenCourtManagementModal onClose={() => setOpenCourtsVisible(false)} timeZone={timeZone} visible={openCourtsVisible} />
      <AdministratorAccountsModal onClose={() => setAdministratorAccountsVisible(false)} timeZone={timeZone} visible={administratorAccountsVisible} />
      <ReservationEditModal
        onClose={() => setEditingReservation(null)}
        onSave={saveReservation}
        reservation={editingReservation}
        timeZone={timeZone}
      />
      <FacilityEventEditModal event={editingEvent} onClose={() => setEditingEvent(null)} onSave={saveFacilityEvent} timeZone={timeZone} />
      <PlayerEditModal
        canDelete={isMainAdministrator}
        onClose={() => setEditingPlayer(null)}
        onDelete={deletePlayer}
        onSave={savePlayer}
        player={editingPlayer}
      />
      <ReceiptScannerModal onClose={() => setScannerVisible(false)} timeZone={timeZone} visible={scannerVisible} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const facilitySections: { icon: keyof typeof Ionicons.glyphMap; label: string; value: FacilitySection }[] = [
  { icon: 'information-circle-outline', label: 'Information', value: 'information' },
  { icon: 'time-outline', label: 'Hours', value: 'hours' },
  { icon: 'pricetag-outline', label: 'Pricing', value: 'pricing' },
  { icon: 'ban-outline', label: 'Blocked', value: 'blocked' },
  { icon: 'trophy-outline', label: 'Events', value: 'events' },
  { icon: 'chatbox-ellipses-outline', label: 'Reports', value: 'reports' },
  { icon: 'shield-checkmark-outline', label: 'Audit', value: 'audit' },
];

function FacilitySectionNavigation({
  onChange,
  value,
}: {
  onChange: (value: FacilitySection) => void;
  value: FacilitySection;
}) {
  return (
    <View style={styles.facilityNavigation}>
      {facilitySections.map((section) => {
        const selected = value === section.value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={section.value}
            onPress={() => onChange(section.value)}
            style={[styles.facilityNavigationItem, selected && styles.facilityNavigationItemSelected]}>
            <Ionicons color={selected ? colors.onAccent : colors.accent} name={section.icon} size={18} />
            <Text style={[styles.facilityNavigationText, selected && styles.facilityNavigationTextSelected]}>{section.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
