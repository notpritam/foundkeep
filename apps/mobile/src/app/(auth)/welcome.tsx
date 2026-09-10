import { Redirect } from 'expo-router';

// Preserve old links while opening directly to authentication.
export default function WelcomeRedirect() { return <Redirect href="/" />; }
