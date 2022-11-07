import { React, useState } from 'react';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

const domain = [2, 100];
const defaultValues = [2, 20];

export default function LoadRunModal({ closeFunc, runFunc, run, isOpen }) {
    const [values, setValues] = useState(defaultValues.slice());
    const [chunkingThreshold, setChunkingThreshold] = useState(0.75);

    const startRunFunc = () => {
        closeFunc();
        runFunc(run, values[0], values[1], chunkingThreshold);
    };

    return (
        <Dialog onBackdropClick={() => closeFunc()} open={isOpen}>
            <DialogTitle>{run}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Select the cluster sizes that PCCA will try to cluster the data into.
                </DialogContentText>
                <Stack spacing={2} alignItems="center" justifyContent="center">
                    <Slider
                        step={1}
                        min={domain[0]}
                        max={domain[1]}
                        onChange={(_, v) => {
                            setValues(v);
                        }}
                        valueLabelDisplay="auto"
                        value={values}
                    />
                    <b>{values.toString().replace(',', ' - ')} clusters</b>
                    <TextField
                        fullWidth
                        label="Chunk Threshold"
                        type="number"
                        inputProps={{
                            inputMode: 'numeric',
                            pattern: '[0-9]*',
                            min: 1e-10,
                            step: 0.01,
                        }}
                        defaultValue={chunkingThreshold}
                        onChange={(e) => {
                            setChunkingThreshold(e.target.value);
                        }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button size="small" variant="contained" onClick={startRunFunc}>
                    Calculate
                </Button>
                <Button
                    size="small"
                    variant="contained"
                    color="secondary"
                    onClick={() => {
                        closeFunc();
                    }}
                >
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
}
