import { useLocalSearchParams } from "expo-router";
import CreateSessionScreen from "../create";

export default function EditSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <CreateSessionScreen mode="edit" sessionId={String(id)} />;
}