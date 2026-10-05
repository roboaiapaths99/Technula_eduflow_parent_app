import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Image, ActivityIndicator, Modal, ScrollView, LogBox, Alert
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './src/theme';
import { parentApi, loadPersistedAuth, clearAuth, setOnAuthExpired } from './src/api';
import ErrorBoundary from './src/ErrorBoundary';

LogBox.ignoreAllLogs(); // Prevents developer warnings from interrupting parent app experience

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import ReportCardScreen from './src/screens/ReportCardScreen';
import HomeworkScreen from './src/screens/HomeworkScreen';
import FeesScreen from './src/screens/FeesScreen';
import LeaveScreen from './src/screens/LeaveScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import ChatScreen from './src/screens/ChatScreen';
import TicketsScreen from './src/screens/TicketsScreen';
import NoticesScreen from './src/screens/NoticesScreen';
import PTCScreen from './src/screens/PTCScreen';
import CertificatesScreen from './src/screens/CertificatesScreen';
import DiaryScreen from './src/screens/DiaryScreen';
import GatePassScreen from './src/screens/GatePassScreen';
import DatesheetScreen from './src/screens/DatesheetScreen';
import AlmanacScreen from './src/screens/AlmanacScreen';
import HolidaysScreen from './src/screens/HolidaysScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import ActivitiesScreen from './src/screens/ActivitiesScreen';
import TeachersScreen from './src/screens/TeachersScreen';
import ProfileEditScreen from './src/screens/ProfileEditScreen';

// Components
import LinkChildModal from './src/components/LinkChildModal';
import NotificationCenterModal from './src/components/NotificationCenterModal';
import HeadsUpBanner from './src/components/HeadsUpBanner';
import PrivacyPolicyModal from './src/components/PrivacyPolicyModal';
import { registerForPushNotificationsAsync, setupNotificationListeners, triggerLocalHeadsUpNotification } from './src/services/notificationService';

