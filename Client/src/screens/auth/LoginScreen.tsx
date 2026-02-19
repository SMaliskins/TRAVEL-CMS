import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text>LoginScreen — coming in Task 11</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
})
