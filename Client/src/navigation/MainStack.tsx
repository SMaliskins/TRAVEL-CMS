import React, { useCallback, useEffect, useRef, useState } from 'react'
import { TouchableOpacity, View, Text, StyleSheet, AppState } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { notificationsApi } from '../api/notifications'

import { HomeScreen } from '../screens/home/HomeScreen'
import { TripsScreen } from '../screens/trips/TripsScreen'
import { TripDetailScreen } from '../screens/trips/TripDetailScreen'
import { ConciergeScreen } from '../screens/concierge/ConciergeScreen'
import { DocumentsScreen } from '../screens/documents/DocumentsScreen'
import { ProfileScreen } from '../screens/profile/ProfileScreen'
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen'

export type MainTabParamList = {
  Home: undefined
  TripsTab: undefined
  Concierge: undefined
  Documents: undefined
  Profile: undefined
}

export type TripsStackParamList = {
  TripsList: undefined
  TripDetail: { bookingId: string }
}

export type RootStackParamList = {
  Tabs: undefined
  Notifications: undefined
  TripDetailFromHome: { bookingId: string }
}

const Tab = createBottomTabNavigator<MainTabParamList>()
const TripsStack = createNativeStackNavigator<TripsStackParamList>()
const RootStack = createNativeStackNavigator<RootStackParamList>()

const POLL_MS = 30_000

function BellButton() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [unread, setUnread] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(() => {
    notificationsApi.getAll()
      .then((r) => setUnread(r.unreadCount))
      .catch(() => {})
  }, [])

  useFocusEffect(
    useCallback(() => {
      poll()
      ref.current = setInterval(poll, POLL_MS)
      return () => { if (ref.current) clearInterval(ref.current) }
    }, [poll])
  )

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') poll() })
    return () => sub.remove()
  }, [poll])

  return (
    <TouchableOpacity onPress={() => nav.navigate('Notifications')} style={bellStyles.btn} activeOpacity={0.7}>
      <Feather name="bell" size={22} color="#333" />
      {unread > 0 && (
        <View style={bellStyles.badge}>
          <Text style={bellStyles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const bellStyles = StyleSheet.create({
  btn: { padding: 6, marginRight: 4, position: 'relative' },
  badge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#ff3b30', borderRadius: 9,
    minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
})

function TripsNavigator() {
  return (
    <TripsStack.Navigator>
      <TripsStack.Screen
        name="TripsList"
        component={TripsScreen}
        options={{ title: 'Trips' }}
      />
      <TripsStack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: 'Trip Details' }}
      />
    </TripsStack.Navigator>
  )
}

function TabNavigator() {
  const bellRight = () => ({ headerRight: () => <BellButton /> })

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#9e9e9e',
        headerShown: true,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{
        title: 'Home',
        tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        ...bellRight(),
      }} />
      <Tab.Screen name="TripsTab" component={TripsNavigator} options={{
        title: 'Trips',
        headerShown: false,
        tabBarIcon: ({ color, size }) => <Feather name="map" size={size} color={color} />,
      }} />
      <Tab.Screen name="Concierge" component={ConciergeScreen} options={{
        title: 'Concierge',
        tabBarIcon: ({ color, size }) => <Feather name="message-circle" size={size} color={color} />,
      }} />
      <Tab.Screen name="Documents" component={DocumentsScreen} options={{
        title: 'Documents',
        tabBarIcon: ({ color, size }) => <Feather name="file-text" size={size} color={color} />,
        ...bellRight(),
      }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{
        title: 'Profile',
        tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
      }} />
    </Tab.Navigator>
  )
}

export function MainStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Tabs" component={TabNavigator} />
      <RootStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ animation: 'slide_from_right', headerShown: true, title: 'Notifications' }}
      />
      <RootStack.Screen
        name="TripDetailFromHome"
        component={TripDetailScreen}
        options={{ animation: 'slide_from_right', headerShown: true, title: 'Trip Details' }}
      />
    </RootStack.Navigator>
  )
}
