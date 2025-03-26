import React from 'react';
import {
  Button,
  Stack,
  FormControlLabel,
  Switch
} from '@mui/material';

interface BracketControlsProps {
  probabilityMode: boolean;
  simulationRun: boolean;
  setProbabilityMode: (mode: boolean) => void;
  resetPredictions: () => void;
  setPickPercentageProbabilities: () => void;
  setEqualProbabilities: () => void;
  simulateRandomOutcomes: () => void;
  setPopularWinners: () => void;
}

function BracketControls({
  probabilityMode,
  simulationRun,
  setProbabilityMode,
  resetPredictions,
  setPickPercentageProbabilities,
  setEqualProbabilities,
  simulateRandomOutcomes,
  setPopularWinners
}: BracketControlsProps) {
  return (
    <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
      <FormControlLabel
        control={
          <Switch
            checked={probabilityMode}
            onChange={() => setProbabilityMode(!probabilityMode)}
            color="primary"
          />
        }
        label={probabilityMode ? "Probability Mode" : "Winner Mode"}
      />
      
      <Button 
        variant="outlined" 
        onClick={resetPredictions}
        color="secondary"
      >
        Reset All Picks
      </Button>
      
      {probabilityMode && (
        <>
          <Button 
            variant="outlined" 
            onClick={setPickPercentageProbabilities}
            color="primary"
          >
            Set Pick % Probabilities
          </Button>
          
          <Button 
            variant="outlined" 
            onClick={setEqualProbabilities}
            color="primary"
          >
            Set 50/50 Probabilities
          </Button>
          
          <Button 
            variant="outlined" 
            onClick={simulateRandomOutcomes}
            color="primary"
          >
            Run Simulation
          </Button>
        </>
      )}
      
      {!probabilityMode && (
        <Button 
          variant="outlined" 
          onClick={setPopularWinners}
          color="primary"
        >
          Set Popular Picks
        </Button>
      )}
    </Stack>
  );
}

export default BracketControls; 