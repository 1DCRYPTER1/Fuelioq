import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FuelMarkerProps {
  station: any;
  selectedFuel: string;
}

// Map brands to specific colors for visual recognition
const getBrandColor = (brand: string) => {
  const lower = brand?.toLowerCase() || "";
  if (lower.includes('7-eleven')) return '#007A53'; // 7-Eleven Green
  if (lower.includes('bp')) return '#009900'; // BP Green
  if (lower.includes('shell') || lower.includes('coles') || lower.includes('reddy')) return '#E31837'; // Shell/Reddy Red
  if (lower.includes('woolworths') || lower.includes('caltex') || lower.includes('ampol') || lower.includes('eg')) return '#0054A4'; // Ampol Blue
  if (lower.includes('puma')) return '#1E1E1E';
  if (lower.includes('united')) return '#0047AB';
  if (lower.includes('vibe')) return '#FF4500';
  if (lower.includes('costco')) return '#E31837';
  return '#45B2D3'; // Default App Blue
};

const getBrandShortName = (brand: string) => {
  const lower = brand?.toLowerCase() || "";
  if (lower.includes('7-eleven')) return '7-ELEV';
  if (lower.includes('bp')) return 'BP';
  if (lower.includes('shell') || lower.includes('reddy')) return 'SHELL';
  if (lower.includes('ampol') || lower.includes('eg')) return 'AMPOL';
  if (lower.includes('coles')) return 'COLES';
  if (lower.includes('puma')) return 'PUMA';
  if (lower.includes('united')) return 'UNITED';
  if (lower.includes('costco')) return 'COSTCO';
  return brand?.substring(0, 6).toUpperCase() || 'FUEL';
};

export default function FuelMarker({ station, selectedFuel }: FuelMarkerProps) {
  try {
    let priceObj = null;
    const prices = station && Array.isArray(station.prices) ? station.prices : [];
    
    if (selectedFuel === "All fuels") {
      priceObj = prices.find((p: any) => p && p.type === "U91" && typeof p.value === 'number' && p.value > 0);
      if (!priceObj && prices.length > 0) {
        priceObj = prices.find((p: any) => p && typeof p.value === 'number' && p.value > 0);
      }
    } else {
      priceObj = prices.find((p: any) => p && p.type === selectedFuel && typeof p.value === 'number' && p.value > 0);
    }
    
    const priceStr = priceObj ? `${priceObj.value.toFixed(1)}` : '---';
    const brandColor = getBrandColor(station?.brand);
    const shortBrand = getBrandShortName(station?.brand);

    return (
      <View style={styles.markerContainer}>
        {/* The main white bubble like PetrolSpy */}
        <View style={[styles.bubble, { borderColor: brandColor }]}>
          <Text style={[styles.priceText, { color: brandColor }]}>{priceStr}</Text>
        </View>
        
        {/* Brand indicator replacing the logo */}
        <View style={[styles.brandBadge, { backgroundColor: brandColor }]}>
          <Text style={styles.brandText}>{shortBrand}</Text>
        </View>
        
        {/* Downward pointer */}
        <View style={[styles.pointer, { borderTopColor: brandColor }]} />
      </View>
    );
  } catch (err: any) {
    console.error(`[FuelMarker Crash] Failed rendering marker for station ${station?.id}:`, err);
    return (
      <View style={styles.markerContainer}>
        <View style={[styles.bubble, { borderColor: '#E74C3C' }]}>
          <Text style={[styles.priceText, { color: '#E74C3C' }]}>Err</Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 2,
    minWidth: 50,
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandBadge: {
    marginTop: -2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    zIndex: 2,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  }
});
