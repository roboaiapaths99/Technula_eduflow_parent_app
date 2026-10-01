import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform,
  Image, Alert
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase, formatUserError, isPlanRestrictedError } from '../api';
import FeatureUnavailableCard from '../components/FeatureUnavailableCard';

export default function ChatScreen({ user = {}, activeChild = null } = {}) {
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const flatListRef = useRef(null);
  const pollRef = useRef(null);

  const userId = user?.id;
  const schoolId = activeChild?.school_id;

  useEffect(() => {
    loadContacts();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [schoolId]);

  const loadContacts = async () => {
    if (!userId || !schoolId) { setLoading(false); return; }
    setLoading(true);
    try {
      setError(null);
      const res = await parentApi.getChatContacts(userId, schoolId);
      setContacts(res || []);
    } catch (e) {
      setError(formatUserError(e, 'Failed to load contacts'));
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (contact) => {
    setActiveContact(contact);
    const convId = [userId, contact.user_id].sort().join('_');
    try {
      const msgs = await parentApi.getChatMessages(convId);
      setMessages(msgs || []);
      await parentApi.markChatRead(convId, userId).catch(() => {});
      setContacts(prev => prev.map(c => c.user_id === contact.user_id ? { ...c, unread_count: 0 } : c));
    } catch (e) {
      console.warn(e);
    }
    // Poll for new messages
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const msgs = await parentApi.getChatMessages(convId);
        setMessages(msgs || []);
      } catch (e) {}
    }, 5000);
  };

  const goBack = () => {
    setActiveContact(null);
    setMessages([]);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeContact) return;
    setSending(true);
    try {
      await parentApi.sendChatMessage({
        school_id: schoolId,
        sender_user_id: userId,
        receiver_user_id: activeContact.user_id,
        message_type: 'TEXT',
        content: newMessage.trim(),
      });
      setNewMessage('');
      const convId = [userId, activeContact.user_id].sort().join('_');
      const msgs = await parentApi.getChatMessages(convId);
      setMessages(msgs || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setSending(false);
    }
  };

  const handlePickMedia = async () => {
    if (!activeContact) return;
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setSending(true);
          try {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await fetch(`${getApiBase()}/upload/file`, {
              method: 'POST',
              body: formData,
            }).then(r => r.json());
            if (uploadRes.url) {
              await parentApi.sendChatMessage({
                school_id: schoolId,
                sender_user_id: userId,
                receiver_user_id: activeContact.user_id,
                message_type: 'IMAGE',
                content: file.name || 'Shared an image',
                media_url: uploadRes.url,
              });
              const convId = [userId, activeContact.user_id].sort().join('_');
              const msgs = await parentApi.getChatMessages(convId);
              setMessages(msgs || []);
            }
          } catch (err) {
            Alert.alert('Upload Failed', formatUserError(err, 'Could not send photo'));
          } finally {
            setSending(false);
          }
        };
        input.click();
      } else {
        // Native photo library safe dynamic check
        let ImagePicker = null;
        try {
          ImagePicker = require('expo-image-picker');
        } catch (e) {
          ImagePicker = null;
        }

        if (ImagePicker && ImagePicker.launchImageLibraryAsync) {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setSending(true);
            try {
              const uploadRes = await parentApi.uploadFile(
                asset.uri,
                asset.fileName || 'photo.jpg',
                asset.mimeType || 'image/jpeg'
              );
              if (uploadRes.url) {
                await parentApi.sendChatMessage({
                  school_id: schoolId,
                  sender_user_id: userId,
                  receiver_user_id: activeContact.user_id,
                  message_type: 'IMAGE',
                  content: asset.fileName || 'Shared an image',
                  media_url: uploadRes.url,
                });
                const convId = [userId, activeContact.user_id].sort().join('_');
                const msgs = await parentApi.getChatMessages(convId);
                setMessages(msgs || []);
              }
            } catch (err) {
              Alert.alert('Upload Failed', formatUserError(err, 'Could not send photo.'));
            } finally {
              setSending(false);
            }
          }
        } else {
          Alert.alert(
            'Photo Attachment',
            'Image uploads can also be sent via the web portal or text messages can be shared directly here.'
          );
        }
      }
    } catch (e) {
      console.warn(e);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (error) {
    if (isPlanRestrictedError(error)) {
      return (
        <ScrollView contentContainerStyle={{ paddingVertical: 20 }}>
          <FeatureUnavailableCard
            icon="💬"
            title="School Messaging Not Activated"
            subtitle="Direct messaging between parents and school faculty has not been activated by your school administration yet. Messages will be enabled here once activated."
            onRetry={loadContacts}
          />
        </ScrollView>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadContacts}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
      </View>
    );
  }

  // ── Conversation Thread View ──
  if (activeContact) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#F8FAFC' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <View style={styles.contactAvatar}>
            <Text style={styles.contactAvatarText}>
              {(activeContact.full_name || 'T')[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.chatHeaderName}>{activeContact.full_name}</Text>
            <Text style={styles.chatHeaderRole}>{activeContact.role || 'Teacher'}</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: msg }) => {
            const isMine = msg.sender_user_id === userId;
            const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const mediaUrl = msg.media_url ? (msg.media_url.startsWith('http') ? msg.media_url : `${getApiBase()}${msg.media_url}`) : null;

            return (
              <View style={{ alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {mediaUrl && (
                    <Image
                      source={{ uri: mediaUrl }}
                      style={styles.chatImage}
                      resizeMode="cover"
                    />
                  )}
                  {msg.content ? (
                    <Text style={[styles.bubbleText, isMine && { color: '#fff' }]}>{msg.content}</Text>
                  ) : null}
                  <Text style={[styles.bubbleTime, isMine && { color: 'rgba(255,255,255,0.7)' }]}>{time}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
              <Text style={styles.emptyText}>Start a conversation with {activeContact.full_name}</Text>
            </View>
          }
        />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={handlePickMedia}
            disabled={sending}
          >
            <Text style={{ fontSize: 18 }}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.chatInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || sending) && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Contacts List View ──
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadContacts} />}
    >
      <View style={styles.headerSection}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Chat with {activeChild?.name}'s teachers</Text>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
          <Text style={styles.emptyText}>No teachers available for chat yet.</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {contacts.map((c) => (
            <TouchableOpacity key={c.user_id} style={styles.contactCard} onPress={() => openConversation(c)} activeOpacity={0.7}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>{(c.full_name || 'T')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.full_name}</Text>
                <Text style={styles.contactRole}>{c.role || 'Teacher'}{c.subject_name ? ` • ${c.subject_name}` : ''}</Text>
                {c.last_message && (
                  <Text style={styles.lastMsg} numberOfLines={1}>{c.last_message}</Text>
                )}
              </View>
              {(c.unread_count || 0) > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{c.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgMain },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 14, color: theme.colors.rose, textAlign: 'center', marginBottom: 16 },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  retryBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
  headerSection: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary },
  subtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: theme.radius.lg, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card,
  },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: theme.radius.lg, padding: 14,
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card,
  },
  contactAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  contactAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  contactName: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  contactRole: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  lastMsg: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  unreadBadge: {
    backgroundColor: theme.colors.primary, width: 22, height: 22,
    borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  // Chat Thread Styles
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backBtn: { padding: 4 },
  chatHeaderName: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  chatHeaderRole: { fontSize: 12, color: theme.colors.textSecondary },
  emptyChat: { alignItems: 'center', paddingVertical: 60 },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 14, marginHorizontal: 4 },
  bubbleMine: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.colors.border },
  bubbleText: { fontSize: 14, lineHeight: 20, color: theme.colors.textPrimary },
  bubbleTime: { fontSize: 10, color: theme.colors.textMuted, marginTop: 4, textAlign: 'right' },
  chatImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#E2E8F0',
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  attachBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  chatInput: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: theme.colors.primary, width: 40, height: 40,
    borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
