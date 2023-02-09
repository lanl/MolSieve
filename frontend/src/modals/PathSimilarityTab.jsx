import { React, useState } from 'react';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import FormHelperText from '@mui/material/FormHelperText';
import FormControl from '@mui/material/FormControl';
import Button from '@mui/material/Button';
import { useSnackbar } from 'notistack';

import { apiCalculatePathSimilarity, onMessageHandler } from '../api/ajax';
import CheckboxTable from '../components/CheckboxTable';

export default function PathSimilarityTab({
    extents,
    properties,
    closeFunc,
    extent_options: extentOptions,
    addPathSimilarityResult,
    extentsID,
}) {
    const [atomProperties, setAtomProperties] = useState([]);
    const [stateProperties, setStateProperties] = useState([]);
    const [extent1, setExtent1] = useState(extents[0]);
    const [extent2, setExtent2] = useState(extents[1]);

    const { enqueueSnackbar } = useSnackbar();

    const addAtomProperty = (clicked) => {
        setAtomProperties([...clicked]);
    };

    const addStateProperty = (clicked) => {
        setStateProperties([...clicked]);
    };

    /* let similarityText = null;            
    if (!this.state.similarity) {
        similarityText = <p/>;        
    } else {
        const extent1 = JSON.parse(this.state.extent1);
        const extent2 = JSON.parse(this.state.extent2);
        similarityText = (
            <p>
                {`Similarity between ${extent1.name} ${extent1.begin} - ${extent1.end} and ${extent2.name} ${extent2.begin} - ${extent2.end} is ${this.state.similarity}`}
            </p>
        );
    } */

    const calculatePathSimilarity = () => {
        if (stateProperties.length === 0 && atomProperties.length === 0) {
            alert('Please choose some properties to calculate the path similarity with!');
        } else {
            apiCalculatePathSimilarity(
                extent1.value,
                extent2.value,
                stateProperties,
                atomProperties
            )
                .then((response) => {
                    console.log(response);
                    const id = response;
                    const client = new WebSocket(`ws://localhost:8000/api/ws/${id}`);
                    client.onmessage = onMessageHandler(
                        () => {
                            enqueueSnackbar(`Task ${id} started.`);
                        },
                        (data) => {
                            enqueueSnackbar(`Task ${id}: ${data.message}`);
                        },
                        (data) => {
                            enqueueSnackbar(`Task ${id} complete.`);
                            addPathSimilarityResult(
                                extent1.name,
                                extent2.name,
                                data.data.score,
                                extentsID
                            );
                        }
                    );
                })
                .catch((error) => {
                    alert(error);
                });
        }
    };

    return (
        <>
            <DialogContent>
                <Stack spacing={2}>
                    <p>Select which two paths to compare.</p>
                    <Stack spacing={2} direction="row">
                        <FormControl>
                            <Select
                                value={extent1.value}
                                onChange={(e, obj) => {
                                    setExtent1({ value: e.target.value, name: obj.props.name });
                                }}
                            >
                                {extentOptions}
                            </Select>
                            <FormHelperText>Path 1</FormHelperText>
                        </FormControl>
                        <FormControl>
                            <Select
                                value={extent2.value}
                                onChange={(e, obj) => {
                                    setExtent2({ value: e.target.value, name: obj.props.name });
                                }}
                            >
                                {extentOptions}
                            </Select>
                            <FormHelperText>Path 2</FormHelperText>
                        </FormControl>
                    </Stack>
                    <CheckboxTable
                        header="State properties"
                        itemProps={properties}
                        click={addStateProperty}
                        clickedProps={stateProperties}
                    />
                    <CheckboxTable
                        header="Atom properties"
                        api_call="/api/get_atom_properties"
                        click={addAtomProperty}
                        clickedProps={atomProperties}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={calculatePathSimilarity}>Calculate path similarity</Button>
                <Button color="secondary" onClick={closeFunc}>
                    Close
                </Button>
            </DialogActions>
        </>
    );
}
