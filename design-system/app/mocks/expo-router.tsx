// expo-router for Storybook. Screens render outside a navigator, so this gives
// them what they ask for: route params from the story, focus effects that run
// once, navigation calls recorded as actions, and a native-style stack header.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { action } from 'storybook/actions';

export type Href = string | { pathname: string; params?: Record<string, string> };
type Route = { pathname: string; params: Record<string, string>; header?: string | null };
type HeaderOptions = { title?: string; headerShown?: boolean; headerRight?: () => ReactNode; headerLeft?: () => ReactNode };
const RouteContext = createContext<Route>({ pathname: '/', params: {} });
const HeaderContext = createContext<(options: HeaderOptions) => void>(() => {});

export const router = {
  push: action('router.push'), replace: action('router.replace'), navigate: action('router.navigate'),
  back: action('router.back'), dismissTo: action('router.dismissTo'), dismiss: action('router.dismiss'),
  canGoBack: () => true, setParams: action('router.setParams'),
};
export const useRouter = () => router;
export const useLocalSearchParams = <T extends Record<string, string>>() => useContext(RouteContext).params as T;
export const useGlobalSearchParams = useLocalSearchParams;
export const usePathname = () => useContext(RouteContext).pathname;
export const useSegments = () => useContext(RouteContext).pathname.split('/').filter(Boolean);
export function useFocusEffect(effect: () => void | (() => void)) { useEffect(() => effect(), [effect]); }
export const useIsFocused = () => true;
export const useNavigation = () => ({ setOptions: () => {}, addListener: () => () => {}, goBack: router.back, navigate: router.navigate });

export function Redirect({ href }: { href: Href }) {
  useEffect(() => { action('Redirect')(href); }, [href]);
  return null;
}
export function Link({ href, children, ...props }: { href: Href; children: ReactNode; asChild?: boolean }) {
  return <Pressable accessibilityRole="link" onPress={() => router.push(href)} {...props}>{children}</Pressable>;
}

function Screen({ options }: { name?: string; options?: HeaderOptions }) {
  const set = useContext(HeaderContext);
  useEffect(() => { if (options) set(options); }, [options, set]);
  return null;
}
export function Stack({ children }: { children?: ReactNode }) { return <>{children}</>; }
Stack.Screen = Screen;
export function Tabs({ children }: { children?: ReactNode }) { return <>{children}</>; }
Tabs.Screen = Screen;
export const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
export const ThemeProvider = ({ children }: { children: ReactNode; value?: unknown }) => <>{children}</>;
export const DefaultTheme = { dark: false, colors: {} }, DarkTheme = { dark: true, colors: {} };

/** Story wrapper: the route a screen sees, and the stack header it would sit under. */
export function StoryRoute({ route, children, colors }: { route: Route; children: ReactNode; colors: { paper: string; ink: string; accent: string } }) {
  const [options, setOptions] = useState<HeaderOptions>({});
  const title = options.title ?? route.header;
  const shown = route.header !== null && route.header !== undefined && options.headerShown !== false;
  return <RouteContext.Provider value={route}><HeaderContext.Provider value={setOptions}>
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {shown ? <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, backgroundColor: colors.paper }}>
        <Text style={{ color: colors.accent, fontSize: 28, width: 44, textAlign: 'center' }}>‹</Text>
        <Text style={{ flex: 1, textAlign: 'center', color: colors.ink, fontSize: 17, fontWeight: '600' }} numberOfLines={1}>{title}</Text>
        <View style={{ width: 44, alignItems: 'center' }}>{options.headerRight?.()}</View>
      </View> : null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  </HeaderContext.Provider></RouteContext.Provider>;
}
