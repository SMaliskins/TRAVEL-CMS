import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { apiClient } from '../api/client'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null

    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted')
      return null
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined,
    })
    const token = tokenData.data

    await apiClient.patch('/profile', { notificationToken: token })

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      })
    }

    return token
  } catch (err) {
    console.error('[Push] Registration error:', err)
    return null
  }
}
