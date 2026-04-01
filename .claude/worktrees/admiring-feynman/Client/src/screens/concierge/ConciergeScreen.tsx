import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native'
import { ChatBubble } from '../../components/ChatBubble'
import { conciergeApi } from '../../api/concierge'

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: string
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  text: 'Hello! I\'m your Travel Concierge ✈\n\nI can help you find hotels, transfers, and answer travel questions. How can I help?',
  isUser: false,
  timestamp: '',
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current
  const dot2 = useRef(new Animated.Value(0)).current
  const dot3 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      )
    const a1 = animate(dot1, 0)
    const a2 = animate(dot2, 200)
    const a3 = animate(dot3, 400)
    a1.start(); a2.start(); a3.start()
    return () => { a1.stop(); a2.stop(); a3.stop() }
  }, [dot1, dot2, dot3])

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
  })

  return (
    <View style={styles.typingIndicator}>
      <Text style={styles.typingLabel}>typing</Text>
      <View style={styles.dotsRow}>
        <Animated.Text style={[styles.dot, dotStyle(dot1)]}>·</Animated.Text>
        <Animated.Text style={[styles.dot, dotStyle(dot2)]}>·</Animated.Text>
        <Animated.Text style={[styles.dot, dotStyle(dot3)]}>·</Animated.Text>
      </View>
    </View>
  )
}

export function ConciergeScreen() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const listRef = useRef<FlatList<Message>>(null)

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      isUser: true,
      timestamp: formatTime(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    scrollToEnd()

    try {
      const result = await conciergeApi.sendMessage(text, sessionId)
      if (!sessionId && result.sessionId) setSessionId(result.sessionId)

      const reply: Message = {
        id: `ai-${Date.now()}`,
        text: result.message || 'Sorry, I could not respond. Please try again.',
        isUser: false,
        timestamp: formatTime(),
      }
      setMessages((prev) => [...prev, reply])
    } catch {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: 'Connection error. Check your internet and try again.',
        isUser: false,
        timestamp: formatTime(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      scrollToEnd()
    }
  }, [input, isLoading, sessionId, scrollToEnd])

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <ChatBubble message={item.text} isUser={item.isUser} timestamp={item.timestamp || undefined} />
    ),
    []
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>✈</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Travel Concierge</Text>
          <Text style={styles.headerSub}>Hotels, transfers & travel advice</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToEnd}
      />

      {isLoading && <TypingDots />}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#aaa"
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.sendButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#d0d8e0',
    gap: 12,
  },
  headerIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1a3a5c',
    justifyContent: 'center', alignItems: 'center',
  },
  headerIconText: { fontSize: 18, color: '#fff' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', letterSpacing: 0.3 },
  headerSub: { fontSize: 11, color: '#8a8a9a', marginTop: 2, letterSpacing: 0.3 },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#dcfce7', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16a34a' },
  liveText: { fontSize: 11, fontWeight: '600', color: '#16a34a' },

  list: { paddingVertical: 12, paddingBottom: 8 },

  typingIndicator: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 6, gap: 2,
  },
  typingLabel: { fontSize: 12, color: '#8a8a9a', fontWeight: '500' },
  dotsRow: { flexDirection: 'row', gap: 1 },
  dot: { fontSize: 24, color: '#8a8a9a', fontWeight: '700', lineHeight: 20 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 10, paddingBottom: Platform.OS === 'ios' ? 26 : 14,
    backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#d0d8e0', gap: 8,
  },
  input: {
    flex: 1, backgroundColor: '#f0f2f5', borderRadius: 22,
    paddingHorizontal: 18, paddingTop: 11, paddingBottom: 11,
    fontSize: 15, color: '#1a1a2e', maxHeight: 120, lineHeight: 20,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#c9a96e',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#c9a96e',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  sendButtonDisabled: { backgroundColor: '#d0d8e0', shadowOpacity: 0 },
  sendButtonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
})
