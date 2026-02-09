import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';

export type SessionPreview = {
  sessionId: string;
  title: string;
  price: number;
  startTimeISO: string;
  teacherName: string;
  thumbnailUrl?: string;
};

export type SessionPreviewSheetHandle = {
  open: () => void;
  close: () => void;
};

export const SessionPreviewSheet = forwardRef<
  SessionPreviewSheetHandle,
  {
    selected: SessionPreview | null;
    onClose: () => void;
    onReserve: () => void;
    onDetails: () => void;
  }
>(function SessionPreviewSheet(
  { selected, onClose, onReserve, onDetails },
  ref
) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['18%', '42%'], []);

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.snapToIndex(1),
    close: () => sheetRef.current?.close(),
  }));

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}                 // ✅ start closed, but mounted
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}          // ✅ swipe down triggers onClose
      handleIndicatorStyle={{ opacity: 0.35 }}
    >
      <View style={{ padding: 14, gap: 10 }}>
        {!selected ? (
          <Text style={{ opacity: 0.6 }}>No selection</Text>
        ) : (
          <>
            {selected.thumbnailUrl ? (
              <Image
                source={{ uri: selected.thumbnailUrl }}
                style={{ width: '100%', height: 150, borderRadius: 14 }}
                resizeMode="cover"
              />
            ) : null}

            <Text style={{ fontSize: 18, fontWeight: '900' }}>
              {selected.title}
            </Text>

            <Text style={{ fontWeight: '700' }}>
              €{selected.price} · {selected.teacherName}
            </Text>

            <Text>{new Date(selected.startTimeISO).toLocaleString()}</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <Pressable
                onPress={onReserve}
                style={{
                  flex: 1,
                  backgroundColor: 'black',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800' }}>Reserve</Text>
              </Pressable>

              <Pressable
                onPress={onDetails}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '800' }}>Details</Text>
              </Pressable>
            </View>

            <Pressable onPress={onClose} style={{ alignItems: 'center', paddingTop: 6 }}>
              <Text style={{ fontWeight: '700', opacity: 0.7 }}>Dismiss</Text>
            </Pressable>
          </>
        )}
      </View>
    </BottomSheet>
  );
});
