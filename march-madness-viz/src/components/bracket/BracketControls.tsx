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
      >
        Reset All Picks
      </Button>
    </Stack>
  );
}

export default BracketControls; 