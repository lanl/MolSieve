import {React, useState} from 'react';


//TODO refactor to just be any arbitrary element
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

export default function ButtonWithOptionMenu({func, data, buttonText}) {

    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const click = (event) => {
        setAnchorEl(event.currentTarget);
    }

    const handleClose = () => {
        setAnchorEl(null);
    }

    const options = data.map(
        (d) => {
            return (
                <MenuItem
                    onClick={(e) => {
                        func(e.target.getAttribute('data-value'));
                        handleClose();
                    }}
                    data-value={d}
                    key={d}>
                    {d}
                </MenuItem>);
        });
    
    return (<>
            <IconButton
                size="small"
                color="secondary"
                onClick={click}>
                {buttonText}
            </IconButton>
                <Menu
                    anchorEl={anchorEl}
                    open={open}
                    onClose={handleClose}>
                {options}
            </Menu>            
        </>);
}    
