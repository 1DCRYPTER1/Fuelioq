import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showLocation } from 'react-native-map-link';
import { LineChart } from 'react-native-gifted-charts';
import { getStationPriceHistory } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

interface Props {
  station: any;
  onClose: () => void;
}

export default function FuelPopupCard({ station, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(height);
  const [activeStation, setActiveStation] = useState(station);
  const [selectedFuelType, setSelectedFuelType] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<{ value: number }[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (station) {
      setActiveStation(station);
      translateY.value = withTiming(0, { duration: 300 });
      
      // Auto-select the first available fuel type
      const prices = Array.isArray(station.prices) ? station.prices : [];
      if (prices.length > 0) {
        setSelectedFuelType(prices[0].type);
      } else {
        setSelectedFuelType(null);
      }
    } else {
      translateY.value = withTiming(height, { duration: 250 });
    }
  }, [station]);

  useEffect(() => {
    if (activeStation && selectedFuelType) {
      setIsLoadingHistory(true);
      getStationPriceHistory(activeStation.id, selectedFuelType)
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setHistoryData(data.map((d: any) => ({ value: Number(d.price) })));
          } else {
            setHistoryData([]);
          }
        })
        .catch((err) => {
          console.error("Error loading price history:", err);
          setHistoryData([]);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      setHistoryData([]);
    }
  }, [activeStation, selectedFuelType]);

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

  try {
    // Formatter for relative time safely
    let timeString = 'recently';
    if (activeStation.updated_at) {
      const updatedDate = new Date(activeStation.updated_at);
      if (!isNaN(updatedDate.getTime())) {
        const timeAgo = Math.round((new Date().getTime() - updatedDate.getTime()) / 60000);
        timeString = timeAgo < 60 ? `${timeAgo} mins ago` : `${Math.round(timeAgo/60)} hours ago`;
      }
    }

    let sourceName = "FuelCheck";
    if (activeStation.state === "WA") sourceName = "FuelWatch";
    else if (activeStation.state === "SA" || activeStation.state === "QLD") sourceName = "Informed Sources";

    const pricesList = Array.isArray(activeStation.prices) ? activeStation.prices : [];

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
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="time-outline" size={13} color="#45B2D3" />
                  <Text style={[styles.subtitle, { marginLeft: 6 }]}>Updated {timeString}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Ionicons name="server-outline" size={13} color="#F1C40F" />
                  <Text style={[styles.subtitle, { marginLeft: 6, color: '#F1C40F' }]}>Source: {sourceName}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            style={{ flexShrink: 1 }}
            contentContainerStyle={styles.scrollContent}
          >
            
            {/* Info Rows */}
            <View style={styles.infoBox}>
              <View style={styles.addressRow}>
                <View style={styles.addressLeft}>
                  <Ionicons name="location-outline" size={20} color="#45B2D3" />
                  <Text style={styles.infoText} numberOfLines={2}>{activeStation.address}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.inlineNavigateBtn} 
                  activeOpacity={0.8} 
                  onPress={openNavigation}
                >
                  <FontAwesome5 name="directions" size={18} color="#131b26" />
                </TouchableOpacity>
              </View>
              {activeStation.phone && (
                <View style={[styles.infoRow, { marginTop: 12 }]}>
                  <Ionicons name="call-outline" size={20} color="#45B2D3" />
                  <Text style={styles.infoText}>{activeStation.phone}</Text>
                </View>
              )}
            </View>

            {/* Current Prices List */}
            <Text style={styles.sectionTitle}>Live Prices (Tap to view history)</Text>
            <View style={styles.pricesGrid}>
              {pricesList.map((price: any, i: number) => {
                const isSelected = selectedFuelType === price.type;
                return (
                  <TouchableOpacity 
                    key={i} 
                    style={[
                      styles.priceItem, 
                      isSelected && styles.priceItemActive
                    ]}
                    onPress={() => setSelectedFuelType(price.type)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.fuelType}>{price.type}</Text>
                    <Text style={styles.fuelPrice}>{typeof price.value === 'number' ? price.value.toFixed(1) : '---'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Analytics Chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.sectionTitle}>Price Trend {selectedFuelType ? `(${selectedFuelType})` : ''}</Text>
              <View style={styles.chartWrapper}>
                {isLoadingHistory ? (
                  <View style={{ height: 120, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Loading price trends...</Text>
                  </View>
                ) : historyData.length > 1 ? (
                  <LineChart
                    data={historyData}
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
                    animationDuration={1000}
                    startFillColor="#45B2D3"
                    endFillColor="#131b26"
                    startOpacity={0.4}
                    endOpacity={0.0}
                  />
                ) : (
                  <View style={{ height: 120, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
                    <Ionicons name="trending-up-outline" size={32} color="rgba(255,255,255,0.2)" />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                      No price trend history recorded yet for this station.
                    </Text>
                  </View>
                )}
              </View>
            </View>

          </ScrollView>


        </Animated.View>
      </View>
    );
  } catch (err: any) {
    console.error(`[FuelPopupCard Crash] Error rendering details for station ${activeStation?.id}:`, err);
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents={station ? "auto" : "none"}>
        {station && <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />}
        <Animated.View style={[styles.card, animatedStyle, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={{ color: '#FFFFFF', fontSize: 16, textAlign: 'center', margin: 20 }}>
            Unable to load station details.
          </Text>
        </Animated.View>
      </View>
    );
  }
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
    paddingBottom: 16,
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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  inlineNavigateBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#45B2D3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#45B2D3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    minWidth: '47%',
    flex: 1,
  },
  priceItemActive: {
    backgroundColor: 'rgba(69, 178, 211, 0.15)',
    borderColor: '#45B2D3',
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

});
