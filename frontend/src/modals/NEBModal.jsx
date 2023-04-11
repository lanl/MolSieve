import { React, useState, useMemo, useCallback } from 'react';
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

/**
 * Modal that appears when run NEB button is clicked, allowing users to make a fine-grained selection on
 * a selection of states.
 *
 * @param {Array<Number>} states - The states to select over.
 * @param {Function} colorFunc - Function that colors the states.
 * @param {Function} close - Function that runs on close.
 * @param {Function} open - Function that runs on open.
 * @param {Function} submit - Function that runs when "submit" is pressed.
 * @param {String} id - Unique ID of this modal.
 */
export default function NEBModal({ states, colorFunc, close, open, submit, id }) {
    const [interpolate, setInterpolate] = useState(3);
    const [maxSteps, setMaxSteps] = useState(250);
    const [fmax, setFMax] = useState(0.1);
    const [saveResults, setSaveResults] = useState(false);
    const [selection, setSelection] = useState([0, states.length - 1]);

    const stateIDList = states.map((d) => d.id);
    const timesteps = useMemo(() => [...Array(states.length).keys()], [states.length]);
    const brushScale = useMemo(
        () =>
            d3
                .scaleLinear()
                .domain(d3.extent(timesteps))
                .range([0, 375 - 7.5]),
        [timesteps.length]
    );

    const colorBy = useCallback((d) => colorFunc(d.y), [colorFunc]);

    const brush = useMemo(
        () =>
            d3
                .brushX()
                .on('brush', (e) => {
                    d3.select(`#${id}_neb_scatterplot`)
                        .selectAll('.currentSelection')
                        .classed('currentSelection', false);
                    const [gStart, gEnd] = e.selection;
                    const start = brushScale.invert(gStart);
                    const end = brushScale.invert(gEnd);
                    d3.select(`#${id}_neb_scatterplot`)
                        .selectAll('rect')
                        .filter((_, i) => start <= i && end >= i)
                        .classed('currentSelection', true);
                })
                .on('end', (e) => {
                    if (e.selection) {
                        const [gStart, gEnd] = e.selection;
                        const start = brushScale.invert(gStart);
                        const end = brushScale.invert(gEnd);
                        setSelection([start, end]);
                    }
                }),
        [timesteps.length]
    );

    return (
        <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
            <DialogTitle>NEB</DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    <Scatterplot
                        width={375}
                        height={200}
                        colorFunc={colorBy}
                        xAttributeList={timesteps}
                        yAttributeList={stateIDList}
                        id={`${id}_neb_scatterplot`}
                        brush={brush}
                    />
                    <h4>{`${states.slice(selection[0], selection[1]).length} states selected`}</h4>
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
                        // might be best to just bind stateIDs with timestep and slice that way...
                        const selected = states.slice(start, end);
                        submit(
                            selected,
                            selected[0].timestep,
                            selected[selected.length - 1].timestep,
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
