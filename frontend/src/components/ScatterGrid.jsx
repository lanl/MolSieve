import { React } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";


export default function ScatterGrid({
    deletePlot,
    children,
    control,
    sx
}) {

    const graphs = children.map((child) => {
        return (
            <Box gridColumn="span 1" key={`${child.props.id}`}>
                <Box>
                    <Button
                        sx={{ float: "right" }}
                        data-value={`${child.props.id}`}
                        onClick={(e) => {
                            deletePlot(e);
                        }}>
                        X
                    </Button>
                    {child}
                </Box>
            </Box>);
    });

    return (
        <Box display="inline-flex" flexDirection="column" style={sx}>               
            {control}
            <Box
                display="grid"
                sx={{
                    gridColumnGap: "10px",
                    gridTemplateColumns: "repeat(2, 1fr)",
                }}>
                {graphs}
            </Box>
        </Box>
    );

    //stateHovered={stateHovered}
}
