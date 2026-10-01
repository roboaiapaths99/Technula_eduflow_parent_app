import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { theme } from '../theme';

/**
 * Interactive In-App Heads-Up Banner (Pops from above like Zomato/Swiggy)
 */
export default function HeadsUpBanner({
  visible,
  title,
  message,
  data = {},
  onPress,
  onDismiss,
}) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide down into view
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: Platform.OS === 'ios' ? 50 : 25,
          useNativeDriver: true,
          tension: 60,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 6.5 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 6500);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={() => {
          handleDismiss();
          if (onPress) onPress(data);
        }}
      >
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>📢</Text>
        </View>

        <View style={styles.contentCol}>
          <View style={styles.headerRow}>
            <Text style={styles.channelBadge}>CAMPUS BROADCAST</Text>
            <Text style={styles.timeBadge}>Just now</Text>
          </View>
          <Text style={styles.titleText} numberOfLines={1}>
            {title || 'School Announcement'}
          </Text>
          <Text style={styles.bodyText} numberOfLines={2}>
            {message || 'A new circular has been published.'}
          </Text>
        </View>

        <View style={styles.actionCol}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { handleDismiss(); if (onPress) onPress(data); }}>
            <Text style={styles.actionBtnText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 99999,
  },
  card: {
    backgroundColor: '#0F172A', // Sleek dark slate glass style
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 22,
  },
  contentCol: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  channelBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 0.5,
  },
  timeBadge: {
    fontSize: 10,
    color: '#94A3B8',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  actionCol: {
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
});
