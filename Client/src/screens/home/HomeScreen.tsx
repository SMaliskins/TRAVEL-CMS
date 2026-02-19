import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>HomeScreen — coming in Task 12</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
})
