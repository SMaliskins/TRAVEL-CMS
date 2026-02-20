import React, { useMemo } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  Linking,
  TouchableOpacity,
  type TextStyle,
} from 'react-native'

interface ChatBubbleProps {
  message: string
  isUser: boolean
  timestamp?: string
}

type MdNode =
  | { type: 'text'; text: string; bold?: boolean; italic?: boolean }
  | { type: 'link'; text: string; url: string }
  | { type: 'image'; alt: string; url: string }
  | { type: 'linebreak' }

function parseInline(line: string): MdNode[] {
  const nodes: MdNode[] = []
  const regex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: line.slice(lastIndex, match.index) })
    }

    if (match[1] !== undefined || match[2] !== undefined) {
      nodes.push({ type: 'image', alt: match[1] ?? '', url: match[2] })
    } else if (match[3] !== undefined) {
      nodes.push({ type: 'link', text: match[3], url: match[4] })
    } else if (match[5] !== undefined) {
      nodes.push({ type: 'text', text: match[5], bold: true })
    } else if (match[6] !== undefined) {
      nodes.push({ type: 'text', text: match[6], italic: true })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < line.length) {
    nodes.push({ type: 'text', text: line.slice(lastIndex) })
  }

  return nodes
}

function isUrl(text: string): boolean {
  return /^https?:\/\/\S+/.test(text.trim())
}

function renderNodes(nodes: MdNode[], baseStyle: TextStyle, key: string) {
  return nodes.map((node, i) => {
    const k = `${key}-${i}`
    if (node.type === 'image') {
      return (
        <Image
          key={k}
          source={{ uri: node.url }}
          style={mdStyles.image}
          resizeMode="cover"
        />
      )
    }
    if (node.type === 'link') {
      return (
        <Text
          key={k}
          style={[baseStyle, mdStyles.link]}
          onPress={() => Linking.openURL(node.url)}
        >
          {node.text}
        </Text>
      )
    }
    if (node.type === 'linebreak') {
      return <Text key={k}>{'\n'}</Text>
    }

    let style: TextStyle = baseStyle
    if (node.bold) style = { ...baseStyle, fontWeight: '700' }
    if (node.italic) style = { ...baseStyle, fontStyle: 'italic' }

    if (isUrl(node.text)) {
      return (
        <Text
          key={k}
          style={[style, mdStyles.link]}
          onPress={() => Linking.openURL(node.text.trim())}
        >
          {node.text}
        </Text>
      )
    }

    return <Text key={k} style={style}>{node.text}</Text>
  })
}

function MarkdownContent({ text, baseStyle }: { text: string; baseStyle: TextStyle }) {
  const elements = useMemo(() => {
    const lines = text.split('\n')
    const result: React.ReactNode[] = []

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]

      if (line.startsWith('### ')) {
        result.push(
          <Text key={`h3-${li}`} style={[baseStyle, mdStyles.h3]}>
            {line.slice(4)}
          </Text>
        )
        continue
      }
      if (line.startsWith('## ')) {
        result.push(
          <Text key={`h2-${li}`} style={[baseStyle, mdStyles.h2]}>
            {line.slice(3)}
          </Text>
        )
        continue
      }

      const bulletMatch = line.match(/^(\s*)([-•*]\s+|(\d+)\.\s+)(.*)/)
      if (bulletMatch) {
        const indent = bulletMatch[1].length
        const isOrdered = !!bulletMatch[3]
        const bullet = isOrdered ? `${bulletMatch[3]}.` : '•'
        const content = bulletMatch[4]
        const nodes = parseInline(content)
        result.push(
          <View key={`li-${li}`} style={[mdStyles.listItem, { paddingLeft: 4 + indent * 8 }]}>
            <Text style={[baseStyle, mdStyles.bullet]}>{bullet} </Text>
            <Text style={[baseStyle, { flex: 1 }]}>
              {renderNodes(nodes, baseStyle, `lin-${li}`)}
            </Text>
          </View>
        )
        continue
      }

      const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (imgMatch) {
        result.push(
          <Image
            key={`img-${li}`}
            source={{ uri: imgMatch[2] }}
            style={mdStyles.image}
            resizeMode="cover"
          />
        )
        continue
      }

      if (line.trim() === '') {
        result.push(<View key={`sp-${li}`} style={mdStyles.spacer} />)
        continue
      }

      const nodes = parseInline(line)
      result.push(
        <Text key={`p-${li}`} style={baseStyle}>
          {renderNodes(nodes, baseStyle, `p-${li}`)}
        </Text>
      )
    }

    return result
  }, [text, baseStyle])

  return <>{elements}</>
}

export function ChatBubble({ message, isUser, timestamp }: ChatBubbleProps) {
  const baseTextStyle: TextStyle = isUser ? { ...styles.text, ...styles.userText } : { ...styles.text, ...styles.aiText }

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>✈</Text>
        </View>
      )}
      <View style={styles.bubbleWrapper}>
        {!isUser && <Text style={styles.aiLabel}>Travel Concierge</Text>}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {isUser ? (
            <Text style={baseTextStyle}>{message}</Text>
          ) : (
            <MarkdownContent text={message} baseStyle={baseTextStyle} />
          )}
        </View>
        {timestamp && (
          <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>
            {timestamp}
          </Text>
        )}
      </View>
    </View>
  )
}

const mdStyles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '700', marginBottom: 4, marginTop: 6 },
  h3: { fontSize: 15, fontWeight: '700', marginBottom: 2, marginTop: 4 },
  link: { color: '#1a73e8', textDecorationLine: 'underline' },
  image: { width: '100%', height: 160, borderRadius: 10, marginVertical: 6 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 1 },
  bullet: { width: 18 },
  spacer: { height: 6 },
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  aiAvatarText: {
    fontSize: 14,
    color: '#fff',
  },
  bubbleWrapper: {
    flexShrink: 1,
  },
  aiLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
    marginLeft: 2,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: '#1a73e8',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#222',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 3,
  },
  userTimestamp: {
    color: '#aaa',
    textAlign: 'right',
    marginRight: 2,
  },
  aiTimestamp: {
    color: '#bbb',
    marginLeft: 2,
  },
})
