import { Box, ButtonBase } from '@mui/material';
import { tokens } from '../../theme';

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
}

function SegmentedControl<T extends string>({ value, options, onChange, size = 'medium', fullWidth }: SegmentedControlProps<T>) {
  const small = size === 'small';
  return (
    <Box
      role="tablist"
      sx={{
        display: 'inline-flex',
        width: fullWidth ? '100%' : 'auto',
        p: 0.5,
        bgcolor: tokens.surfaceAlt,
        border: `1px solid ${tokens.border}`,
        borderRadius: 2.5,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            sx={{
              flex: fullWidth ? 1 : '0 0 auto',
              px: small ? 1.5 : 2.25,
              py: small ? 0.5 : 0.9,
              borderRadius: 2,
              fontSize: small ? '0.8rem' : '0.9rem',
              fontWeight: active ? 600 : 500,
              whiteSpace: 'nowrap',
              color: active ? '#fff' : tokens.body,
              bgcolor: active ? tokens.primary : 'transparent',
              transition: 'background-color 150ms',
            }}
          >
            {o.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export default SegmentedControl;
