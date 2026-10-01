import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Modal, TextInput, Linking, Alert, Image
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase, formatUserError, isPlanRestrictedError } from '../api';
import FeatureUnavailableCard from '../components/FeatureUnavailableCard';

export default function FeesScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dues, setDues] = useState(null);
  const [schoolConfig, setSchoolConfig] = useState(null);

  // Payment Checkout Modal
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI'); // UPI | CARD | NET_BANKING
  const [userUtr, setUserUtr] = useState('');
  const [paying, setPaying] = useState(false);

  // Verified Receipt Modal
  const [receiptModal, setReceiptModal] = useState(null);

  const studentId = activeChild?.student_id;
  const schoolId = activeChild?.school_id || user?.school_id;
  const schoolPaymentInfo = dues?.school_payment_info || schoolConfig;

  const loadData = async () => {
    if (!studentId) { setLoading(false); return; }
    try {
      setError(null);
      const [duesRes, configRes] = await Promise.all([
        parentApi.getStudentFeeDues(studentId),
        schoolId ? fetch(`${getApiBase()}/fees/config?school_id=${schoolId}`).then(r => r.json()).catch(() => null) : null
      ]);
      setDues(duesRes);
      setSchoolConfig(configRes);
    } catch (e) {
      setError(formatUserError(e, 'Unable to load fee details at this time.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [studentId]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleStartPayment = (item = null) => {
    setSelectedItem(item);
    const amountToPay = item ? String(item.balance || item.base_amount || 0) : String(totalDue);
    setPayAmount(amountToPay);
    setUserUtr('');
    setShowCheckout(true);
  };

  const handleCompletePayment = async () => {
    const num = parseFloat(payAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to pay.');
      return;
    }
    if (!userUtr.trim()) {
      Alert.alert('Transaction Reference Required', 'Please enter your bank payment UTR / Transaction Reference number.');
      return;
    }

    setPaying(true);
    try {
      const orderRef = `ORD-${Date.now()}-${studentId.slice(0, 4)}`;
      const utrRef = userUtr.trim();

      const res = await fetch(`${getApiBase()}/fees/orders/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          student_id: studentId,
          amount: num,
          order_ref: orderRef,
          utr_ref: utrRef,
          fee_structure_id: selectedItem?.structure_id || 'ad_hoc',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Payment recording failed');

      setShowCheckout(false);

      // Load generated receipt
      const rRes = await fetch(`${getApiBase()}/fees/receipts/${encodeURIComponent(data.receipt_no)}`).then(r => r.json());
      setReceiptModal(rRes);
      loadData();
    } catch (err) {
      Alert.alert('Payment Notice', formatUserError(err, 'Transaction could not be recorded. Please verify your reference number or contact school office.'));
    } finally {
      setPaying(false);
    }
  };

  const handleViewReceipt = async (receiptNo) => {
    try {
      const res = await fetch(`${getApiBase()}/fees/receipts/${encodeURIComponent(receiptNo)}`).then(r => r.json());
      setReceiptModal(res);
    } catch (e) {
      Alert.alert('Receipt Notice', formatUserError(e, 'Could not load receipt details.'));
    }
  };

  const handleOpenPublicVerify = (receiptNo) => {
    const url = `${getApiBase()}/fees/verify-receipt/${encodeURIComponent(receiptNo)}`;
    Linking.openURL(url).catch(e => Alert.alert('Cannot Open', 'Could not open verification URL.'));
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (error) {
    if (isPlanRestrictedError(error)) {
      return (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <FeatureUnavailableCard
            icon="💳"
            title="Fee Management Not Activated"
            subtitle="The digital fee ledger and online receipt system has not been activated by your school administration yet. Ledger details will appear here once enabled."
            onRetry={loadData}
          />
        </ScrollView>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>💳</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalDue = dues?.summary?.total_balance_outstanding != null
    ? dues.summary.total_balance_outstanding
    : (dues?.total_balance != null ? dues.total_balance : (dues?.due_items || []).reduce((sum, d) => sum + (d.balance || 0), 0));

  const totalPaid = dues?.summary?.total_fee_paid != null
    ? dues.summary.total_fee_paid
    : (dues?.total_paid != null ? dues.total_paid : (dues?.paid_items || []).reduce((sum, d) => sum + (d.amount_paid || d.total_paid || 0), 0));

  const items = dues?.breakdown || dues?.items || dues?.due_items || [];
  const paidList = dues?.history || dues?.paid_items || dues?.receipts || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>TOTAL DUE</Text>
          <Text style={[styles.kpiValue, { color: totalDue > 0 ? theme.colors.rose : theme.colors.emerald }]}>
            ₹{totalDue.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.kpiSub}>{totalDue > 0 ? 'Pending Payment' : 'All Clear ✓'}</Text>
        </View>

        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>TOTAL PAID</Text>
          <Text style={[styles.kpiValue, { color: theme.colors.emerald }]}>
            ₹{totalPaid.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.kpiSub}>This Session</Text>
        </View>
      </View>

      {/* Pay Full Dues CTA */}
      {totalDue > 0 && (
        <TouchableOpacity
          style={styles.payCtaBtn}
          onPress={() => handleStartPayment(null)}
          activeOpacity={0.85}
        >
          <Text style={styles.payCtaText}>⚡ Pay Total Balance Online (₹{totalDue.toLocaleString('en-IN')}) →</Text>
        </TouchableOpacity>
      )}

      {/* Itemized Fee Ledger */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📋 Academic Fee Installments</Text>
        <Text style={styles.sectionSubtitle}>Tap an installment to pay individually via UPI / Card</Text>

        {items.length === 0 ? (
          <Text style={styles.emptyNote}>No pending fee structures found.</Text>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            {items.map((item, idx) => {
              const isPaid = (item.status || '').toUpperCase() === 'PAID' || (item.balance || 0) <= 0;
              const isOverdue = (item.status || '').toUpperCase() === 'OVERDUE';

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.feeRow, isPaid && styles.feeRowPaid]}
                  onPress={() => !isPaid && handleStartPayment(item)}
                  disabled={isPaid}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeName}>{item.fee_head} ({item.installment_name || 'Term'})</Text>
                    <Text style={styles.feeMeta}>
                      Due: {item.due_date || 'N/A'} {item.late_fine ? `• Late fine: ₹${item.late_fine}` : ''}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.feeAmount, isPaid && { color: theme.colors.emerald }]}>
                      ₹{(item.balance != null ? item.balance : item.base_amount || 0).toLocaleString('en-IN')}
                    </Text>
                    <View style={[
                      styles.statusPill,
                      { backgroundColor: isPaid ? '#ECFDF5' : isOverdue ? '#FFF1F2' : '#FEF3C7' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: isPaid ? '#059669' : isOverdue ? '#E11D48' : '#D97706' }
                      ]}>
                        {isPaid ? '✓ Paid' : isOverdue ? 'Overdue' : 'Pay Now →'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* School Official Bank & QR Payment Info */}
      {Boolean(schoolPaymentInfo?.bank_account_no || schoolPaymentInfo?.upi_vpa || schoolPaymentInfo?.qr_code_url) && (
        <View style={styles.bankCard}>
          <Text style={styles.bankTitle}>🏦 School Official Bank & QR Payment</Text>
          <Text style={styles.bankSubtitle}>Pay directly via UPI QR or NEFT/IMPS bank transfer</Text>

          {Boolean(schoolPaymentInfo?.bank_name) && (
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Bank Name</Text>
              <Text style={styles.bankValue}>{schoolPaymentInfo.bank_name}</Text>
            </View>
          )}

          {Boolean(schoolPaymentInfo?.bank_account_no) && (
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Account Number</Text>
              <Text style={styles.bankValue}>{schoolPaymentInfo.bank_account_no}</Text>
            </View>
          )}

          {Boolean(schoolPaymentInfo?.bank_ifsc) && (
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>IFSC Code</Text>
              <Text style={styles.bankValue}>{schoolPaymentInfo.bank_ifsc}</Text>
            </View>
          )}

          {Boolean(schoolPaymentInfo?.bank_account_holder) && (
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Beneficiary Name</Text>
              <Text style={styles.bankValue}>{schoolPaymentInfo.bank_account_holder}</Text>
            </View>
          )}

          {Boolean(schoolPaymentInfo?.upi_vpa) && (
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Official UPI ID</Text>
              <Text style={styles.bankValue}>{schoolPaymentInfo.upi_vpa}</Text>
            </View>
          )}

          {Boolean(schoolPaymentInfo?.qr_code_url) && (
            <View style={styles.qrContainer}>
              <Image source={{ uri: schoolPaymentInfo.qr_code_url }} style={styles.qrImage} resizeMode="contain" />
              <Text style={styles.qrHint}>Scan school QR code to pay directly</Text>
            </View>
          )}

          {Boolean(schoolPaymentInfo?.payment_instructions) && (
            <Text style={styles.instructionsText}>
              💡 Note: {schoolPaymentInfo.payment_instructions}
            </Text>
          )}
        </View>
      )}

      {/* Paid Receipts History with QR Verification */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🧾 Verified Payment Receipts</Text>
        <Text style={styles.sectionSubtitle}>Official school receipts with verification QR code</Text>

        {paidList.length === 0 ? (
          <Text style={styles.emptyNote}>No payment receipts recorded yet.</Text>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            {paidList.map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.receiptRow}
                onPress={() => handleViewReceipt(p.receipt_no)}
                activeOpacity={0.7}
              >
                <View>
                  <Text style={styles.receiptNoText}>Doc #{p.receipt_no}</Text>
                  <Text style={styles.receiptMetaText}>
                    {p.payment_date || p.date} • {p.payment_mode || 'ONLINE'}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.receiptAmountText}>
                    ₹{(p.amount_paid || p.total_paid || 0).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.qrBadgeText}>🛡️ QR Verified</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Checkout Modal */}
      {showCheckout && (
        <Modal visible={showCheckout} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>School Fee Payment</Text>
              <Text style={styles.modalSubtitle}>
                {schoolConfig?.upi_account_name || activeChild?.school_name || user?.school_name || 'School'}
              </Text>

              {/* Amount Input */}
              <Text style={styles.fieldLabel}>Amount to Pay (INR)</Text>
              <TextInput
                style={styles.amountInput}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="numeric"
              />

              {/* Payment Mode */}
              <Text style={styles.fieldLabel}>Select Payment Mode</Text>
              <View style={styles.modeRow}>
                {[
                  { id: 'UPI', label: '⚡ UPI / QR', sub: schoolConfig?.upi_vpa || 'schoolfees@upi' },
                  { id: 'CARD', label: '💳 Debit / Card', sub: 'Visa / RuPay / MC' },
                ].map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.modeCard, paymentMode === m.id && styles.modeCardActive]}
                    onPress={() => setPaymentMode(m.id)}
                  >
                    <Text style={[styles.modeLabel, paymentMode === m.id && styles.modeLabelActive]}>
                      {m.label}
                    </Text>
                    <Text style={styles.modeSub}>{m.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Bank UTR / Reference */}
              <Text style={styles.fieldLabel}>Bank UTR / Transaction Reference No *</Text>
              <TextInput
                style={[styles.amountInput, { fontSize: 14, height: 42, fontFamily: 'monospace' }]}
                value={userUtr}
                onChangeText={setUserUtr}
                placeholder="e.g. 423819024819 (from your UPI or bank app)"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowCheckout(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmPayBtn}
                  onPress={handleCompletePayment}
                  disabled={paying}
                >
                  {paying ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmPayText}>Authorize Payment →</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Verified Receipt Modal with QR */}
      {receiptModal && (
        <Modal visible={!!receiptModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.receiptModalCard}>
              <View style={styles.receiptHeader}>
                <Text style={styles.receiptSchoolName}>{receiptModal.school?.name || 'School Fee Receipt'}</Text>
                <Text style={styles.receiptSubHeader}>OFFICIAL TAX & TUITION FEE RECEIPT</Text>
                <View style={styles.sealPill}>
                  <Text style={styles.sealPillText}>✓ Cryptographically Sealed & Verified</Text>
                </View>
              </View>

              <View style={styles.receiptDetails}>
                <View style={styles.recRow}>
                  <Text style={styles.recLbl}>Receipt No:</Text>
                  <Text style={styles.recVal}>{receiptModal.receipt_no}</Text>
                </View>
                <View style={styles.recRow}>
                  <Text style={styles.recLbl}>Payment Date:</Text>
                  <Text style={styles.recVal}>{receiptModal.payment_date}</Text>
                </View>
                <View style={styles.recRow}>
                  <Text style={styles.recLbl}>Student:</Text>
                  <Text style={styles.recVal}>{receiptModal.student?.name} (Adm: {receiptModal.student?.admission_no})</Text>
                </View>
                <View style={styles.recRow}>
                  <Text style={styles.recLbl}>Fee Head:</Text>
                  <Text style={styles.recVal}>{receiptModal.fee_head}</Text>
                </View>
                <View style={styles.recRow}>
                  <Text style={styles.recLbl}>Payment Mode:</Text>
                  <Text style={styles.recVal}>{receiptModal.payment_mode}</Text>
                </View>

                <View style={styles.recTotalRow}>
                  <Text style={styles.recTotalLbl}>TOTAL AMOUNT PAID:</Text>
                  <Text style={styles.recTotalVal}>₹{receiptModal.total_paid?.toLocaleString('en-IN')}</Text>
                </View>
              </View>

              <View style={styles.qrSection}>
                <Text style={{ fontSize: 32 }}>🛡️</Text>
                <Text style={styles.qrNote}>Tamper-Proof Verification Token</Text>
                <Text style={styles.qrHash}>{receiptModal.qr_verification_token || 'TOKEN-VERIFIED'}</Text>

                <TouchableOpacity
                  style={styles.verifyLinkBtn}
                  onPress={() => handleOpenPublicVerify(receiptModal.receipt_no)}
                >
                  <Text style={styles.verifyLinkText}>🔗 Verify Authenticity in Official Registry →</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeReceiptBtn}
                onPress={() => setReceiptModal(null)}
              >
                <Text style={styles.closeReceiptText}>Close Receipt</Text>
              </TouchableOpacity>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, color: theme.colors.rose, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kpiCard: { backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card },
  kpiLabel: { fontSize: 10, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 0.5 },
  kpiValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  kpiSub: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  payCtaBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: 16, ...theme.shadows.card },
  payCtaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg, padding: 18, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16, ...theme.shadows.card },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  sectionSubtitle: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  emptyNote: { textAlign: 'center', color: theme.colors.textMuted, paddingVertical: 20, fontSize: 13 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle },
  feeRowPaid: { opacity: 0.6 },
  feeName: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  feeMeta: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  feeAmount: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle },
  receiptNoText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  receiptMetaText: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  receiptAmountText: { fontSize: 13, fontWeight: '800', color: theme.colors.emerald },
  qrBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  modalSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
  amountInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, fontSize: 20, fontWeight: '800', color: theme.colors.primary, backgroundColor: '#F8FAFC', marginBottom: 14 },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeCard: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#F8FAFC' },
  modeCardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  modeLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  modeLabelActive: { color: theme.colors.primary },
  modeSub: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  confirmPayBtn: { flex: 2, backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  confirmPayText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  receiptModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36, maxHeight: '90%' },
  receiptHeader: { alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 14, marginBottom: 14 },
  receiptSchoolName: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary },
  receiptSubHeader: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  sealPill: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  sealPillText: { fontSize: 10, fontWeight: '800', color: '#059669' },
  receiptDetails: { gap: 6, marginBottom: 14 },
  recRow: { flexDirection: 'row', justifyContent: 'space-between' },
  recLbl: { fontSize: 12, color: theme.colors.textSecondary },
  recVal: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },
  recTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8, marginTop: 8 },
  recTotalLbl: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  recTotalVal: { fontSize: 15, fontWeight: '900', color: theme.colors.emerald },
  qrSection: { alignItems: 'center', background: '#F8FAFC', padding: 14, borderRadius: 8, marginBottom: 16 },
  qrNote: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 4 },
  qrHash: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  verifyLinkBtn: { marginTop: 8 },
  verifyLinkText: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
  closeReceiptBtn: { backgroundColor: theme.colors.bgSubtle, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  closeReceiptText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  bankCard: { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 16 },
  bankTitle: { fontSize: 14, fontWeight: '800', color: '#166534', marginBottom: 3 },
  bankSubtitle: { fontSize: 11, color: '#15803D', marginBottom: 12 },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#DCFCE7' },
  bankLabel: { fontSize: 12, color: '#166534', fontWeight: '600' },
  bankValue: { fontSize: 12, color: '#14532D', fontWeight: '800' },
  qrContainer: { alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#BBF7D0' },
  qrImage: { width: 140, height: 140, borderRadius: 10, borderWidth: 1, borderColor: '#86EFAC', backgroundColor: '#FFF', marginBottom: 6 },
  qrHint: { fontSize: 11, fontWeight: '700', color: '#166534' },
  instructionsText: { fontSize: 11, color: '#166534', backgroundColor: '#DCFCE7', padding: 8, borderRadius: 6, marginTop: 10, lineHeight: 16 },
});
