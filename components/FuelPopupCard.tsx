import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showLocation } from 'react-native-map-link';
import { LineChart } from 'react-native-gifted-charts';

const { width, height } = Dimensions.get('window');

interface Props {
  station: any;
  onClose: () => void;
}

export default function FuelPopupCard({ station, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(height);
  const [activeStation, setActiveStation] = useState(station);

  useEffect(() => {
    if (station) {
      setActiveStation(station);
      translateY.value = withSpring(0, { damping: 22, stiffness: 250 });
    } else {
      translateY.value = withTiming(height, { duration: 250 });
    }
  }, [station]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const openNavigation = () => {
    if (!activeStation) return;
    
    if (activeStation.latitude && activeStation.longitude) {
      showLocation({
        latitude: activeStation.latitude,
        longitude: activeStation.longitude,
        title: activeStation.name,
        dialogTitle: 'Navigate to Station',
        dialogMessage: 'Choose your preferred maps app:',
        cancelText: 'Cancel',
      });
    }
  };

  if (!activeStation) return null;

  // Formatter for relative time
  const updatedDate = new Date(activeStation.updated_at);
  const timeAgo = Math.round((new Date().getTime() - updatedDate.getTime()) / 60000);
  const timeString = timeAgo < 60 ? `${timeAgo} mins ago` : `${Math.round(timeAgo/60)} hours ago`;

  // Mock historical data for the chart (smooth curve)
  const chartData = [
    { value: 185 }, { value: 182 }, { value: 180 }, { value: 178 },
    { value: 184 }, { value: 189 }, { value: 195 }, { value: 199 },
    { value: Math.max(...(activeStation.prices?.map(p => p.value) || [180])) } // End at current highest price
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={station ? "auto" : "none"}>
      {/* Invisible backdrop to dismiss popup */}
      {station && (
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      )}

      {/* The Floating Card */}
      <Animated.View style={[styles.card, animatedStyle, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons name="gas-station" size={24} color="#131b26" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{activeStation.name}</Text>
              <Text style={styles.subtitle}>Updated {timeString}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Info Rows */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#45B2D3" />
              <Text style={styles.infoText} numberOfLines={2}>{activeStation.address}</Text>
            </View>
            {activeStation.phone && (
              <View style={[styles.infoRow, { marginTop: 12 }]}>
                <Ionicons name="call-outline" size={20} color="#45B2D3" />
                <Text style={styles.infoText}>{activeStation.phone}</Text>
              </View>
            )}
          </View>

          {/* Current Prices List */}
          <Text style={styles.sectionTitle}>Live Prices</Text>
          <View style={styles.pricesGrid}>
            {activeStation.prices?.map((price: any, i: number) => (
              <View key={i} style={styles.priceItem}>
                <Text style={styles.fuelType}>{price.type}</Text>
                <Text style={styles.fuelPrice}>{price.value.toFixed(1)}<Text style={styles.cents}>¢</Text></Text>
              </View>
            ))}
          </View>

          {/* Analytics Chart */}
          <View style={styles.chartContainer}>
            <Text style={styles.sectionTitle}>Price Trend (Last 7 Days)</Text>
            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData}
                height={120}
                width={width - 80}
                thickness={3}
                color="#45B2D3"
                hideDataPoints
                hideRules
                hideYAxisText
                hideAxesAndRules
                curved
                isAnimated
                animateOnMount
                animationDuration={1500}
                startFillColor="#45B2D3"
                endFillColor="#131b26"
                startOpacity={0.4}
                endOpacity={0.0}
              />
            </View>
          </View>

        </ScrollView>

        {/* Action Button */}
        <TouchableOpacity style={styles.navigateBtn} activeOpacity={0.9} onPress={openNavigation}>
          <FontAwesome5 name="directions" size={18} color="#131b26" />
          <Text style={styles.navigateText}>Navigate to Station</Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#1b2636', // Slightly lighter than map dark background
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    maxHeight: height * 0.85,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoCircle: {
    width: 48,
    height: 48,
    backgroundColor: '#45B2D3',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#45B2D3',
    fontWeight: '600',
  },
  closeBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 80, // Space for nav button
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  pricesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  priceItem: {
    backgroundColor: '#45B2D3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    minWidth: '47%',
    flex: 1,
  },
  fuelType: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  fuelPrice: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  cents: {
    fontSize: 16,
  },
  chartContainer: {
    marginBottom: 20,
  },
  chartWrapper: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
  },
  navigateBtn: {
    position: 'absolute',
    bottom: 30, // Usually overridden by paddingBottom in parent if insets are large, but this looks good
    left: 24,
    right: 24,
    backgroundColor: '#45B2D3',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#45B2D3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  navigateText: {
    color: '#131b26',
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 10,
  }
});
