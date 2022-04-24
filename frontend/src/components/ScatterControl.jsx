import { React, useState, useEffect } from "react";

import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Select from "@mui/material/Select";
import Scatterplot from "../vis/Scatterplot";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";

export default function ScatterControl({
    trajectory,
    globalUniqueStates,
    setStateHovered,
    setStateClicked,
    trajectoryName,
    id,
    runs,
}) {
    // holds a scatterplot per user-defined number of scatterplots

    const [xAttribute, setXAttribute] = useState(trajectory.properties[0]);
    const [yAttribute, setYAttribute] = useState(trajectory.properties[0]);
    const [xAttributeList, setXAttributeList] = useState(null);
    const [yAttributeList, setYAttributeList] = useState(null);
    const [scatterplotID, setScatterplotID] = useState(
        `${trajectoryName}_${id}`
    );

    const vals = [];
    for (const s of trajectory.simplifiedSequence.sequence) {
        vals.push(globalUniqueStates.get(s.id));
    }

    useEffect(() => {
        if (xAttribute === "timestep") {
            const timesteps = trajectory.simplifiedSequence.sequence.map(
                (s) => {
                    return s.timestep;
                }
            );

            setXAttributeList(timesteps);
        } else {
            setXAttributeList(null);
        }
    }, [xAttribute]);

    useEffect(() => {
        if (yAttribute === "timestep") {
            const timesteps = trajectory.simplifiedSequence.sequence.map(
                (s) => {
                    return s.timestep;
                }
            );

            setYAttributeList(timesteps);
        } else {
            setYAttributeList(null);
        }
    }, [yAttribute]);

    let options = trajectory.properties.map((property) => {
        return (
            <MenuItem key={property} value={property}>
                {property}
            </MenuItem>
        );
    });

    return (
        <>
            <Stack spacing={1}>
                <TextField
                    label="Scatterplot ID"
                    value={scatterplotID}
                    onChange={(e) => {
                        setScatterplotID(e.target.value);
                    }}
                    variant="standard"
                />
                <Stack direction="row" justifyContent="center" spacing={2}>
                    <FormControl>
                        <Select
                            value={xAttribute}
                            onChange={(e) => {
                                setXAttribute(e.target.value);
                            }}>
                            {options}
                            <MenuItem key="timestep" value="timestep">
                                timestep
                            </MenuItem>
                        </Select>
                        <FormHelperText>X attribute</FormHelperText>
                    </FormControl>
                    <FormControl>
                        <Select
                            value={yAttribute}
                            onChange={(e) => {
                                setYAttribute(e.target.value);
                            }}>
                            {options}
                            <MenuItem key="timestep" value="timestep">
                                timestep
                            </MenuItem>
                        </Select>
                        <FormHelperText>Y attribute</FormHelperText>
                    </FormControl>
                </Stack>
            </Stack>
            <Divider />
            <Scatterplot
                data={{
                    sequence: vals,
                    x_attribute: xAttribute,
                    y_attribute: yAttribute,
                    colors: trajectory.colors,
                    x_attributeList: xAttributeList,
                    y_attributeList: yAttributeList,
                }}
                trajectory={trajectory}
                globalUniqueStates={globalUniqueStates}
                setStateHovered={setStateHovered}
                setStateClicked={setStateClicked}
                scatterplotID={scatterplotID}
                trajectoryName={trajectoryName}
                runs={runs}
            />
        </>
    );

    //stateHovered={stateHovered}
}
