import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { HomeScreen } from '../screens/home/HomeScreen'
import { TripsScreen } from '../screens/trips/TripsScreen'
import { TripDetailScreen } from '../screens/trips/TripDetailScreen'
import { ConciergeScreen } from '../screens/concierge/ConciergeScreen'
import { DocumentsScreen } from '../screens/documents/DocumentsScreen'
import { ProfileScreen } from '../screens/profile/ProfileScreen'

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

const Tab = createBottomTabNavigator<MainTabParamList>()
const TripsStack = createNativeStackNavigator<TripsStackParamList>()

function TripsNavigator() {
  return (
    <TripsStack.Navigator>
      <TripsStack.Screen
        name="TripsList"
        component={TripsScreen}
        options={{ title: 'Поездки' }}
      />
      <TripsStack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: 'Детали поездки' }}
      />
    </TripsStack.Navigator>
  )
}

export function MainStack() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#9e9e9e',
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Главная' }} />
      <Tab.Screen name="TripsTab" component={TripsNavigator} options={{ title: 'Поездки', headerShown: false }} />
      <Tab.Screen name="Concierge" component={ConciergeScreen} options={{ title: 'Консьерж' }} />
      <Tab.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Документы' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Tab.Navigator>
  )
}
