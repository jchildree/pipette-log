import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import SignOffForm from './src/screens/SignOffForm';
import { watchConnectivityAndDrain } from './src/network';

export default function App() {
  useEffect(() => {
    return watchConnectivityAndDrain((message) => console.warn('Queue drain error:', message));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <SignOffForm />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
