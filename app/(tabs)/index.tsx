import { Call, CallInvite, Voice } from '@twilio/voice-react-native-sdk';
import axios from 'axios';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  DeviceEventEmitter,
  Text,
  TextInput,
  View,
} from 'react-native';

const BACKEND_URL = 'http://localhost:3000/token';

function isCall(obj: Call | CallInvite | null): obj is Call {
  return !!obj && typeof (obj as Call).disconnect === 'function';
}

export default function HomeScreen() {
  const [callerInput, setCallerInput] = useState(''); // For input field
  const [caller, setCaller] = useState(''); // For actual identity used
  const [receiver, setReceiver] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [call, setCall] = useState<Call | CallInvite | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const voiceRef = useRef<Voice | null>(null);

  useEffect(() => {
    if (!caller) return; // Only initialize when caller is set

    const init = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Microphone permission is required'
          );
          return;
        }
        if (!voiceRef.current) {
          voiceRef.current = new Voice();
        }
        const res = await axios.get(`${BACKEND_URL}?identity=${caller}`);
        const accessToken = res.data.token;
        setToken(accessToken);
        await voiceRef.current.register(accessToken);
        setIsInitialized(true);

        const handleIncomingCall = (callInvite: CallInvite) => {
          setCall(callInvite);
          callInvite
            .accept()
            .then((activeCall) => setCall(activeCall))
            .catch(() => Alert.alert('Error', 'Failed to accept call'));
        };
        const handleCallDisconnected = () => setCall(null);
        const handleCallRinging = () => {};

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

        return () => {
          incomingCallSubscription.remove();
          disconnectedSubscription.remove();
          ringingSubscription.remove();
        };
      } catch (err) {
        Alert.alert('Initialization Error', 'Failed to initialize Voice SDK');
      }
    };

    const cleanup = init();

    return () => {
      cleanup?.then((cleanupFn) => cleanupFn?.());
      if (token && voiceRef.current) {
        voiceRef.current.unregister(token).catch(console.error);
      }
    };
    // Only re-run when caller changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caller]);

  const handleSetCaller = () => {
    setIsInitialized(false);
    setToken(null);
    setCaller(callerInput.trim());
  };

  const makeCall = async () => {
    console.log('Making call with token:', token);
    if (!token || !voiceRef.current || !isInitialized) {
      Alert.alert('Not Ready', 'Voice SDK is not initialized yet');
      return;
    }
    if (!receiver) {
      Alert.alert(
        'Missing Receiver',
        'Please enter a receiver identity or number'
      );
      return;
    }
    try {
      console.log('🚀 ~ makeCall ~ receiver:', receiver);
      const newCall = await voiceRef.current.connect(token, {
        params: { To: receiver },
        notificationDisplayName: 'Test Call',
      });
      console.log('🚀 ~ makeCall ~ newCall:', newCall);
      setCall(newCall);
    } catch (err) {
      console.log('🚀 ~ makeCall ~ err:', err);
      Alert.alert('Call Failed', 'Unable to make call');
    }
  };

  const endCall = () => {
    try {
      if (isCall(call)) {
        call.disconnect();
      } else if (call) {
        (call as CallInvite).reject();
      }
      setCall(null);
    } catch {
      setCall(null);
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
      <Text style={{ marginBottom: 20, textAlign: 'center' }}>
        Caller: {caller}
      </Text>

      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 5,
          padding: 10,
          width: 250,
          marginBottom: 10,
        }}
        placeholder="Enter your (caller) identity"
        value={callerInput}
        onChangeText={setCallerInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button
        title="Set Caller"
        onPress={handleSetCaller}
        disabled={!callerInput.trim()}
      />
      {!call ? (
        <>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 5,
              padding: 10,
              width: 250,
              marginBottom: 20,
            }}
            placeholder="Enter receiver identity or number"
            value={receiver}
            onChangeText={setReceiver}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            title="Make Call"
            onPress={makeCall}
            disabled={!isInitialized}
          />
        </>
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
