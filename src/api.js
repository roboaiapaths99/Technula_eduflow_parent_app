/**
 * Parent App — Full API Client with AsyncStorage Persistence.
 *
 * Supports: Auth, Children, Overview, Attendance, Report Cards,
 * Homework, Fees, Leave, Timetable, Chat, Tickets, Announcements,
 * Notifications, and File Uploads.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── Configurable API Base URL ──────────────────────────
// On Android emulator use 10.0.2.2, on iOS simulator localhost works,
// on real devices use your machine's LAN IP.
const DEFAULT_API = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://localhost:8000',
  default: 'http://localhost:8000',
});

// Production fallback for Technula EduFlow Google Play release builds
const PROD_API = 'https://eduflow.technula.com/api';

// You can override this by setting EXPO_PUBLIC_API_BASE in .env (e.g. http://192.168.1.12:8000)
let API_BASE = (process.env.EXPO_PUBLIC_API_BASE && process.env.EXPO_PUBLIC_API_BASE.trim() !== '')
  ? process.env.EXPO_PUBLIC_API_BASE
  : (typeof __DEV__ !== 'undefined' && __DEV__ ? DEFAULT_API : PROD_API);

export function setApiBase(url) {
  API_BASE = url;
}

export function getApiBase() {
  return API_BASE;
}

// ── Token & User Persistence ───────────────────────────
const TOKEN_KEY = 'technulaeduflow_auth_token';
const USER_KEY = 'technulaeduflow_auth_user';

let authToken = null;
let currentUser = null;

export async function loadPersistedAuth() {
  try {
    const [token, userJson] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);
    if (token) authToken = token;
    if (userJson) currentUser = JSON.parse(userJson);
    return currentUser;
  } catch (e) {
    console.warn('Failed to load persisted auth:', e);
    return null;
  }
}

export async function persistAuth(token, user) {
  authToken = token;
  currentUser = user;
  try {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
    ]);
  } catch (e) {
    console.warn('Failed to persist auth:', e);
  }
}

export async function clearAuth() {
  authToken = null;
  currentUser = null;
  try {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
  } catch (e) {
    console.warn('Failed to clear auth:', e);
  }
}

// ── Selected School Persistence ───────────────────────
const SELECTED_SCHOOL_KEY = 'technulaeduflow_selected_school';

export async function saveSelectedSchool(school) {
  try {
    await AsyncStorage.setItem(SELECTED_SCHOOL_KEY, JSON.stringify(school));
  } catch (e) {
    console.warn('Failed to save selected school:', e);
  }
}

export async function getSavedSchool() {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_SCHOOL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to read saved school:', e);
    return null;
  }
}

export async function clearSavedSchool() {
  try {
    await AsyncStorage.removeItem(SELECTED_SCHOOL_KEY);
  } catch (e) {
    console.warn('Failed to clear saved school:', e);
  }
}

export function getStoredUser() {
  return currentUser;
}

export function getStoredToken() {
  return authToken;
}

/**
 * Checks whether an error is due to a plan/feature restriction or unactivated module
 */
export function isPlanRestrictedError(err) {
  if (!err) return false;
  const raw = typeof err === 'string' ? err : (err.detail || err.message || '');
  const lower = String(raw).toLowerCase();
  return (
    lower.includes('plan upgrade') ||
    lower.includes('not included in your') ||
    lower.includes('not available in your') ||
    lower.includes('trial has expired') ||
    lower.includes('subscription has expired') ||
    lower.includes('starter plan') ||
    lower.includes('renew your plan') ||
    lower.includes('not activated') ||
    lower.includes('not enabled') ||
    lower.includes('contact the school office') ||
    lower.includes('school administration yet') ||
    lower.includes('requires a plan upgrade')
  );
}

/**
 * Sanitizes errors for mobile app users
 */
