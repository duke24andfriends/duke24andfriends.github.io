import { Box } from '@mui/material';
import { tokens } from '../../theme';

interface MeterProps {
  /** 0–100 */
  value: number;
  color?: string;
  height?: number;
  /** Draws a dot at the end of the fill, for dot-plot style rows. */
  dot?: boolean;
}

const Meter = ({ value, color = tokens.primary, height = 10, dot = false }: MeterProps) => {
  const width = Math.min(100, Math.max(0, value));
  return (
    <Box sx={{ position: 'relative', height, borderRadius: height, bgcolor: '#edf0f4', flex: 1, minWidth: 40 }}>
      <Box sx={{ position: 'absolute', inset: 0, right: 'auto', width: `${width}%`, bgcolor: color, borderRadius: height }} />
      {dot && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: `${width}%`,
            width: height + 6,
            height: height + 6,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            bgcolor: color,
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px rgba(15,23,42,0.08)',
          }}
        />
      )}
    </Box>
  );
};

export default Meter;
