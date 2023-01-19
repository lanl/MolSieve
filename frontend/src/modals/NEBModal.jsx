import { React, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';

import * as d3 from 'd3';

import '../css/App.css';
import Scatterplot from '../vis/Scatterplot';
import GlobalStates from '../api/globalStates';

import { onEntityMouseOver } from '../api/myutils';
/* import { onMessageHandler, apiCalculateNEB } from '../api/ajax'; */

export default function NEBModal({ stateIDs, timesteps, close, open, submit }) {
    const [interpolate, setInterpolate] = useState(1);
    const [maxSteps, setMaxSteps] = useState(2500);
    const [fmax, setFMax] = useState(0.01);
    const [saveResults, setSaveResults] = useState(true);
    const [selection, setSelection] = useState([0, stateIDs.length - 1]);

    return (
        <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
            <DialogTitle>NEB</DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    <Scatterplot
                        width={375}
                        height={200}
                        colorFunc={(d) => {
                            const state = GlobalStates.get(d.y);
                            return state.individualColor;
                        }}
                        onElementMouseOver={(node, d) => {
                            const state = GlobalStates.get(d.y);
                            onEntityMouseOver(node, state);
                        }}
                        xAttributeList={[...Array(stateIDs.length).keys()]}
                        yAttributeList={stateIDs}
                        brush={d3.brushX().on('end', (e) => {
                            if (e.selection) {
                                const [gStart, gEnd] = e.selection;
                                const x = d3
                                    .scaleLinear()
                                    .domain(d3.extent([...Array(stateIDs.length).keys()]))
                                    .range([0, 375]);

                                const start = x.invert(gStart);
                                const end = x.invert(gEnd);
                                setSelection([start, end]);
                            }
                        })}
                        selected={[{ active: true, highlightValue: undefined, set: selection }]}
                    />
                    <h4>{`${
                        stateIDs.slice(selection[0], selection[1]).length
                    } states selected`}</h4>
                    <TextField
                        label="Number of images interpolated between points on NEB:"
                        fullWidth
                        type="number"
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1 }}
                        defaultValue={interpolate}
                        onChange={(e) => setInterpolate(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="Maximum number of optimization steps"
                        type="number"
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1 }}
                        defaultValue={maxSteps}
                        onChange={(e) => setMaxSteps(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="fmax"
                        type="number"
                        inputProps={{
                            inputMode: 'numeric',
                            pattern: '[0-9]*',
                            min: 1e-10,
                            step: 0.01,
                        }}
                        defaultValue={fmax}
                        onChange={(e) => setFMax(e.target.value)}
                    />
                    <FormControl>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={saveResults}
                                    onChange={(e) => setSaveResults(e.target.checked)}
                                />
                            }
                            label="Save results to database"
                        />
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={() => {
                        const [start, end] = selection;
                        submit(
                            timesteps[Math.round(start)],
                            timesteps[Math.round(end)],
                            interpolate,
                            maxSteps,
                            fmax,
                            saveResults
                        );
                    }}
                    size="small"
                >
                    Calculate NEB on Path
                </Button>
                <Button size="small" color="secondary" onClick={close}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
