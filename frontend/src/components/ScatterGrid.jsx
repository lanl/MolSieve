import { React } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";

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
                        color="secondary"
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
        <Box display="flex" flexDirection="column" sx={sx}>
            {control}
            <Divider/>
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
}
