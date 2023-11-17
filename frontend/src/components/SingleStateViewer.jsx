import { React, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { getStateColoringMethod } from '../api/states';
import { getChunkList } from '../api/trajectories';

// import ImageViewer from './ImageViewer';
import StateViewer from '../vis/StateViewer';

import { apiGenerateOvitoImage } from '../api/ajax';

/**
 * Wrapper for ImageViewer that gets the 3D render of the state assigned with stateID.
 *
 * @param {Number} stateID - The state ID to be rendered.
 * @param {String} visScript - The visualization script to be applied.
 * @param {Function} onClick - Function called when the image is clicked.
 */
export default function SingleStateViewer({ activeState, visScript, onClick }) {
    const [atomRep, setAtomRep] = useState(undefined);
    const [isLoading, setIsLoading] = useState(false);
    // const dispatch = useDispatch();
    const colorFunc = useSelector((state) => getStateColoringMethod(state));
    const cl = useSelector((state) => getChunkList(state, activeState.trajectory));

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        const d = {};
        // if timestep is defined, get values
        if (activeState.timestep) {
            const t = activeState.timestep;
            const clist = cl.filter((c) => c.timestep <= t && c.last >= t);
            const c = clist[0];
            const rt = t - c.timestep;
            const prev = c.sequence[rt - 1];
            const next = c.sequence[rt + 1];
            d.next = next;
            d.prev = prev;
        }

        apiGenerateOvitoImage(activeState.id, visScript, controller, d)
            .then((response) => {
                // dispatch(addPropToState(data)); do we need to save this?
                setAtomRep(response.results);
                setIsLoading(false);
            })
            .catch(() => { });
        return () => controller.abort();
    }, [activeState.id, visScript]);

    return (
        <Box onClick={onClick}>
            {isLoading && <LinearProgress variant="indeterminate" />}
            <StateViewer width={200} height={200} data={atomRep} />
            <Box height="5px" width="100%" sx={{ backgroundColor: colorFunc(activeState.id) }} />
        </Box>
    );
}
