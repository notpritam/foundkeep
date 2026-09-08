import { useLocalSearchParams } from 'expo-router';
import { useCollection } from '../../../collection/useCollection.ts';
import { GalleryList } from '../../../components/GalleryList.tsx';
import { Screen } from '../../../components/ui.tsx';
export default function SavedTogether() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection({ batchId: id });
  return <Screen top={false}><GalleryList collection={collection} filtered /></Screen>;
}
