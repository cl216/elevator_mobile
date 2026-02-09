import { View, Text } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';

export default function TestSheet() {
  return (
    <View style={{ flex: 1 }}>
      <BottomSheet index={0} snapPoints={['50%']} enablePanDownToClose>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>
            BottomSheet is working 🎉
          </Text>
          <Text style={{ marginTop: 8 }}>
            If you can see this, the sheet library is correctly set up.
          </Text>
        </View>
      </BottomSheet>
    </View>
  );
}
