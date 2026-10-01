import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parentApi, formatUserError, saveSelectedSchool } from '../api';
import { theme } from '../theme';

export default function SchoolSelectScreen({ onSchoolSelected }) {
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'search'
  const [schoolCode, setSchoolCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeSchool, setCodeSchool] = useState(null);

  const [popularCampuses, setPopularCampuses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Load real registered campuses from backend
  useEffect(() => {
    parentApi.searchSchools('').then((res) => {
      const list = Array.isArray(res) ? res : (res?.schools || []);
      if (list && list.length > 0) {
        setPopularCampuses(list.slice(0, 6));
      }
    }).catch(() => {});
  }, []);

  // Auto-search only when user types
  useEffect(() => {
    if (activeTab !== 'search') return;
    const cleanTerm = searchQuery.trim();
    if (!cleanTerm) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      handleSearch(cleanTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const handleLookupCode = async (codeToLookup = null) => {
    const code = (codeToLookup || schoolCode).trim().toUpperCase();
    if (!code) {
      Alert.alert('Required', 'Please enter your School Code.');
      return;
    }
    setCodeLoading(true);
    try {
      const res = await parentApi.getSchoolByCode(code);
      setCodeSchool(res);
    } catch (err) {
      setCodeSchool(null);
      Alert.alert('School Not Found', formatUserError(err, `No active institution found matching code "${code}". Please check with your school office.`));
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSearch = async (term) => {
    const q = (term || '').trim();
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await parentApi.searchSchools(q);
      const list = Array.isArray(results) ? results : (results?.schools || []);
      setSearchResults(list);
    } catch (err) {
      console.warn('School search failed:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleConfirmSchool = async (school) => {
    if (!school) return;
    await saveSelectedSchool(school);
    onSchoolSelected(school);
  };

  const handleSelectQuickCampus = (campus) => {
    setSchoolCode(campus.code);
    handleLookupCode(campus.code);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Modern Clean Header */}
        <View style={styles.header}>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>INSTITUTION SETUP</Text>
          </View>
          <Text style={styles.title}>Select Your School</Text>
          <Text style={styles.subtitle}>
            Connect with your child's verified campus to view attendance, exam marks, homework & diary.
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'code' && styles.tabButtonActive]}
            onPress={() => setActiveTab('code')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === 'code' && styles.tabButtonTextActive]}>
              🏷️ School Code
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'search' && styles.tabButtonActive]}
            onPress={() => {
              setActiveTab('search');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === 'search' && styles.tabButtonTextActive]}>
              🔍 Search Directory
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: SCHOOL CODE LOOKUP */}
        {activeTab === 'code' && (
          <View style={styles.card}>
            <Text style={styles.inputLabel}>ENTER INSTITUTION CODE</Text>
            <Text style={styles.inputHelper}>
              Provided in your admission slip or school circular.
            </Text>

            <View style={styles.codeRow}>
              <TextInput
                style={styles.codeInput}
                value={schoolCode}
                onChangeText={(text) => {
                  const cleaned = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                  setSchoolCode(cleaned);
                }}
                placeholder="Enter School Code"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                maxLength={10}
                returnKeyType="search"
                onSubmitEditing={() => handleLookupCode()}
              />
              <TouchableOpacity
                style={styles.lookupButton}
                onPress={() => handleLookupCode()}
                disabled={codeLoading}
                activeOpacity={0.85}
              >
                {codeLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.lookupButtonText}>Verify</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Verified School Preview Card */}
            {codeSchool && (
              <View style={styles.verifiedCard}>
                <View style={styles.verifiedHeader}>
                  <View style={styles.verifiedTag}>
                    <Text style={styles.verifiedTagText}>✓ VERIFIED INSTITUTION</Text>
                  </View>
                  <Text style={styles.verifiedCode}>{codeSchool.code}</Text>
                </View>

                <Text style={styles.verifiedName}>{codeSchool.name}</Text>
                <Text style={styles.verifiedCity}>
                  📍 {codeSchool.city || 'Campus'}{codeSchool.state ? `, ${codeSchool.state}` : ''} • {codeSchool.board || 'CBSE'} Board
                </Text>

                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={() => handleConfirmSchool(codeSchool)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.continueButtonText}>Connect to School →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: SEARCH BY NAME */}
        {activeTab === 'search' && (
          <View style={styles.card}>
            <Text style={styles.inputLabel}>CAMPUS OR CITY NAME</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search school name or city..."
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
            />

            {searchLoading ? (
              <View style={styles.searchLoader}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.searchLoaderText}>Searching directory...</Text>
              </View>
            ) : !searchQuery.trim() ? (
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsSub}>Type your school name or city above to find your institution.</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsText}>No matching institutions found.</Text>
                <Text style={styles.emptyResultsSub}>Try typing another keyword or enter your 6-digit School Code above.</Text>
              </View>
            ) : (
              <View style={styles.resultsList}>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.resultItem}
                    onPress={() => handleConfirmSchool(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultInfo}>
                      <View style={styles.resultTitleRow}>
                        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                        {item.code ? (
                          <View style={styles.resultCodeBadge}>
                            <Text style={styles.resultCodeText}>{item.code}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.resultSub}>
                        📍 {item.city || 'Campus'}{item.state ? `, ${item.state}` : ''} • {item.board || 'CBSE'}
                      </Text>
                    </View>
                    <Text style={styles.resultChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeContainer: {
    backgroundColor: 'rgba(99, 91, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 91, 255, 0.2)',
    marginBottom: 10,
  },
  badgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A2540',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 320,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  quickSection: {
    marginBottom: 18,
  },
  quickTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  quickChipsGrid: {
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(99, 91, 255, 0.04)',
  },
  chipTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chipCode: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  chipCodeSelected: {
    color: theme.colors.primary,
  },
  chipCity: {
    fontSize: 11,
    color: '#64748B',
  },
  chipName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A2540',
  },
  chipNameSelected: {
    color: theme.colors.primary,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inputLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  inputHelper: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '800',
    color: '#0A2540',
    letterSpacing: 1.5,
  },
  lookupButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  verifiedCard: {
    marginTop: 18,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 16,
  },
  verifiedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verifiedTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedTagText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verifiedCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 1,
  },
  verifiedName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A2540',
    marginBottom: 4,
  },
  verifiedCity: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 14,
  },
  continueButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0A2540',
    marginBottom: 14,
  },
  searchLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  searchLoaderText: {
    color: '#64748B',
    fontSize: 13,
  },
  emptyResults: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  emptyResultsSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 260,
  },
  resultsList: {
    gap: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
  },
  resultInfo: {
    flex: 1,
    marginRight: 10,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  resultName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A2540',
    flex: 1,
  },
  resultCodeBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resultCodeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  resultSub: {
    fontSize: 11,
    color: '#64748B',
  },
  resultChevron: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: '700',
  },
});
