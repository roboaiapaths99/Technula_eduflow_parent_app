import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

export default function CircularAttendanceCard({
  rate = 0,
  presentCount = 0,
  absentCount = 0,
  totalSessions = 0,
  recentStatus = '',
  studentName = 'Student',
  onViewDetails,
}) {
  const numRate = Number(rate) || 0;
  const clampedRate = Math.min(Math.max(numRate, 0), 100);

  // Dynamic theme colors based on CBSE 75% benchmark
  let strokeColor = '#10B981'; // Emerald
  let strokeBg = '#ECFDF5';
  let statusTextColor = '#047857';
  let statusText = 'Excellent Standing';

  if (totalSessions === 0) {
    strokeColor = '#94A3B8';
    strokeBg = '#F1F5F9';
    statusTextColor = '#64748B';
    statusText = 'No Attendance Marked';
  } else if (clampedRate < 75) {
    strokeColor = '#EF4444'; // Rose
    strokeBg = '#FEF2F2';
    statusTextColor = '#B91C1C';
    statusText = 'Below 75% CBSE Target';
  } else if (clampedRate < 85) {
    strokeColor = '#F59E0B'; // Amber
    strokeBg = '#FFFBEB';
    statusTextColor = '#B45309';
    statusText = 'On Track (CBSE Met)';
  }

  const size = 110;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onViewDetails}
      activeOpacity={0.88}
    >
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.headerIcon}>📊</Text>
          <Text style={styles.headerTitle}>ATTENDANCE PERFORMANCE</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: strokeBg }]}>
          <View style={[styles.statusDot, { backgroundColor: strokeColor }]} />
          <Text style={[styles.statusPillText, { color: statusTextColor }]}>
            {statusText}
          </Text>
        </View>
      </View>

      {/* Main Body Row: Gauge + Metric Breakdown */}
      <View style={styles.bodyRow}>
        {/* Pure Native Circular Dial Gauge (Zero-Crash Native Architecture) */}
        <View style={[styles.gaugeContainer, { width: size, height: size }]}>
          {/* Outer Track Ring */}
          <View style={[styles.outerTrack, { width: size, height: size, borderRadius: size / 2 }]}>
            {/* Color Accent Progress Ring */}
            <View
              style={[
                styles.progressRing,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderColor: strokeColor,
                  borderTopColor: strokeColor,
                  borderRightColor: clampedRate >= 50 ? strokeColor : '#E2E8F0',
                  borderBottomColor: clampedRate >= 75 ? strokeColor : '#E2E8F0',
                  borderLeftColor: clampedRate >= 90 ? strokeColor : '#E2E8F0',
                },
              ]}
            />
          </View>

          {/* Inner Glowing Center Card */}
          <View
            style={[
              styles.gaugeCenter,
              {
                width: size - 22,
                height: size - 22,
                borderRadius: (size - 22) / 2,
                backgroundColor: strokeBg,
              },
            ]}
          >
            <Text style={[styles.gaugeRate, { color: strokeColor }]}>
              {totalSessions === 0 ? '--' : `${clampedRate.toFixed(1)}%`}
            </Text>
            <Text style={styles.gaugeLabel}>{totalSessions === 0 ? 'NOT MARKED' : 'ATTENDED'}</Text>
          </View>
        </View>

        {/* Right Metric Details */}
        <View style={styles.metricsCol}>
          {/* Present Metric Box */}
          <View style={styles.metricItem}>
            <View style={[styles.metricDot, { backgroundColor: '#10B981' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>Present Sessions</Text>
              <Text style={styles.metricValue}>
                {presentCount}{' '}
                <Text style={styles.metricSub}>/ {totalSessions} days</Text>
              </Text>
            </View>
          </View>

          {/* Absent Metric Box */}
          <View style={styles.metricItem}>
            <View style={[styles.metricDot, { backgroundColor: absentCount > 0 ? '#EF4444' : '#94A3B8' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>Absent Sessions</Text>
              <Text style={[styles.metricValue, { color: absentCount > 0 ? '#DC2626' : '#64748B' }]}>
                {absentCount}{' '}
                <Text style={styles.metricSub}>recorded</Text>
              </Text>
            </View>
          </View>

          {/* Recent Status Pill */}
          <View style={styles.recentStatusRow}>
            <Text style={styles.recentLabel}>Latest Status: </Text>
            <Text
              style={[
                styles.recentVal,
                {
                  color:
                    recentStatus?.toLowerCase() === 'present'
                      ? '#059669'
                      : recentStatus?.toLowerCase() === 'absent'
                      ? '#DC2626'
                      : '#475569',
                },
              ]}
            >
              ● {recentStatus || 'No record'}
            </Text>
          </View>
        </View>
      </View>

      {/* Footer Milestone strip */}
      <View style={styles.footerRow}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerTargetText}>
            Target: <Text style={{ fontWeight: '800' }}>75.0%</Text> CBSE Mandatory
          </Text>
        </View>
        <Text style={styles.viewRegisterLink}>
          Detailed Register & Calendar ›
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  outerTrack: {
    position: 'absolute',
    borderWidth: 8,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
    borderWidth: 8,
    transform: [{ rotate: '-45deg' }],
  },
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeRate: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  gaugeLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  metricsCol: {
    flex: 1,
    gap: 8,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 1,
  },
  metricSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  recentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  recentLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  recentVal: {
    fontSize: 11,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerTargetText: {
    fontSize: 11,
    color: '#64748B',
  },
  viewRegisterLink: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
