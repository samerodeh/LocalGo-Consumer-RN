// TEMP-VERIFY: throwaway route to visually check the tracking stack + chat image bubble.
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrderTrackingStack } from '../src/components/OrderTrackingStack';
import { ChatMessageBubble } from '../src/components/chat/ChatMessageBubble';
import type { OrderTrackingItem } from '../src/store/useOrderTracking';
import type { Message } from '../src/types';

const now = new Date().toISOString();
const orders: OrderTrackingItem[] = [
  { id: 'a', orderNumber: '#LG-4821', etaMinutes: 25, driverId: 'd1', deliveryStatus: 'accepted', acceptedAt: now },
  { id: 'b', orderNumber: '#LG-4822', etaMinutes: 30, driverId: 'd2', deliveryStatus: 'picked_up', acceptedAt: now },
];

const photoMsg: Message = {
  id: 'm1',
  orderId: 'a',
  senderId: 'd1',
  body: '📦 Picked up your order — here it is!',
  imageUrl: 'https://betterresto.s3.us-west-1.wasabisys.com/production/13125/all_dressed_pizza_bb4e2f9ccd.png',
  createdAt: now,
  readAt: null,
};

export default function Verify() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
        <OrderTrackingStack orders={orders} onDismiss={() => {}} />
        <View style={{ padding: 16 }}>
          <ChatMessageBubble message={photoMsg} mine={false} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
