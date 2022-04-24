import { React, useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ScatterControl from "./ScatterControl";

export default function ScatterGrid({
    trajectory,
    globalUniqueStates,
    trajectoryName,
    setStateHovered,
    setStateClicked,
    runs,
}) {
    // holds all of the scatterplots for one trajectory
    const [scatterplots, setScatterplots] = useState([]);
    const [count, setCount] = useState(0);
    const [graphs, setGraphs] = useState(null);

    const addScatterplot = (id) => {
        setScatterplots([...scatterplots, id]);
    };

    const deletePlot = (e) => {
        const plot = e.target.getAttribute("data-value");
        const idx = scatterplots.findIndex((el) => el === plot);
        setScatterplots(scatterplots.filter((_, i) => i !== idx));
    };

    useEffect(() => {
        const newGraphs = scatterplots.map((id) => {
            return (
                <Box gridColumn="span 1" key={`${id}`}>
                    <Button
                        sx={{ float: "right" }}
                        data-value={`${id}`}
                        onClick={(e) => {
                            deletePlot(e);
                        }}>
                        X
                    </Button>
                    <ScatterControl
                        trajectory={trajectory}
                        globalUniqueStates={globalUniqueStates}
                        trajectoryName={trajectoryName}
                        setStateHovered={setStateHovered}
                        setStateClicked={setStateClicked}
                        id={id}
                        runs={runs}
                    />
                </Box>
            );
        });
        setGraphs(newGraphs);
    }, [scatterplots, runs, trajectory]);

    return (
        <Box display="flex" gap={2} flexDirection="column">
            <Box display="flex" flexDirection="row" gap={5}>
                <Typography variant="h6">{trajectoryName}</Typography>
                <Button
                    variant="contained"
                    onClick={() => {
                        setCount((prev) => prev + 1);
                        addScatterplot(`${trajectoryName}_sc_${count}`);
                    }}>
                    Add a new scatterplot
                </Button>
            </Box>
            <Box
                display="grid"
                sx={{
                    gridColumnGap: "10px",
                    gridTemplateColumns: "repeat(3, 1fr)",
                }}>
                {graphs}
            </Box>
        </Box>
    );

    //stateHovered={stateHovered}
}
