import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'

import { HomeScreen } from '../screens/home/HomeScreen'
import { TripsScreen } from '../screens/trips/TripsScreen'
import { TripDetailScreen } from '../screens/trips/TripDetailScreen'
import { ConciergeScreen } from '../screens/concierge/ConciergeScreen'
import { DocumentsScreen } from '../screens/documents/DocumentsScreen'
import { ProfileScreen } from '../screens/profile/ProfileScreen'
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen'
import { TripDetailScreen } from '../screens/trips/TripDetailScreen'

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
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#9e9e9e',
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{
        title: 'Home',
        tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
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
        options={{ animation: 'slide_from_right' }}
      />
      <RootStack.Screen
        name="TripDetailFromHome"
        component={TripDetailScreen}
        options={{ animation: 'slide_from_right', title: 'Trip Details' }}
      />
    </RootStack.Navigator>
  )
}
