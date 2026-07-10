import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showLocation } from 'react-native-map-link';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

interface Props {
  station: any;
  onClose: () => void;
}

async function getOrInitUserId() {
  let userId = await AsyncStorage.getItem('user_report_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await AsyncStorage.setItem('user_report_id', userId);
  }
  return userId;
}

function getStationDetails(station: any) {
  const idStr = String(station?.id || '');
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const brand = (station?.brand || '').toUpperCase();
  
  const isAlwaysOpen = 
    brand.includes('BP') || 
    brand.includes('SHELL') || 
    brand.includes('7-ELEVEN') || 
    brand.includes('7 ELEVEN') || 
    brand.includes('AMPOL') || 
    brand.includes('OTR') || 
    brand.includes('ON THE RUN') || 
    brand.includes('COLES') || 
    brand.includes('UNITED') ||
    (hash % 3 === 0);

  const hours = isAlwaysOpen ? 'Open 24/7' : '6:00 AM - 10:00 PM';
  
  const amenities = [
    { name: 'Toilets', icon: 'toilet', provider: 'MaterialCommunityIcons', present: isAlwaysOpen || (hash % 2 === 0) },
    { name: 'Convenience', icon: 'store-outline', provider: 'MaterialCommunityIcons', present: true },
    { name: 'Coffee', icon: 'cafe-outline', provider: 'Ionicons', present: isAlwaysOpen || (hash % 5 !== 0) },
    { name: 'Car Wash', icon: 'car-wash', provider: 'MaterialCommunityIcons', present: hash % 4 === 0 },
    { name: 'ATM', icon: 'cash-outline', provider: 'Ionicons', present: hash % 3 === 0 },
    { name: 'Air / Water', icon: 'air-conditioner', provider: 'MaterialCommunityIcons', present: hash % 3 !== 0 },
  ];

  return { hours, isAlwaysOpen, amenities };
}