export function formatUserError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  let msg = typeof err === 'string' ? err : (err.detail || err.message || fallback);
  if (Array.isArray(msg)) {
    msg = msg.map(m => m.msg || m.message || (typeof m === 'string' ? m : JSON.stringify(m))).join(', ');
  } else if (typeof msg === 'object' && msg !== null) {
    msg = msg.msg || msg.message || msg.detail || JSON.stringify(msg);
  }
  if (typeof msg !== 'string') return fallback;

  const lower = msg.toLowerCase().trim();

  // 0. Subscription Plan & Module Activation
  if (isPlanRestrictedError(msg)) {
    return 'This module has not been activated by your school administration yet. Please contact the school office for details.';
  }

  // 1. Missing fields / validation errors
  if (lower.includes('field required') || lower.includes('missing') || lower.includes('value_error') || lower.includes('input should be') || lower.includes('unprocessable entity')) {
    return 'Please check that all required fields are filled out correctly.';
  }

  // 2. Not Found / 404 / Unavailable
  if (lower === 'not found' || lower.includes('not found') || lower.includes('(404)') || lower.includes('status 404')) {
    return 'The requested information could not be found or is not available yet.';
  }

  // 3. Database & backend crash errors
  if (
    lower.includes('sqlalchemy') || lower.includes('traceback') || lower.includes('internal server error') ||
    lower.includes('operationalerror') || lower.includes('integrityerror') || lower.includes('foreignkey') ||
    lower.includes('psycopg2') || lower.includes('sqlite3') || lower.includes('database locked') ||
    lower.includes('syntaxerror') || lower.includes('null value') || lower.includes('pydantic') ||
    lower.includes('500') || lower.includes('502') || lower.includes('bad gateway')
  ) {
    return 'The school server is temporarily busy. Please try again in a few moments.';
  }

  // 4. Network & connection errors
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed') || lower.includes('econnrefused') || lower.includes('network error') || lower.includes('timeout') || lower.includes('abort')) {
    return 'Unable to reach the school server. Please verify your internet connection.';
  }

  // 5. Session & Permission errors
  if (lower.includes('not authenticated') || lower.includes('session expired') || lower.includes('token expired') || lower.includes('jwt expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (lower.includes('invalid credentials') || lower.includes('invalid email or password')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('forbidden') || lower.includes('access denied') || lower.includes('permission denied')) {
    return 'You do not have permission to view or perform this action.';
  }

  // 6. JSON parsing & serialization errors
  if (lower.includes('json.parse') || lower.includes('unexpected token') || lower.includes('[object object]') || lower.includes('request failed')) {
    return 'The server is momentarily unavailable. Please pull down to refresh.';
  }

  // 7. Method not allowed / route issues
  if (lower.includes('method not allowed') || lower.includes('405')) {
    return 'This action is currently not supported.';
  }

  return msg;
}

let authExpiredListener = null;

export function setOnAuthExpired(cb) {
  authExpiredListener = cb;
}

// ── HTTP Request Helper with Offline Cache Fallback ──
const CACHE_PREFIX = 'technulaeduflow_cache:';

