import {React, forwardRef} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Box';

const RemovableBox = forwardRef(function RemovableBox({children, childID, deleteChild, childType, onClick}, ref) {
    return (<Box
                onClick={onClick}
                ref={ref}
            >
                <Button

                    sx={{ float: "left" }}
                    data-value={`${childID}`}
                    data-type={`${childType}`}
                    color="secondary"
                    onClick={(e) => {
                        deleteChild(e);
                    }}>
                    X
                </Button>
                {children}
            </Box>);
});

export default RemovableBox;
