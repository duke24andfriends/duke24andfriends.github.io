import { Box } from '@mui/material';
import { tokens } from '../../theme';

interface ChangeIndicatorProps {
  value: number;
  /** Text after the arrow; defaults to the signed value. */
  label?: string;
  fontSize?: string | number;
}

const ChangeIndicator = ({ value, label, fontSize = '0.875rem' }: ChangeIndicatorProps) => {
  if (value === 0) {
    return (
      <Box component="span" sx={{ color: tokens.muted, fontSize, fontWeight: 600 }}>
        {label ?? '0'}
      </Box>
    );
  }
  const up = value > 0;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        color: up ? tokens.up : tokens.down,
        fontSize,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{ fontSize: '0.75em' }}>
        {up ? '▲' : '▼'}
      </Box>
      {label ?? (up ? `+${value}` : `−${Math.abs(value)}`)}
    </Box>
  );
};

export default ChangeIndicator;
