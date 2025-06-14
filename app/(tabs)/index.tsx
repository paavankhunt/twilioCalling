import { Call, CallInvite, Voice } from '@twilio/voice-react-native-sdk';
import axios from 'axios';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, DeviceEventEmitter, Text, View } from 'react-native';

const BACKEND_URL = 'http://localhost:3000/token';
const USER_IDENTITY = '+919978825612'; // Or get this from user input/auth

function isCall(obj: Call | CallInvite | null): obj is Call {
  return !!obj && typeof (obj as Call).disconnect === 'function';
}

export default function HomeScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [call, setCall] = useState<Call | CallInvite | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Use useRef to persist Voice instance across re-renders
  const voiceRef = useRef<Voice | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Request microphone permissions
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Microphone permission is required'
          );
          return;
        }

        // Initialize Voice instance once
        if (!voiceRef.current) {
          voiceRef.current = new Voice();
        }

        // Get access token with identity
        const res = await axios.get(`${BACKEND_URL}?identity=${USER_IDENTITY}`);
        const accessToken = res.data.token;
        setToken(accessToken);

        // Register with Twilio
        await voiceRef.current.register(accessToken);
        setIsInitialized(true);

        // Set up event listeners
        const handleIncomingCall = (callInvite: CallInvite) => {
          console.log('📞 Incoming call:', callInvite);
          setCall(callInvite);

          // Auto-accept incoming calls (you might want to show UI for this)
          callInvite
            .accept()
            .then((activeCall) => {
              console.log('✅ Call accepted');
              setCall(activeCall);
            })
            .catch((err) => {
              console.error('❌ Error accepting call:', err);
              Alert.alert('Error', 'Failed to accept call');
            });
        };

        const handleCallDisconnected = () => {
          console.log('📴 Call disconnected');
          setCall(null);
        };

        const handleCallRinging = () => {
          console.log('🔔 Call is ringing...');
        };

        // Add listeners and store subscriptions
        const incomingCallSubscription = DeviceEventEmitter.addListener(
          'deviceDidReceiveIncoming',
          handleIncomingCall
        );
        const disconnectedSubscription = DeviceEventEmitter.addListener(
          'callDisconnected',
          handleCallDisconnected
        );
        const ringingSubscription = DeviceEventEmitter.addListener(
          'callStateRinging',
          handleCallRinging
        );

        // Store listener cleanup functions
        return () => {
          incomingCallSubscription.remove();
          disconnectedSubscription.remove();
          ringingSubscription.remove();
        };
      } catch (err) {
        console.error('🚨 Voice SDK init error:', err);
        Alert.alert('Initialization Error', 'Failed to initialize Voice SDK');
      }
    };

    const cleanup = init();

    // Cleanup function
    return () => {
      cleanup?.then((cleanupFn) => cleanupFn?.());

      // Unregister when component unmounts
      if (token && voiceRef.current) {
        voiceRef.current.unregister(token).catch(console.error);
      }
    };
  }, []); // Remove token dependency to avoid re-initialization

  const makeCall = async () => {
    console.log('Make Call pressed');
    if (!token || !voiceRef.current || !isInitialized) {
      console.warn('Voice SDK not ready', {
        token,
        isInitialized,
        voiceRef: !!voiceRef.current,
      });
      Alert.alert('Not Ready', 'Voice SDK is not initialized yet');
      return;
    }

    try {
      const newCall = await voiceRef.current.connect(token, {
        params: { To: '+919574518316' },
        notificationDisplayName: 'Test Call',
      });
      console.log('📤 Calling...', newCall);
      setCall(newCall);
    } catch (err) {
      console.error('❌ Error making call:', err);
      Alert.alert('Call Failed', 'Unable to make call');
    }
  };

  const endCall = () => {
    try {
      if (isCall(call)) {
        call.disconnect();
      } else if (call) {
        // Handle CallInvite rejection
        (call as CallInvite).reject();
      }
      setCall(null);
    } catch (err) {
      console.error('❌ Error ending call:', err);
      setCall(null); // Reset state anyway
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <Text style={{ fontSize: 22, marginBottom: 30 }}>
        Twilio Voice Call Demo
      </Text>

      <Text style={{ marginBottom: 20, textAlign: 'center' }}>
        Status: {isInitialized ? 'Ready' : 'Initializing...'}
      </Text>

      {!call ? (
        <Button
          title="Make Call"
          onPress={makeCall}
          disabled={!isInitialized}
        />
      ) : (
        <View>
          <Text style={{ marginBottom: 10, textAlign: 'center' }}>
            {isCall(call) ? 'Call Active' : 'Incoming Call'}
          </Text>
          <Button title="End Call" onPress={endCall} color="red" />
        </View>
      )}
    </View>
  );
}
