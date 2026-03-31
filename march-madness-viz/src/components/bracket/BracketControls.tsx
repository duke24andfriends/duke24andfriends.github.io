import {
  Button,
  Stack
} from '@mui/material';

interface BracketControlsProps {
  resetPredictions: () => void;
}

function BracketControls({
  resetPredictions
}: BracketControlsProps) {
  return (
    <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
      <Button 
        variant="outlined" 
        onClick={resetPredictions}
        color="secondary"
        size="small"
        sx={{ px: { xs: 1.5, sm: 2 }, py: { xs: 0.5, sm: 0.75 }, fontSize: { xs: '0.82rem', sm: '0.875rem' } }}
      >
        Reset All Picks
      </Button>
    </Stack>
  );
}

export default BracketControls; 