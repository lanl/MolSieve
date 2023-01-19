import { React, useEffect } from 'react';

import Box from '@mui/material/Box';

import { useSnackbar } from 'notistack';
// import Scatterplot from '../vis/Scatterplot';
import { apiCalculateNEB, onMessageHandler } from '../api/ajax';

export default function NEBWrapper({
    trajectoryName,
    start,
    end,
    interpolate,
    maxSteps,
    fmax,
    saveResults,
}) {
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        apiCalculateNEB(trajectoryName, start, end, interpolate, maxSteps, fmax, saveResults)
            .then((id) => {
                const client = new WebSocket(`ws://localhost:8000/api/ws/${id}`);
                client.onmessage = onMessageHandler(
                    () => {
                        enqueueSnackbar(`Task ${id} started.`);
                    },
                    (data) => {
                        enqueueSnackbar(`Task ${id}: ${data.message}`);
                    },
                    (response) => {
                        /* 
                        const { data } = response;
                        const drawSequence = [];
                        const gap = 1 / interpolate;

                        const unpackedEnergies = [];
                        data.energies.map((energyList) => {
                            for (const e of energyList) {
                                unpackedEnergies.push(e);
                            }
                        }); */
                        console.log(response.data);
                        enqueueSnackbar(`Task ${id} complete.`);
                    }
                );
            })
            .catch((e) => {
                alert(e);
            });
    }, []);

    return <Box>Neb</Box>;
}
