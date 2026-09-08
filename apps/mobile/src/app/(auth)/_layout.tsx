import { Stack } from 'expo-router';
import { useMotionAllowed } from '../../components/motion.tsx';
export default function AuthLayout() { const motion = useMotionAllowed(); return <Stack screenOptions={{ headerShown: false, animation: motion ? 'slide_from_right' : 'fade' }} />; }
