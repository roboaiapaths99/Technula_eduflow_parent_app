import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase } from '../api';

export default function PTCScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [slots, setSlots] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [activeTab, setActiveTab] = useState('book'); // book | my_appointments

  // Booking Modal
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [agendaTopic, setAgendaTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const schoolId = activeChild?.school_id || user?.school_id;
  const parentUserId = user?.id;

  const loadData = async () => {
    if (!schoolId) { setLoading(false); return; }
    try {
      const [eventsRes, bookingsRes] = await Promise.all([
        parentApi.getPTCEvents(schoolId).catch(() => []),
        parentUserId ? parentApi.getMyPTCBookings(parentUserId).catch(() => []) : []
      ]);
      setEvents(eventsRes || []);
      setMyBookings(bookingsRes || []);
      if (eventsRes && eventsRes.length > 0) {
        setSelectedEvent(eventsRes[0]);
      }
    } catch (e) {
      console.warn('Error loading PTC events:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [schoolId]);

  const loadSlots = async (evId) => {
    if (!evId) return;
    setLoadingSlots(true);
    try {
      const res = await parentApi.getPTCSlots(evId);
      setSlots(res || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (selectedEvent) loadSlots(selectedEvent.id);
  }, [selectedEvent]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleBook = async () => {
    if (!selectedSlot || !activeChild || !parentUserId) return;
    setSubmitting(true);
    try {
      await parentApi.bookPTCSlot(selectedSlot.slot_id, {
        slot_id: selectedSlot.slot_id,
        student_id: activeChild.student_id,
        parent_user_id: parentUserId,
        agenda_topic: agendaTopic.trim() || 'General Academic Progress Review',
      });

      Alert.alert('Appointment Confirmed!', `Your 15-minute conference has been locked for ${selectedSlot.start_time}.`);
      setSelectedSlot(null);
      setAgendaTopic('');
      loadData();
      if (selectedEvent) loadSlots(selectedEvent.id);
      setActiveTab('my_appointments');
    } catch (err) {
      Alert.alert('Booking Error', err.message || 'Could not lock appointment slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = (bookingId) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to release this conference slot? Another parent may book it.',
      [
        { text: 'Keep Slot', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await parentApi.cancelPTCBooking(bookingId);
              Alert.alert('Cancelled', 'Your conference appointment has been cancelled.');
              loadData();
              if (selectedEvent) loadSlots(selectedEvent.id);
            } catch (e) {
              Alert.alert('Booking Notice', e.message || 'Could not cancel booking');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Top Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'book' && styles.tabBtnActive]}
          onPress={() => setActiveTab('book')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'book' && styles.tabBtnTextActive]}>
            📅 Available Slots
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'my_appointments' && styles.tabBtnActive]}
          onPress={() => setActiveTab('my_appointments')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'my_appointments' && styles.tabBtnTextActive]}>
            ✓ My Appointments ({myBookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'book' ? (
        <View>
          {/* Active Event Banner */}
          {selectedEvent ? (
            <View style={styles.eventCard}>
              <View style={styles.badgeRow}>
                <View style={styles.eventBadge}>
                  <Text style={styles.eventBadgeText}>Class {selectedEvent.grade || '10'} Conference</Text>
                </View>
                <Text style={styles.eventDateText}>📅 {selectedEvent.event_date}</Text>
              </View>

              <Text style={styles.eventTitle}>{selectedEvent.title}</Text>
              <Text style={styles.eventDesc}>{selectedEvent.description}</Text>

              <View style={styles.eventMetaRow}>
                <Text style={styles.metaItem}>⏱ {selectedEvent.slot_duration_mins || 15} Mins / Slot</Text>
                <Text style={styles.metaItem}>🕒 {selectedEvent.start_time} - {selectedEvent.end_time}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>📅</Text>
              <Text style={styles.emptyTitle}>No Conferences Scheduled</Text>
              <Text style={styles.emptySub}>School administration has not announced any upcoming PTM slots.</Text>
            </View>
          )}

          {/* Slots Selector */}
          <Text style={styles.sectionTitle}>Select 15-Minute Consultation Slot</Text>
          <Text style={styles.sectionSubtitle}>Tap an open slot to lock your 1-on-1 meeting</Text>

          {loadingSlots ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
          ) : slots.length === 0 ? (
            <Text style={styles.emptyNote}>No slots generated for this session.</Text>
          ) : (
            <View style={styles.slotsGrid}>
              {slots.map((slot) => {
                const isBooked = slot.is_booked;
                return (
                  <TouchableOpacity
                    key={slot.slot_id}
                    style={[styles.slotCard, isBooked && styles.slotCardBooked]}
                    disabled={isBooked}
                    onPress={() => setSelectedSlot(slot)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.slotTime, isBooked && styles.slotTimeBooked]}>
                      {slot.start_time} - {slot.end_time}
                    </Text>
                    <Text style={styles.slotTeacher} numberOfLines={1}>
                      {slot.teacher_name}
                    </Text>
                    <View style={[styles.slotStatusPill, { backgroundColor: isBooked ? '#F1F5F9' : '#ECFDF5' }]}>
                      <Text style={[styles.slotStatusText, { color: isBooked ? '#94A3B8' : '#059669' }]}>
                        {isBooked ? '● Booked' : '✓ Open to Book'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        /* My Appointments Tab */
        <View>
          {myBookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🤝</Text>
              <Text style={styles.emptyTitle}>No Booked Appointments</Text>
              <Text style={styles.emptySub}>You have not reserved any conference slots yet. Switch to Available Slots tab to book.</Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {myBookings.map((b) => (
                <View key={b.booking_id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.bookingTitle}>{b.event_title}</Text>
                    <View style={styles.confirmedPill}>
                      <Text style={styles.confirmedText}>✓ Confirmed</Text>
                    </View>
                  </View>

                  <View style={styles.bookingRow}>
                    <Text style={styles.bookingLabel}>Time & Date:</Text>
                    <Text style={styles.bookingVal}>{b.time_slot} on {b.event_date}</Text>
                  </View>

                  <View style={styles.bookingRow}>
                    <Text style={styles.bookingLabel}>Teacher:</Text>
                    <Text style={styles.bookingVal}>{b.teacher_name}</Text>
                  </View>

                  <View style={styles.bookingRow}>
                    <Text style={styles.bookingLabel}>Venue:</Text>
                    <Text style={styles.bookingVal}>{b.room_or_link}</Text>
                  </View>

                  {b.agenda_topic && (
                    <View style={styles.agendaBox}>
                      <Text style={styles.agendaTitle}>Discussion Agenda:</Text>
                      <Text style={styles.agendaText}>"{b.agenda_topic}"</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.cancelBookingBtn}
                    onPress={() => handleCancelBooking(b.booking_id || b.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBookingBtnText}>Cancel Appointment</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Book Slot Modal */}
      {selectedSlot && (
        <Modal visible={!!selectedSlot} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Confirm PTM Appointment</Text>
              <Text style={styles.modalSubtitle}>
                Lock 15-minute slot with {selectedSlot.teacher_name} ({selectedSlot.start_time} - {selectedSlot.end_time})
              </Text>

              <Text style={styles.modalLabel}>Discussion Agenda / Topic</Text>
              <TextInput
                style={styles.modalInput}
                value={agendaTopic}
                onChangeText={setAgendaTopic}
                placeholder="Specify what you'd like to consult on..."
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setSelectedSlot(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleBook}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Lock Appointment →</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgMain },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: theme.colors.primary },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  tabBtnTextActive: { color: '#FFFFFF', fontWeight: '800' },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
    ...theme.shadows.card,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  eventBadge: { backgroundColor: theme.colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  eventBadgeText: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
  eventDateText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  eventTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  eventDesc: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17, marginBottom: 12 },
  eventMetaRow: { flexDirection: 'row', gap: 14, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle, paddingTop: 10 },
  metaItem: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  sectionSubtitle: { fontSize: 11, color: theme.colors.textSecondary, marginBottom: 12 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  emptyNote: { textAlign: 'center', color: theme.colors.textMuted, paddingVertical: 20, fontSize: 13 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  slotCardBooked: { backgroundColor: '#F8FAFC', opacity: 0.6 },
  slotTime: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  slotTimeBooked: { color: theme.colors.textMuted },
  slotTeacher: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2, marginBottom: 6 },
  slotStatusPill: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  slotStatusText: { fontSize: 10, fontWeight: '700' },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bookingTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  confirmedPill: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  confirmedText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  bookingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bookingLabel: { fontSize: 12, color: theme.colors.textSecondary },
  bookingVal: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },
  agendaBox: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 6, marginTop: 8, borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
  agendaTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.primary, marginBottom: 2 },
  agendaText: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  modalSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, height: 80, textAlignVertical: 'top', fontSize: 13, backgroundColor: '#F8FAFC', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  modalConfirmBtn: { flex: 2, backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalConfirmText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  cancelBookingBtn: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  cancelBookingBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});
