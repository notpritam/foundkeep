import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SkyObjectsScreen, ideas, type SkyIdea } from '../../../../apps/mobile/src/proposals/sign-in-sky/SkyObjectsScreen.tsx';
import { MotionBoundary } from '../../../../apps/mobile/src/components/motion.tsx';

const meta: Meta = {
  title: 'Proposals/Sign in · Sky ideas',
  // RN Web caches matchMedia before the simulator applies toolbar overrides.
  // Gate the native motion context here so the reduced-motion toolbar also
  // stops the objects, entrance and shared EmailSheet in this preview.
  decorators: [(Story, context) => <MotionBoundary enabled={context.globals.motion !== 'reduced'}><Story /></MotionBoundary>],
  parameters: {
    simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/sign-in', params: {} },
    docs: { description: { component: 'Pritam’s corrected brief: the reference layout throughout — generated physical keepsakes around the edges, a glowing FoundKeep emblem and centred white headline, Google / Apple / email below. Objects enter from outside the frame with long soft ease-outs and keep drifting; buttons rise last. Remount to replay. Reduced motion shows the finished screen. Every screen uses real provider loading, OAuth routing and the shared EmailSheet.' } },
  },
};
export default meta;
type Story = StoryObj;
const story = (idea: SkyIdea, name: string, description: string): Story => ({
  name, render: () => <SkyObjectsScreen idea={idea} />,
  parameters: { docs: { description: { story: `${description}\n\nCopy A (shown): ${ideas[idea].headline.replaceAll('\n', ' ')}\n\nCopy B: ${ideas[idea].alternate.replaceAll('\n', ' ')}` } } },
});
export const FoundThings: Story = { ...story('found', '1 · Found things', 'The fullest reference composition: photo and webpage above, voice and highlight at the sides, video and folder below. Azure sky.'), name: '1 · Found things' };
export const WorthKeeping: Story = { ...story('worth', '2 · Worth keeping', 'A larger highlighted note and open folder frame the central promise. Warmer paper and apricot objects against a clear blue sky.'), name: '2 · Worth keeping' };
export const Curiosity: Story = { ...story('curiosity', '3 · Curiosity', 'Reading and discovery lead: webpages and highlights, with a voice memo and folder underneath. A slightly more cobalt sky.'), name: '3 · Curiosity' };
export const LittleMoments: Story = { ...story('moments', '4 · Little moments', 'Photos, video and a glossy jade voice memo lead the same reference layout, over a faint photographic cloudscape.'), name: '4 · Little moments' };
export const YourCorner: Story = { ...story('corner', '5 · Your own corner', 'The quieter reference composition: four larger keepsakes at the corners, a clean centre, and a soft photographic sky.'), name: '5 · Your own corner' };
