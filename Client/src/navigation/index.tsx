import React, { useEffect, useMemo } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { ActivityIndicator, View } from 'react-native'
import * as Linking from 'expo-linking'
import { useAuthStore } from '../store/authStore'
import { AuthStack } from './AuthStack'
import { MainStack } from './MainStack'

export function RootNavigator() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

  const linking = useMemo(
    () =>
      isAuthenticated
        ? undefined
        : {
            prefixes: [Linking.createURL('/'), 'mytravelconcierge://'],
            config: {
              screens: {
                Login: '',
                Register: {
                  path: 'register',
                  parse: {
                    invitationToken: (value: string) =>
                      value ? decodeURIComponent(value) : '',
                  },
                },
              },
            },
          },
    [isAuthenticated]
  )

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1a3a5c" />
      </View>
    )
  }

  return (
    <NavigationContainer linking={linking}>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  )
}
