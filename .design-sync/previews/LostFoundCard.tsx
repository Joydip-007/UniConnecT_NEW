import { LostFoundCard } from 'web';

const baseItem = {
  id: 'lf-1',
  type: 'lost' as const,
  itemName: 'Blue Jansport backpack',
  description: 'Navy blue backpack with a laptop sleeve, left near the library entrance around 3pm.',
  imageUrls: [],
  locationDetail: 'Library, 2nd floor near the printers',
  contactInfo: '01711-223344',
  isResolved: false,
  authorId: 'user-1',
  author: { fullName: 'Farhan Ahmed', avatarUrl: null, department: 'CSE', batchYear: '221' },
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
};

export function LostItem() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 400 }}>
      <LostFoundCard item={baseItem} currentUserId="other-user" />
    </div>
  );
}

export function FoundItemWithPhotos() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 400 }}>
      <LostFoundCard
        item={{
          ...baseItem,
          id: 'lf-2',
          type: 'found',
          itemName: 'Student ID card',
          description: 'Found near the cafeteria entrance, name reads "Nusrat Jahan".',
          imageUrls: [
            'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=200',
          ],
          author: { fullName: 'Tanvir Hasan', avatarUrl: null, department: 'BBA', batchYear: '212' },
        }}
        currentUserId="other-user"
      />
    </div>
  );
}

export function Resolved() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 400 }}>
      <LostFoundCard item={{ ...baseItem, id: 'lf-3', isResolved: true }} currentUserId="other-user" />
    </div>
  );
}

export function OwnItemActions() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 400 }}>
      <LostFoundCard item={{ ...baseItem, id: 'lf-4', authorId: 'me' }} currentUserId="me" />
    </div>
  );
}
