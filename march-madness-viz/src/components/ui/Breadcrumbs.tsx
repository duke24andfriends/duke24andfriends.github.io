import { Fragment } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import { tokens } from '../../theme';

interface Crumb {
  label: string;
  to?: string;
}

const Breadcrumbs = ({ crumbs }: { crumbs: Crumb[] }) => (
  <Box component="nav" aria-label="Breadcrumb" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2, fontSize: '0.875rem', color: tokens.muted }}>
    {crumbs.map((c, i) => (
      <Fragment key={`${c.label}-${i}`}>
        {i > 0 && <Box component="span" sx={{ color: tokens.subtle }}>/</Box>}
        {c.to ? (
          <Link component={RouterLink} to={c.to} underline="hover" sx={{ color: tokens.muted }}>
            {c.label}
          </Link>
        ) : (
          <Box component="span" sx={{ color: tokens.primary, fontWeight: 600 }}>{c.label}</Box>
        )}
      </Fragment>
    ))}
  </Box>
);

export default Breadcrumbs;