function AppContent() {
  const [initLoading, setInitLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [pendingLinks, setPendingLinks] = useState([]);
  const [activeChild, setActiveChild] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); // home | attendance | report | homework | fees | leave | timetable | chat | tickets | notices | more
  const [showChildPicker, setShowChildPicker] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // HeadsUp Banner state (in-app notification popup)
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerData, setBannerData] = useState({ title: '', message: '', data: {} });
  const lastSeenNotifTs = useRef(null);

  // Google Play Compliance & Legal Modals
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [legalTab, setLegalTab] = useState('privacy');

  // 1. Check for persisted authentication on startup
  useEffect(() => {
    setOnAuthExpired(() => {
      handleLogout();
    });

    const initSession = async () => {
      try {
        const persistedUser = await loadPersistedAuth();
        if (persistedUser) {
          setCurrentUser(persistedUser);
          await loadChildren(persistedUser.id);
          // Register device for FCM push notifications
          registerForPushNotificationsAsync().catch(() => {});
        }
      } catch (e) {
        console.warn('Session init error:', e);
      } finally {
        setInitLoading(false);
      }
    };
    initSession();

    // Listen for notification taps and foreground alerts
    const cleanupListeners = setupNotificationListeners(
      (notification) => {
        // Show in-app heads-up banner when notification arrives in foreground
        const content = notification?.request?.content;
        if (content) {
          setBannerData({
            title: content.title || 'School Update',
            message: content.body || 'You have a new notification.',
            data: content.data || {},
          });
          setBannerVisible(true);
        }
      },
      (data) => {
        // Navigate to appropriate tab when notification is clicked
        if (data?.screen) {
          setActiveTab(data.screen);
        } else if (data?.type === 'FEE_ALERT') {
          setActiveTab('fees');
        } else if (data?.type === 'HOMEWORK') {
          setActiveTab('homework');
        } else if (data?.type === 'ATTENDANCE') {
          setActiveTab('attendance');
        } else if (data?.type === 'ANNOUNCEMENT' || data?.type === 'BROADCAST_ALERT') {
          setActiveTab('notices');
        }
      }
    );

    return () => {
      if (cleanupListeners) cleanupListeners();
    };
  }, []);

  // Poll for unread notification count every 15 seconds and detect new broadcasts
  useEffect(() => {
    if (!currentUser) return;
    const fetchUnread = async () => {
      try {
        const data = await parentApi.getNotifications(true, 50);
        const unreadList = Array.isArray(data) ? data : [];
        setUnreadNotifCount(unreadList.length);

        // Check if there's a new notification since last poll → show HeadsUpBanner
        if (unreadList.length > 0) {
          const newest = unreadList[0];
          if (newest.created_at && newest.created_at !== lastSeenNotifTs.current) {
            lastSeenNotifTs.current = newest.created_at;

            // If a child link or profile change was approved/rejected, immediately sync children!
            if (newest.event_type === 'STUDENT_LINK_APPROVED' || newest.event_type === 'PROFILE_APPROVED') {
              if (currentUser?.id) loadChildren(currentUser.id);
            }

            // Only show banner if the notification was created within the last 30 seconds
            const notifAge = Date.now() - new Date(newest.created_at).getTime();
            if (notifAge < 30000 && !bannerVisible) {
              setBannerData({
                title: newest.title || 'New Update',
                message: newest.message || 'You have a new notification.',
                data: newest.payload_json ? JSON.parse(newest.payload_json) : {},
              });
              setBannerVisible(true);
              // Also trigger native heads-up notification
              triggerLocalHeadsUpNotification({
                title: newest.title || 'School Update',
                body: newest.message || 'New notification from school.',
                data: newest.payload_json ? JSON.parse(newest.payload_json) : {},
              });
            }
          }
        }
      } catch (_) {}
    };
    fetchUnread();
    // Poll unread notifications and auto-sync children every 15 seconds
    const interval = setInterval(() => {
      fetchUnread();
      if (currentUser?.id) {
        loadChildren(currentUser.id);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // 2. Fetch children and pending link requests linked to parent
  const loadChildren = async (userId) => {
    if (!userId) return;
    try {
      const [res, pending] = await Promise.allSettled([
        parentApi.getChildren(userId),
        parentApi.getPendingLinks ? parentApi.getPendingLinks() : Promise.resolve([]),
      ]);

      const activeChildren = res.status === 'fulfilled' && Array.isArray(res.value) ? res.value : [];
      const pendingList = pending.status === 'fulfilled' && Array.isArray(pending.value) ? pending.value : [];

      setChildren(activeChildren);
      setPendingLinks(pendingList);

      if (activeChildren.length > 0) {
        setActiveChild((prev) => {
          if (!prev) return activeChildren[0];
          return activeChildren.find(c => c.student_id === prev.student_id) || activeChildren[0];
        });
      } else {
        setActiveChild(null);
      }
    } catch (e) {
      console.warn('Error fetching children:', e);
    }
  };

  const handleLoginSuccess = async (user) => {
    setCurrentUser(user);
    await loadChildren(user.id);
    // Register device for FCM push notifications
    registerForPushNotificationsAsync().catch(() => {});
  };

  const handleLogout = async () => {
    await clearAuth();
    setCurrentUser(null);
    setChildren([]);
    setActiveChild(null);
    setActiveTab('home');
  };

  const handleRequestAccountDeletion = () => {
    Alert.alert(
      'Request Account Deletion',
      'In accordance with Google Play data safety policies, submitting this request will initiate the removal of your parent account, push notification tokens, and personal settings. Are you sure you wish to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: async () => {
            try {
              await parentApi.requestAccountDeletion('User initiated via mobile app settings');
              Alert.alert(
                'Request Received',
                'Your account deletion request has been submitted to the administration. Your session will now be logged out.',
                [{ text: 'OK', onPress: handleLogout }]
              );
            } catch (err) {
              Alert.alert('Request Failed', err.message || 'Unable to submit request at this time.');
            }
          }
        }
      ]
    );
  };

  if (initLoading) {
    return (
      <View style={styles.splashCenter}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.bgMain} />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // Titles for navigation header
  const getScreenTitle = () => {
    switch (activeTab) {
      case 'home': return 'Home';
      case 'attendance': return 'Attendance';
      case 'report': return 'Report Card';
      case 'homework': return 'Homework Diary';
      case 'fees': return 'Fees & Dues';
      case 'leave': return 'Leave Applications';
      case 'timetable': return 'Class Timetable';
      case 'chat': return 'Teacher Chat';
      case 'tickets': return 'Support & Queries';
      case 'notices': return 'Official Circulars';
      case 'ptc': return 'PTC Meeting Booking';
      case 'certificates': return 'Digital Certificates';
      case 'diary': return 'Student Remarks Diary';
      case 'gate_pass': return 'Gate Passes & QR';
      case 'datesheet': return 'Exam Datesheet';
      case 'almanac': return 'School Almanac';
      case 'holidays': return 'Holiday Calendar';
      case 'gallery': return 'Campus Photo Gallery';
      case 'activities': return 'Campus Activities';
      case 'teachers': return 'Teachers & Faculty';
      case 'profile': return 'Guardian Profile';
      case 'more': return 'More Services';
      default: return 'Home';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Mobile App Header */}
      <View style={styles.appHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.logoRow}
            onPress={() => setActiveTab('home')}
            activeOpacity={0.7}
          >
            <Image
              source={require('./assets/logo.jpg')}
              style={styles.headerLogo}
            />
          </TouchableOpacity>

          {/* Child Switcher Dropdown */}
          <TouchableOpacity
            style={styles.childSwitcher}
            onPress={() => {
              setShowChildPicker(true);
              if (currentUser?.id) loadChildren(currentUser.id);
            }}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.childName} numberOfLines={1}>
                {activeChild ? activeChild.name : 'Link Student'}
              </Text>
              <Text style={styles.childMeta}>
                {activeChild ? `Grade ${activeChild.grade}-${activeChild.section} ▼` : 'Tap to Connect ▼'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.notifHeaderBtn}
            onPress={() => setShowNotifCenter(true)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {unreadNotifCount > 0 && (
              <View style={{
                position: 'absolute', top: -4, right: -4,
                backgroundColor: '#EF4444', borderRadius: 10,
                minWidth: 18, height: 18, alignItems: 'center',
                justifyContent: 'center', paddingHorizontal: 4,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Screen Title Banner (if not on Home) */}
      {activeTab !== 'home' && activeTab !== 'more' && (
        <View style={styles.subHeaderBar}>
          <TouchableOpacity
            onPress={() => setActiveTab('home')}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>{getScreenTitle()}</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* Main Screen Body */}
      <View style={styles.mainBody}>
        {activeTab === 'home' && (
          <HomeScreen
            user={currentUser}
            activeChild={activeChild}
            children={children}
            pendingLinks={pendingLinks}
            onSelectChild={(c) => setActiveChild(c)}
            onRefreshChildren={() => currentUser?.id && loadChildren(currentUser.id)}
            onNavigate={(screen) => setActiveTab(screen)}
            onLinkChild={() => setShowLinkModal(true)}
          />
        )}
        {activeTab === 'attendance' && (
          <AttendanceScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'report' && (
          <ReportCardScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'homework' && (
          <HomeworkScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'fees' && (
          <FeesScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'leave' && (
          <LeaveScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'timetable' && (
          <TimetableScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'chat' && (
          <ChatScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'tickets' && (
          <TicketsScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'notices' && (
          <NoticesScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'ptc' && (
          <PTCScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'certificates' && (
          <CertificatesScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'diary' && (
          <DiaryScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'gate_pass' && (
          <GatePassScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'datesheet' && (
          <DatesheetScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'almanac' && (
          <AlmanacScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'holidays' && (
          <HolidaysScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'gallery' && (
          <GalleryScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'activities' && (
          <ActivitiesScreen user={currentUser} activeChild={activeChild} onNavigate={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'teachers' && (
          <TeachersScreen user={currentUser} activeChild={activeChild} />
        )}
        {activeTab === 'profile' && (
          <ProfileEditScreen user={currentUser} activeChild={activeChild} />
        )}

        {/* More Menu View */}
        {activeTab === 'more' && (
          <ScrollView contentContainerStyle={styles.moreMenuContent}>
            <Text style={styles.moreMenuHeader}>All Services & Features</Text>

            <View style={styles.moreGrid}>
              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('ptc')}
              >
                <Text style={styles.moreCardIcon}>🤝</Text>
                <Text style={styles.moreCardTitle}>PTC Slot Booking</Text>
                <Text style={styles.moreCardSub}>Book 15-min 1-on-1 meeting</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('certificates')}
              >
                <Text style={styles.moreCardIcon}>📜</Text>
                <Text style={styles.moreCardTitle}>Digital Certificates</Text>
                <Text style={styles.moreCardSub}>Instant TC & Bonafide with stamp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('diary')}
              >
                <Text style={styles.moreCardIcon}>📖</Text>
                <Text style={styles.moreCardTitle}>Student Remarks Diary</Text>
                <Text style={styles.moreCardSub}>Digital feedback & parent acknowledgment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('attendance')}
              >
                <Text style={styles.moreCardIcon}>📋</Text>
                <Text style={styles.moreCardTitle}>Daily Attendance</Text>
                <Text style={styles.moreCardSub}>Presence & leave history</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('report')}
              >
                <Text style={styles.moreCardIcon}>📄</Text>
                <Text style={styles.moreCardTitle}>Report Card</Text>
                <Text style={styles.moreCardSub}>Board exam results & grades</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('homework')}
              >
                <Text style={styles.moreCardIcon}>📚</Text>
                <Text style={styles.moreCardTitle}>Homework Diary</Text>
                <Text style={styles.moreCardSub}>Daily tasks & submissions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('fees')}
              >
                <Text style={styles.moreCardIcon}>💳</Text>
                <Text style={styles.moreCardTitle}>Fee Dues & Receipts</Text>
                <Text style={styles.moreCardSub}>Tuition payments & receipts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('timetable')}
              >
                <Text style={styles.moreCardIcon}>🗓️</Text>
                <Text style={styles.moreCardTitle}>Class Schedule</Text>
                <Text style={styles.moreCardSub}>Weekly periods & teachers</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('leave')}
              >
                <Text style={styles.moreCardIcon}>🏖️</Text>
                <Text style={styles.moreCardTitle}>Leave Application</Text>
                <Text style={styles.moreCardSub}>Apply leave with document proof</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('chat')}
              >
                <Text style={styles.moreCardIcon}>💬</Text>
                <Text style={styles.moreCardTitle}>Teacher Chat</Text>
                <Text style={styles.moreCardSub}>Direct messaging with teachers</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('notices')}
              >
                <Text style={styles.moreCardIcon}>📢</Text>
                <Text style={styles.moreCardTitle}>School Circulars</Text>
                <Text style={styles.moreCardSub}>Official updates & PTM notices</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('tickets')}
              >
                <Text style={styles.moreCardIcon}>🎫</Text>
                <Text style={styles.moreCardTitle}>Support Queries</Text>
                <Text style={styles.moreCardSub}>Administrative assistance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('gate_pass')}
              >
                <Text style={styles.moreCardIcon}>🎟️</Text>
                <Text style={styles.moreCardTitle}>Digital Gate Pass</Text>
                <Text style={styles.moreCardSub}>Request exit pass & QR code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('datesheet')}
              >
                <Text style={styles.moreCardIcon}>🗓️</Text>
                <Text style={styles.moreCardTitle}>Exam Datesheets</Text>
                <Text style={styles.moreCardSub}>Subject timetable & schedule</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('holidays')}
              >
                <Text style={styles.moreCardIcon}>🏖️</Text>
                <Text style={styles.moreCardTitle}>Holiday Calendar</Text>
                <Text style={styles.moreCardSub}>Upcoming breaks & countdown</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('gallery')}
              >
                <Text style={styles.moreCardIcon}>📸</Text>
                <Text style={styles.moreCardTitle}>Campus Gallery</Text>
                <Text style={styles.moreCardSub}>Event photos & annual moments</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('activities')}
              >
                <Text style={styles.moreCardIcon}>🚩</Text>
                <Text style={styles.moreCardTitle}>Activity Feed</Text>
                <Text style={styles.moreCardSub}>Campus milestones & events</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('almanac')}
              >
                <Text style={styles.moreCardIcon}>📘</Text>
                <Text style={styles.moreCardTitle}>School Almanac</Text>
                <Text style={styles.moreCardSub}>Policies, rules & guides</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('teachers')}
              >
                <Text style={styles.moreCardIcon}>👩‍🏫</Text>
                <Text style={styles.moreCardTitle}>Teachers & Faculty</Text>
                <Text style={styles.moreCardSub}>Class & subject teachers</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setActiveTab('profile')}
              >
                <Text style={styles.moreCardIcon}>👤</Text>
                <Text style={styles.moreCardTitle}>Guardian Profile</Text>
                <Text style={styles.moreCardSub}>Contact & channel settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => setShowLinkModal(true)}
              >
                <Text style={styles.moreCardIcon}>➕</Text>
                <Text style={styles.moreCardTitle}>Link Another Child</Text>
                <Text style={styles.moreCardSub}>Connect sibling profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreCard}
                onPress={() => { setLegalTab('privacy'); setShowPrivacyModal(true); }}
              >
                <Text style={styles.moreCardIcon}>🛡️</Text>
                <Text style={styles.moreCardTitle}>Privacy & Data Safety</Text>
                <Text style={styles.moreCardSub}>Google Play verified policies</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moreCard, { borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' }]}
                onPress={handleRequestAccountDeletion}
              >
                <Text style={styles.moreCardIcon}>🗑️</Text>
                <Text style={[styles.moreCardTitle, { color: '#DC2626' }]}>Delete Account & Data</Text>
                <Text style={styles.moreCardSub}>Purge user profile & session</Text>
              </TouchableOpacity>

              <View style={{ marginTop: 24, marginBottom: 20, alignItems: 'center', width: '100%', gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.textDark }}>
                  Technula EduFlow
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textMuted }}>
                  Version 1.0.0 • Production Build 1
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
                  {activeChild?.school_name || 'Certified School Operating System'}
                </Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Bottom Navigation Tab Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('home')}
        >
          <Text style={[styles.navIcon, activeTab === 'home' && styles.navIconActive]}>🏠</Text>
          <Text style={[styles.navLabel, activeTab === 'home' && styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('homework')}
        >
          <Text style={[styles.navIcon, activeTab === 'homework' && styles.navIconActive]}>📚</Text>
          <Text style={[styles.navLabel, activeTab === 'homework' && styles.navLabelActive]}>Homework</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('fees')}
        >
          <Text style={[styles.navIcon, activeTab === 'fees' && styles.navIconActive]}>💳</Text>
          <Text style={[styles.navLabel, activeTab === 'fees' && styles.navLabelActive]}>Fees</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.navIcon, activeTab === 'chat' && styles.navIconActive]}>💬</Text>
          <Text style={[styles.navLabel, activeTab === 'chat' && styles.navLabelActive]}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('more')}
        >
          <Text style={[styles.navIcon, activeTab === 'more' && styles.navIconActive]}>☰</Text>
          <Text style={[styles.navLabel, activeTab === 'more' && styles.navLabelActive]}>Menu</Text>
        </TouchableOpacity>
      </View>

      {/* Child Switcher Modal */}
      <Modal visible={showChildPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowChildPicker(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select Student</Text>
            <Text style={styles.pickerSub}>Switch between children linked to your parent account</Text>

            <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
              {children.map((c) => {
                const isSelected = activeChild && activeChild.student_id === c.student_id;
                return (
                  <TouchableOpacity
                    key={c.student_id}
                    style={[styles.childOption, isSelected && styles.childOptionActive]}
                    onPress={() => {
                      setActiveChild(c);
                      setShowChildPicker(false);
                    }}
                  >
                    <View style={styles.childOptionLeft}>
                      <View style={[styles.childAvatar, isSelected && { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.childAvatarText}>
                          {(c.name || 'S').slice(0, 1)}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.childOptionName, isSelected && { color: theme.colors.primary }]}>
                          {c.name}
                        </Text>
                        <Text style={styles.childOptionMeta}>
                          Class {c.grade}-{c.section} • {c.admission_no}
                        </Text>
                      </View>
                    </View>
                    {isSelected && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              {/* Pending Links Queue Section */}
              {pendingLinks.length > 0 && (
                <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#D97706', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    ⏳ Awaiting School Office Approval ({pendingLinks.length})
                  </Text>
                  {pendingLinks.map((p) => (
                    <View key={p.link_id} style={styles.pendingChildCard}>
                      <View style={styles.pendingAvatar}>
                        <Text style={{ fontSize: 14 }}>⏳</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.pendingName}>{p.student_name}</Text>
                        <Text style={styles.pendingMeta}>
                          Class {p.grade}-{p.section} • Adm: {p.admission_no}
                        </Text>
                        <View style={styles.pendingBadgeRow}>
                          <Text style={styles.pendingBadgeText}>Pending Verification</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.addNewChildBtn}
              onPress={() => {
                setShowChildPicker(false);
                setShowLinkModal(true);
              }}
            >
              <Text style={styles.addNewChildText}>+ Link Another Student Profile</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Link Child Modal */}
      <LinkChildModal
        visible={showLinkModal}
        user={currentUser}
        onClose={() => setShowLinkModal(false)}
        onLinked={() => loadChildren(currentUser.id)}
      />

      {/* Real-Time Notification Center Modal */}
      <NotificationCenterModal
        visible={showNotifCenter}
        onClose={() => setShowNotifCenter(false)}
      />

      {/* Heads-Up In-App Banner (slides from top like Zomato/Swiggy) */}
      <HeadsUpBanner
        visible={bannerVisible}
        title={bannerData.title}
        message={bannerData.message}
        data={bannerData.data}
        onPress={(data) => {
          setBannerVisible(false);
          if (data?.screen) {
            setActiveTab(data.screen);
          } else if (data?.type === 'BROADCAST_ALERT' || data?.type === 'ANNOUNCEMENT') {
            setActiveTab('notices');
          } else {
            setShowNotifCenter(true);
          }
        }}
        onDismiss={() => setBannerVisible(false)}
      />

      {/* Google Play Verified Privacy Policy & Data Deletion Modal */}
      <PrivacyPolicyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        initialTab={legalTab}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashCenter: {
    flex: 1,
    backgroundColor: theme.colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgMain,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.card,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoRow: {
    padding: 2,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  childSwitcher: {
    backgroundColor: theme.colors.bgSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: 200,
  },
  childName: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  childMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  notifHeaderBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    backgroundColor: theme.colors.roseLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.rose,
  },
  subHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  subHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  mainBody: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: 8,
    paddingBottom: 16,
    justifyContent: 'space-around',
    ...theme.shadows.card,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  navLabelActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  moreMenuContent: {
    padding: 16,
    paddingBottom: 40,
  },
  moreMenuHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moreCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  moreCardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  moreCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  moreCardSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  pickerSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  childOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  childOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  childOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  childAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  childOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  childOptionMeta: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  checkMark: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  addNewChildBtn: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addNewChildText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  pendingChildCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 8,
  },
  pendingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  pendingMeta: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  pendingBadgeRow: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
    textTransform: 'uppercase',
  },
});
