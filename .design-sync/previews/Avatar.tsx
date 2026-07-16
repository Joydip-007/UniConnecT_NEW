import { Avatar } from 'web';

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Avatar initials="JD" color="#5B5BD6" size={28} />
      <Avatar initials="MK" color="#E8814A" size={40} />
      <Avatar initials="RS" color="#3DBE8B" size={56} />
    </div>
  );
}

export function OnlineStatus() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Avatar initials="AB" color="#5B5BD6" size={44} online />
      <Avatar initials="CD" color="#E8814A" size={44} online={false} />
    </div>
  );
}
