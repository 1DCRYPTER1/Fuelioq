import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert, AlertConfig } from '../context/AlertContext';

const COLORS = {
  warning: {
    main: '#FDF2C7',
    shadow: '#FFC107',
    text: '#856404'
  },
  error: {
    main: '#F28B82',
    shadow: '#D32F2F',
    text: '#B71C1C'
  },
  info: {
    main: '#E1F5FE',
    shadow: '#03A9F4',
    text: '#01579B'
  },
  success: {
    main: '#D4EDDA',
    shadow: '#28A745',
    text: '#155724'
  }
};

export default function GlobalAlert() {
  const { alert, hideAlert } = useAlert();
  const insets = useSafeAreaInsets();
  
  const translateY = useSharedValue(-150);
  const opacity = useSharedValue(0);
  const timerWidth = useSharedValue(100);

  const [activeAlert, setActiveAlert] = useState<AlertConfig | null>(null);

  useEffect(() => {
    if (alert) {
      setActiveAlert(alert);
      timerWidth.value = 100;
      
      translateY.value = withTiming(insets.top > 0 ? insets.top + 10 : 30, { duration: 400, easing: Easing.out(Easing.exp) });
      opacity.value = withTiming(1, { duration: 300 });

      if (alert.autoDismiss !== false && alert.type !== 'error') {
        const duration = alert.duration || 4000;
        
        timerWidth.value = withTiming(0, { duration, easing: Easing.linear });

        const timeout = setTimeout(() => {
          hideAlert();
        }, duration);

        return () => clearTimeout(timeout);
      }
    } else {
      translateY.value = withTiming(-150, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
      
      const timeout = setTimeout(() => {
        setActiveAlert(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [alert]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 || Math.abs(gestureState.vy) > 0.5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          const baseTop = insets.top > 0 ? insets.top + 10 : 30;
          translateY.value = baseTop + gestureState.dy;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -20 || gestureState.vy < -0.5) {
          hideAlert();
        } else {
          const baseTop = insets.top > 0 ? insets.top + 10 : 30;
          translateY.value = withTiming(baseTop);
        }
      },
    })
  ).current;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const animatedTimerStyle = useAnimatedStyle(() => ({
    width: `${timerWidth.value}%`,
  }));

  if (!activeAlert) return null;

  const theme = COLORS[activeAlert.type] || COLORS.info;

  const isAnimatedShadow = activeAlert.type !== 'error' && activeAlert.autoDismiss !== false;

  return (
    <Animated.View 
      style={[styles.container, animatedStyle]} 
      pointerEvents="box-none"
      {...panResponder.panHandlers}
    >
      
      {/* Background layer container used to clip the animated shadow/timer */}
      <View style={styles.shadowClippingContainer}>
        <Animated.View 
          style={[
            styles.shadowLayer, 
            { backgroundColor: theme.shadow },
            isAnimatedShadow ? animatedTimerStyle : { width: '100%' }
          ]} 
        />

        {/* Main Surface Layer (offset up to reveal shadow underneath) */}
        <View style={[styles.mainLayer, { backgroundColor: theme.main }]}>
          
          <View style={styles.contentRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              {activeAlert.title && (
                <Text style={[styles.title, { color: theme.text }]}>{activeAlert.title}</Text>
              )}
              <Text style={[styles.message, { color: theme.text }]} numberOfLines={2}>
                {activeAlert.message}
              </Text>
            </View>

            {/* Close Button for Error or non-auto-dismiss */}
            {(activeAlert.type === 'error' || activeAlert.autoDismiss === false) && (
              <TouchableOpacity onPress={hideAlert} style={styles.closeButton}>
                <Text style={{ color: theme.text, fontSize: 24, fontWeight: '400' }}>X</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>
      
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999, // Ensure it's above absolutely everything
  },
  shadowClippingContainer: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  shadowLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 12, // Needs to be tall enough to be visible under the offset main layer
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  mainLayer: {
    borderRadius: 12,
    minHeight: 60,
    padding: 16,
    justifyContent: 'center',
    marginBottom: 6, // Exposes 6px of the shadow layer beneath
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    paddingLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