async function request(path, options = {}) {
  const isGet = !options.method || options.method === 'GET';
  const cacheKey = `${CACHE_PREFIX}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      await clearAuth();
      if (authExpiredListener) {
        try { authExpiredListener(); } catch (_) {}
      }
      throw new Error('Your session has expired. Please sign in again.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText || 'Request failed' }));
      let rawDetail = err.detail;
      if (Array.isArray(rawDetail)) {
        rawDetail = rawDetail.map(d => d.msg || d.message).join(', ');
      } else if (typeof rawDetail === 'object' && rawDetail !== null) {
        rawDetail = rawDetail.msg || rawDetail.message || JSON.stringify(rawDetail);
      } else if (!rawDetail) {
        rawDetail = res.statusText || `Request failed (${res.status})`;
      }
      const friendlyMessage = formatUserError(rawDetail);
      throw new Error(friendlyMessage);
    }

    const data = await res.json();
    if (isGet) {
      // Async persist to cache (fire and forget)
      AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
    }
    return data;
  } catch (error) {
    if (error.message && error.message.includes('Session expired')) {
      throw error;
    }
    
    // Offline / Network Failure Fallback for GET requests
    if (isGet) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          console.log(`[Offline Cache Fallback] Served from cache: ${path}`);
          const parsed = JSON.parse(cached);
          if (typeof parsed === 'object' && parsed !== null) {
            parsed._is_offline_cached = true;
          }
          return parsed;
        }
      } catch (cacheErr) {
        console.warn('Failed to read from cache:', cacheErr);
      }
    }
    
    console.log(`[API Request Notice] [${path}]:`, error.message);
    throw error;
  }
}

// ── API Methods ────────────────────────────────────────
export const parentApi = {
  // ── Auth ──
  login: async (email, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await persistAuth(data.access_token, data.user);
    return data;
  },

  forgotPassword: (email) =>
    request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (data) =>
    request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Schools Discovery ──
  getSchoolByCode: (code) =>
    request(`/schools/by-code/${encodeURIComponent(code || '')}`),

  searchSchools: (query) =>
    request(`/schools/search?query=${encodeURIComponent(query || '')}`),

  // ── Mobile OTP Parent Flow ──
  sendMobileOtp: (schoolId, phone) =>
    request('/auth/parent/send-otp', {
      method: 'POST',
      body: JSON.stringify({ school_id: schoolId, phone }),
    }),

  verifyMobileOtp: async (schoolId, phone, otp) => {
    const data = await request('/auth/parent/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ school_id: schoolId, phone, otp }),
    });
    if (data.status === 'AUTHENTICATED' && data.access_token && data.user) {
      await persistAuth(data.access_token, data.user);
    }
    return data;
  },

  confirmPrimaryPhone: async (schoolId, phone, studentIds = null) => {
    const data = await request('/auth/parent/confirm-primary', {
      method: 'POST',
      body: JSON.stringify({ school_id: schoolId, phone, student_ids: studentIds }),
    });
    if (data.access_token && data.user) {
      await persistAuth(data.access_token, data.user);
    }
    return data;
  },

  requestPhoneChange: (newPhone, reason = 'Updated primary mobile') =>
    request('/parent-profile/request-phone-change', {
      method: 'POST',
      body: JSON.stringify({ new_phone: newPhone, reason }),
    }),

  requestAccountDeletion: (reason = 'User requested account closure') =>
    request('/parent-profile/request-account-deletion', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // ── Notifications ──
  getNotifications: (unreadOnly = false, limit = 30) =>
    request(`/notifications/?unread_only=${unreadOnly}&limit=${limit}`),

  markNotificationRead: (notificationId) =>
    request(`/notifications/${notificationId}/mark-read`, {
      method: 'POST',
    }),

  registerDeviceToken: (fcmToken) =>
    request('/notifications/register-device', {
      method: 'POST',
      body: JSON.stringify({ fcm_token: fcmToken }),
    }),

  testPushNotification: () =>
    request('/notifications/test-push', {
      method: 'POST',
    }),

  getSchoolClasses: (schoolId) =>
    request(`/parent/school-classes/${schoolId}`),

  getClassStudents: (schoolId, grade, section = 'A') =>
    request(`/parent/class-students?school_id=${schoolId}&grade=${encodeURIComponent(grade)}&section=${encodeURIComponent(section)}`),

  // ── Child Management ──
  linkChild: (payload) => {
    // Supports object payload { parentUserId, schoolId, studentId, admissionNo, relation }
    // or legacy positional args (parentUserId, schoolId, admissionNo, relation)
    if (typeof payload === 'object' && payload !== null && !payload._isPositional) {
      return request('/parent/link-child', {
        method: 'POST',
        body: JSON.stringify({
          parent_user_id: payload.parentUserId || payload.parent_user_id,
          school_id: payload.schoolId || payload.school_id,
          student_id: payload.studentId || payload.student_id,
          admission_no: payload.admissionNo || payload.admission_no,
          student_name: payload.studentName || payload.student_name,
          verification_code: payload.verificationCode || payload.verification_code,
          relation: payload.relation || 'Guardian',
        }),
      });
    }
    const [parentUserId, schoolId, admissionNo, relation = 'Guardian'] = arguments;
    return request('/parent/link-child', {
      method: 'POST',
      body: JSON.stringify({
        parent_user_id: parentUserId,
        school_id: schoolId,
        admission_no: admissionNo,
        relation,
      }),
    });
  },

  getChildren: (parentUserId) =>
    request(`/parent/children/${parentUserId}`),

  getPendingLinks: () =>
    request('/parent/pending-links'),

  // ── Student Overview (Home Dashboard) ──
  getChildOverview: (studentId) =>
    request(`/parent/student-overview/${studentId}`),

  // ── Attendance ──
  getStudentAttendance: (studentId, days = 60) =>
    request(`/attendance/student/${studentId}?days=${days}`),

  // ── Report Cards ──
  getReportCard: (studentId, examId = 'latest') =>
    request(`/report-cards/student/${studentId}/exam/${examId}`),

  // ── Homework ──
  getStudentHomework: (studentId) =>
    request(`/homework/student/${studentId}`),

  // ── Fees ──
  getStudentFeeDues: (studentId) =>
    request(`/fees/student/${studentId}/dues`),

  getFeeReceipt: (receiptNo) =>
    request(`/fees/receipts/${receiptNo}`),

  // ── Leave Management ──
  applyLeave: (data) =>
    request('/leaves/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getStudentLeaves: (studentId) =>
    request(`/leaves/student/${studentId}`),

  // ── Timetable ──
  getClassTimetable: (schoolId, grade = '10', section = 'A') =>
    request(`/timetable/class?school_id=${schoolId}&grade=${grade}&section=${section}`),

  getTodaySchedule: (schoolId, grade = '10', section = 'A') =>
    request(`/timetable/today?school_id=${schoolId}&grade=${grade}&section=${section}`),

  // ── Chat ──
  getChatContacts: (userId, schoolId) =>
    request(`/chat/contacts?user_id=${userId}&school_id=${schoolId}`),

  getChatMessages: (conversationId, limit = 50) =>
    request(`/chat/messages?conversation_id=${conversationId}&limit=${limit}`),

  sendChatMessage: (data) =>
    request('/chat/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  markChatRead: (conversationId, userId) =>
    request(`/chat/mark-read/${conversationId}?user_id=${userId}`, { method: 'PATCH' }),

  // ── Tickets ──
  getTickets: (schoolId, parentUserId) =>
    request(`/tickets/?school_id=${schoolId}&parent_user_id=${parentUserId}`),

  createTicket: (data) =>
    request('/tickets/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Announcements ──
  getAnnouncements: (schoolId) =>
    request(`/announcements/?school_id=${schoolId}&target_role=PARENTS`),

  // ── File Upload ──
  uploadFile: async (fileUri, fileName, fileType) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName || 'upload.jpg',
      type: fileType || 'image/jpeg',
    });
    const res = await fetch(`${API_BASE}/upload/file`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return await res.json();
  },

  // ── C10: Encrypted Exam Answer Sheets (AES-256) ──
  getStudentExamSheets: (studentId, parentUserId) =>
    request(`/exam-sheets/student/${studentId}?requester_user_id=${parentUserId}`),

  getExamSheetViewUrl: (sheetId, parentUserId) =>
    `${API_BASE}/exam-sheets/view/${sheetId}?requester_user_id=${parentUserId}`,

  // ── C1: AI Risk Prediction ──
  getStudentRiskPrediction: (studentId) =>
    request(`/risk/predict/student/${studentId}`),

  // ── C4: PTC (Parent-Teacher Conferences) ──
  getPTCEvents: (schoolId) =>
    request(`/ptc/events?school_id=${schoolId}`),

  getPTCSlots: (eventId, teacherId) =>
    request(`/ptc/slots?event_id=${eventId}${teacherId ? `&teacher_id=${teacherId}` : ''}`),

  bookPTCSlot: (slotId, data) =>
    request(`/ptc/slots/${slotId}/book`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyPTCBookings: (parentUserId) =>
    request(`/ptc/my-bookings?parent_user_id=${parentUserId}`),

  cancelPTCBooking: (bookingId) =>
    request(`/ptc/bookings/${bookingId}/cancel`, { method: 'POST' }),

  // ── C5: Transfer Certificates & Bonafide ──
  applyCertificate: (data) =>
    request('/certificates/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getStudentCertificates: (studentId) =>
    request(`/certificates/student/${studentId}`),

  getCertificateViewUrl: (certNumber) =>
    `${API_BASE}/certificates/view/${encodeURIComponent(certNumber)}/html`,

  // ── C3: Public Cryptographic Receipts ──
  getReceiptVerifyUrl: (receiptNo) =>
    `${API_BASE}/fees/verify-receipt/${encodeURIComponent(receiptNo)}`,

  // ── Real-World 10-Feature Enhancements ──
  getDailyDigest: (studentId) =>
    request(`/parent/daily-digest/${studentId}`),

  getStudentDiary: (studentId) =>
    request(`/diary/student/${studentId}`),

  acknowledgeDiaryEntry: (entryId) =>
    request(`/diary/${entryId}/acknowledge`, { method: 'PATCH' }),

  getProgressLetterHtmlUrl: (studentId, examId = '') =>
    `${API_BASE}/report-cards/student/${studentId}/progress-letter/html${examId ? `?exam_id=${examId}` : ''}`,

  // ── 12-Module Real-World Expansion APIs ──

  // 1. Gate Pass Lifecycle
  requestGatePass: (data) =>
    request('/gate-passes/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getStudentGatePasses: (studentId) =>
    request(`/gate-passes/student/${studentId}`),

  getGatePassDetails: (passId) =>
    request(`/gate-passes/${passId}`),

  // 2. Datesheets (Exam Timetable)
  getGradeDatesheets: (grade) =>
    request(`/datesheets/class/${grade}`),

  // 3. School Almanac & Rulebook
  getSchoolAlmanac: (schoolId) =>
    request(`/almanac/school/${schoolId}`),

  // 4. Holiday Calendar & Next Holiday Countdown
  getSchoolHolidays: (schoolId) =>
    request(`/holidays/school/${schoolId}`),

  // 5. Photo Gallery & Event Albums
  getGalleryAlbums: (schoolId) =>
    request(`/gallery/albums/${schoolId}`),

  // 6. Campus Activity Timeline
  getCampusActivities: (schoolId) =>
    request(`/activities/school/${schoolId}`),

  // 7. Scoped Teachers Directory
  getStudentTeachers: (studentId) =>
    request(`/parent/student/${studentId}/teachers`),

  // 8. Notification Permissions (WhatsApp, Email, SMS)
  getNotificationPreferences: (parentUserId) =>
    request(`/parent-profile/channels/${parentUserId}`),

  updateNotificationPreferences: (parentUserId, prefs) =>
    request(`/parent-profile/channels/${parentUserId}`, {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),

  // 9. Parent Profile Self-Service
  getParentProfile: (parentUserId) =>
    request(`/parent-profile/${parentUserId}`),

  updateParentProfile: (parentUserId, data) =>
    request(`/parent-profile/${parentUserId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // 10. School Branding & Theme
  getSchoolBranding: (schoolId) =>
    request(`/branding/${schoolId}`),

  // 11. Today's Birthdays (for celebration banner)
  getTodaysBirthdays: (schoolId) =>
    request(`/birthdays/today/${schoolId}`),
};


