import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

export default function PrivacyPolicyModal({ visible, onClose, initialTab = 'privacy' }) {
  const [tab, setTab] = React.useState(initialTab);

  React.useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Legal & Data Safety</Text>
            <Text style={styles.headerSubtitle}>Technula EduFlow • Certified School OS</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'privacy' && styles.tabBtnActive]}
            onPress={() => setTab('privacy')}
          >
            <Text style={[styles.tabBtnText, tab === 'privacy' && styles.tabBtnTextActive]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'terms' && styles.tabBtnActive]}
            onPress={() => setTab('terms')}
          >
            <Text style={[styles.tabBtnText, tab === 'terms' && styles.tabBtnTextActive]}>
              Terms of Service
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'deletion' && styles.tabBtnActive]}
            onPress={() => setTab('deletion')}
          >
            <Text style={[styles.tabBtnText, tab === 'deletion' && styles.tabBtnTextActive]}>
              Data Deletion
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {tab === 'privacy' && (
            <View>
              <Text style={styles.sectionHeading}>Technula EduFlow Privacy Policy</Text>
              <Text style={styles.metaText}>Last Updated: October 2026 • Effective Worldwide</Text>

              <Text style={styles.paragraph}>
                Technula EduFlow ("we", "our", or "the App") is an educational management portal designed exclusively for authenticated schools, teachers, students, and their parents/guardians.
              </Text>

              <Text style={styles.subHeading}>1. Information We Collect</Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>Account & Profile:</Text> Parent/Guardian full name, mobile number, email address, and verified relationship to the enrolled student.</Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>Academic Records:</Text> Student name, admission number, class, section, attendance marks, exam grades, homework, and fee receipts provided by the school.</Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>Device & Push Tokens:</Text> Firebase Cloud Messaging (FCM) tokens strictly to deliver urgent school announcements, attendance alerts, and bus gate passes.</Text>

              <Text style={styles.subHeading}>2. What We DO NOT Collect</Text>
              <Text style={styles.bullet}>• We do NOT track physical GPS background location.</Text>
              <Text style={styles.bullet}>• We do NOT record audio, access device microphones, or read private text messages.</Text>
              <Text style={styles.bullet}>• We do NOT store payment card numbers (all school fee transactions are handled by RBI/PCI-DSS certified payment gateways such as Razorpay/PayU/Stripe).</Text>

              <Text style={styles.subHeading}>3. Student & Child Data Protection (COPPA / GDPR-K Compliance)</Text>
              <Text style={styles.paragraph}>
                Technula EduFlow processes student information strictly on behalf of and under the explicit direction of the participating school. Student profiles are never made public and are strictly visible only to their verified legal guardians and assigned faculty. We NEVER sell student data or use it for behavioral profiling or third-party targeted advertising.
              </Text>

              <Text style={styles.subHeading}>4. Data Security & Encryption</Text>
              <Text style={styles.paragraph}>
                All network transmissions are encrypted with TLS 1.3 / HTTPS. Sensitive stored records (including student exam sheets and database archives) are encrypted using AES-256 standards with strict tenant isolation.
              </Text>

              <Text style={styles.subHeading}>5. Contact Our Data Protection Officer</Text>
              <Text style={styles.paragraph}>
                If you have questions regarding your data or wish to exercise your rights, email us at <Text style={styles.linkText} onPress={() => Linking.openURL('mailto:sales@technula.com')}>sales@technula.com</Text> or visit our public portal at <Text style={styles.linkText} onPress={() => Linking.openURL('https://technulaeduflow.technula.com/privacy')}>https://technulaeduflow.technula.com/privacy</Text>.
              </Text>
            </View>
          )}

          {tab === 'terms' && (
            <View>
              <Text style={styles.sectionHeading}>Terms of Service</Text>
              <Text style={styles.metaText}>Agreement for Guardians and School Members</Text>

              <Text style={styles.paragraph}>
                By accessing or registering with Technula EduFlow, you agree to comply with the terms set forth herein.
              </Text>

              <Text style={styles.subHeading}>1. Authorized Usage</Text>
              <Text style={styles.paragraph}>
                This application is provided exclusively for registered parents, guardians, faculty, and administrators of affiliated educational institutions. Impersonating another parent, student, or faculty member is strictly prohibited.
              </Text>

              <Text style={styles.subHeading}>2. Account Security</Text>
              <Text style={styles.paragraph}>
                You are responsible for keeping your OTP credentials and mobile device secure. Notify the school administration immediately if you suspect unauthorized access.
              </Text>

              <Text style={styles.subHeading}>3. School Administrative Authority</Text>
              <Text style={styles.paragraph}>
                Official grade transcripts, report cards, fee receipts, and digital certificates are issued directly by your school administration under educational board regulations.
              </Text>
            </View>
          )}

          {tab === 'deletion' && (
            <View>
              <Text style={styles.sectionHeading}>Account & Data Deletion</Text>
              <Text style={styles.metaText}>Google Play User Data Compliance Policy</Text>

              <Text style={styles.paragraph}>
                In full compliance with Google Play Store User Data and Account Deletion policies, you have the right to request deletion of your account and personal data at any time.
              </Text>

              <View style={styles.deletionCard}>
                <Text style={styles.deletionCardTitle}>🗑️ What Gets Deleted:</Text>
                <Text style={styles.bullet}>• Your parent guardian login credentials and authentication sessions</Text>
                <Text style={styles.bullet}>• Registered push notification tokens and device IDs</Text>
                <Text style={styles.bullet}>• Guardian contact preferences and chat histories</Text>
                <Text style={styles.note}>
                  * Note: Official statutory student academic records (such as CBSE/State board final marks and fee audits) are maintained by the school as legally mandated by local educational regulations.
                </Text>
              </View>

              <Text style={styles.subHeading}>How to Request Deletion:</Text>
              <Text style={styles.paragraph}>
                1. Navigate to <Text style={styles.bold}>Menu → Guardian Profile → Request Account Deletion</Text> within the app.
              </Text>
              <Text style={styles.paragraph}>
                2. Alternatively, submit a deletion request via email to <Text style={styles.linkText} onPress={() => Linking.openURL('mailto:sales@technula.com?subject=Account%20Deletion%20Request')}>sales@technula.com</Text> or visit <Text style={styles.linkText} onPress={() => Linking.openURL('https://technulaeduflow.technula.com/privacy')}>https://technulaeduflow.technula.com/privacy</Text>.
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A2540',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 6,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: theme.colors.primary,
  },
  scrollBody: {
    padding: 20,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A2540',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A2540',
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 6,
    paddingLeft: 6,
  },
  bold: {
    fontWeight: '700',
    color: '#0A2540',
  },
  linkText: {
    color: theme.colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  deletionCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  deletionCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9A3412',
    marginBottom: 8,
  },
  note: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
