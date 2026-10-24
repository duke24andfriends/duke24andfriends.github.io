import { Avatar } from '@mui/material';
import { initials } from '../../hooks/usePoolStandings';
import { tokens } from '../../theme';

const PALETTE = [
  { bg: '#e3edfc', fg: '#1d4ed8' },
  { bg: '#e7eaef', fg: '#334155' },
  { bg: '#dbeafe', fg: '#1e40af' },
  { bg: '#dcfce7', fg: '#166534' },
  { bg: '#fee2e2', fg: '#991b1b' },
  { bg: '#ede9fe', fg: '#5b21b6' },
  { bg: '#fde9d9', fg: '#9a3412' },
  { bg: '#fef3c7', fg: '#92400e' },
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface InitialsAvatarProps {
  name: string;
  size?: number;
  highlight?: boolean;
  seed?: string;
}

const InitialsAvatar = ({ name, size = 32, highlight = false, seed }: InitialsAvatarProps) => {
  const color = PALETTE[hash(seed ?? name) % PALETTE.length];
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        fontWeight: 600,
        bgcolor: highlight ? tokens.primary : color.bg,
        color: highlight ? '#fff' : color.fg,
      }}
    >
      {initials(name)}
    </Avatar>
  );
};

export default InitialsAvatar;
