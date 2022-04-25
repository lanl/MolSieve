import { React, useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
//import Stack from "@mui/material/Stack";

export default function ScatterGrid({
    display,
    deletePlot,
    children,
    control,
}) {

    const [displayProp, setDisplayProp] = useState("flex");

    useEffect(() => {
        if (display === undefined || display === true) {
            setDisplayProp("flex");
        } else {
            setDisplayProp("none");
        }
    }, [display]);
   
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
        <Container
            maxWidth={false}
            sx={{ display: displayProp, flexDirection: "column" }}>               
            {control}
            <Box
                display="grid"
                sx={{
                    gridColumnGap: "10px",
                    gridTemplateColumns: "repeat(3, 1fr)",
                }}>
                {graphs}
            </Box>
        </Container>
    );

    //stateHovered={stateHovered}
}
