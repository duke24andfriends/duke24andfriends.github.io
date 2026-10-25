import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme';

interface PageTitleProps {
  children: ReactNode;
  subtitle?: ReactNode;
  /** Controls rendered inline to the right of the title. */
  actions?: ReactNode;
}

const PageTitle = ({ children, subtitle, actions }: PageTitleProps) => (
  <Box sx={{ mb: { xs: 2.5, md: 3 } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 3, rowGap: 1.5 }}>
      <Typography
        component="h1"
        sx={{ fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}
      >
        {children}
      </Typography>
      {actions}
    </Box>
    {subtitle && <Typography sx={{ color: tokens.muted, mt: 1 }}>{subtitle}</Typography>}
  </Box>
);

export const SectionHeading = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
    <Typography component="h2" sx={{ fontSize: { xs: '1.15rem', md: '1.25rem' }, fontWeight: 700, letterSpacing: '-0.01em' }}>
      {children}
    </Typography>
    {action}
  </Box>
);

export default PageTitle;