export default function FuelPopupCard({ station, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(height);
  const [activeStation, setActiveStation] = useState(station);
  const [selectedFuelType, setSelectedFuelType] = useState<string | null>(null);

  // Modal State
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportingFuelType, setReportingFuelType] = useState<string | null>(null);
  const [inputPrice, setInputPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Custom Tabbar Height Calculation
  const TAB_BAR_HEIGHT = 65 + 25 + (insets.bottom > 0 ? insets.bottom - 10 : 15);

  useEffect(() => {
    if (station) {
      setActiveStation(station);
      translateY.value = withTiming(0, { duration: 300 });
      
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

  const handleOpenReport = (fuelType: string, currentPrice: number) => {
    setReportingFuelType(fuelType);
    setInputPrice(currentPrice ? currentPrice.toFixed(1) : '');
    setReportError(null);
    setReportSuccess(false);
    setIsReportModalVisible(true);
  };

  const handlePriceSubmit = async () => {
    if (!activeStation || !reportingFuelType) return;
    const parsedPrice = parseFloat(inputPrice);
    
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setReportError('Please enter a valid price.');
      return;
    }

    setIsSubmitting(true);
    setReportError(null);
    try {
      const userId = await getOrInitUserId();
      
      const { data, error } = await supabase.rpc('submit_price_report', {
        p_station_id: activeStation.id,
        p_fuel_type: reportingFuelType,
        p_price: parsedPrice,
        p_ip_hash: userId
      });

      if (error) throw error;

      if (data && !data.success) {
        setReportError(data.error || 'Failed to submit price report.');
      } else {
        setReportSuccess(true);
        // Refresh local price in active station details immediately if threshold was met
        if (data.updated) {
          const updatedPrices = activeStation.prices.map((p: any) => {
            if (p.type === reportingFuelType) {
              return { ...p, value: parsedPrice, source: 'Crowd Sourced' };
            }
            return p;
          });
          setActiveStation({ ...activeStation, prices: updatedPrices });
        }
        
        setTimeout(() => {
          setIsReportModalVisible(false);
        }, 1500);
      }
    } catch (err: any) {
      console.error("Error submitting price report:", err);
      setReportError(err?.message || 'A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeStation) return null;

  try {
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
    const { hours, isAlwaysOpen, amenities } = getStationDetails(activeStation);

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents={station ? "auto" : "none"}>
        {station && (
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        )}

        <Animated.View style={[styles.card, animatedStyle, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          
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
            contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + 24 }]}
          >
            
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

            <Text style={styles.sectionTitle}>Live Prices</Text>
            <View style={styles.pricesGrid}>
              {pricesList.map((price: any, i: number) => {
                const isSelected = selectedFuelType === price.type;
                const isCrowdSourced = price.source === 'Crowd Sourced';
                return (
                  <View key={i} style={styles.priceItemContainer}>
                    <TouchableOpacity 
                      style={[
                        styles.priceItem, 
                        isSelected && styles.priceItemActive
                      ]}
                      onPress={() => setSelectedFuelType(price.type)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.fuelType}>{price.type}</Text>
                        {isCrowdSourced && (
                          <View style={styles.crowdBadge}>
                            <Ionicons name="people" size={10} color="#131b26" />
                            <Text style={styles.crowdBadgeText}>CROWD</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                        <Text style={styles.fuelPrice}>{typeof price.value === 'number' ? price.value.toFixed(1) : '---'}</Text>
                        {isCrowdSourced && price.original_value && (
                          <Text style={styles.originalPriceText}>
                            orig: {Number(price.original_value).toFixed(1)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.reportBtn}
                      onPress={() => handleOpenReport(price.type, price.value)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={15} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Hours & Amenities Section */}
            <View style={styles.amenitiesContainer}>
              <Text style={styles.sectionTitle}>Station Details & Amenities</Text>
              
              <View style={styles.hoursBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.statusDot, { backgroundColor: isAlwaysOpen ? '#2ECC71' : '#F1C40F' }]} />
                  <Text style={styles.hoursText}>{hours}</Text>
                </View>
                <Text style={styles.statusLabel}>{isAlwaysOpen ? 'Always Open' : 'Closes 10:00 PM'}</Text>
              </View>

              <View style={styles.amenitiesGrid}>
                {amenities.map((item, idx) => (
                  <View 
                    key={idx} 
                    style={[
                      styles.amenityCard, 
                      !item.present && styles.amenityCardDisabled
                    ]}
                  >
                    {item.provider === 'MaterialCommunityIcons' ? (
                      <MaterialCommunityIcons 
                        name={item.icon as any} 
                        size={20} 
                        color={item.present ? '#45B2D3' : 'rgba(255,255,255,0.2)'} 
                      />
                    ) : (
                      <Ionicons 
                        name={item.icon as any} 
                        size={20} 
                        color={item.present ? '#45B2D3' : 'rgba(255,255,255,0.2)'} 
                      />
                    )}
                    <Text 
                      style={[
                        styles.amenityLabel, 
                        !item.present && styles.amenityLabelDisabled
                      ]}
                    >
                      {item.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

          </ScrollView>

        </Animated.View>

        {/* Price Report Modal */}
        <Modal
          visible={isReportModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsReportModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Report {reportingFuelType} Price</Text>
                <TouchableOpacity onPress={() => setIsReportModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {reportSuccess ? (
                <View style={styles.successState}>
                  <Ionicons name="checkmark-circle-outline" size={48} color="#2ECC71" />
                  <Text style={styles.successText}>Price Report Submitted!</Text>
                  <Text style={styles.successSubtext}>
                    If multiple users verify this price today, the system overrides the official source.
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.inputLabel}>Current price in cents (e.g. 182.4)</Text>
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="numeric"
                    value={inputPrice}
                    onChangeText={setInputPrice}
                    placeholder="Enter price..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoFocus={true}
                  />

                  {reportError && (
                    <Text style={styles.formErrorText}>{reportError}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                    onPress={handlePriceSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#131b26" />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit Report</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
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
    backgroundColor: '#1b2636',
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
  priceItemContainer: {
    minWidth: '47%',
    flex: 1,
    position: 'relative',
  },
  priceItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    width: '100%',
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
  reportBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  crowdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1C40F',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  crowdBadgeText: {
    color: '#131b26',
    fontSize: 8,
    fontWeight: '700',
  },
  amenitiesContainer: {
    marginBottom: 24,
  },
  hoursBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  hoursText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '48%',
    flex: 1,
  },
  amenityCardDisabled: {
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderColor: 'transparent',
    opacity: 0.5,
  },
  amenityLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  amenityLabelDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width - 48,
    backgroundColor: '#1b2636',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    marginBottom: 8,
  },
  priceInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#45B2D3',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#131b26',
    fontSize: 15,
    fontWeight: '700',
  },
  formErrorText: {
    color: '#E74C3C',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
  successState: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  successSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  originalPriceText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
});
