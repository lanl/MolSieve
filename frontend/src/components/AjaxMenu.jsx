import { React, useState, useEffect } from 'react';
import axios from 'axios';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';

export default function AjaxMenu({
    open,
    api_call: apiCall,
    itemFunction,
    clicked,
    click,
    anchorEl,
    handleClose,
}) {
    const [items, setItems] = useState(null);
    const [itemsClicked, setClicked] = useState([]);
    const [lastEvent, setLastEvent] = useState(null);

    useEffect(() => {
        if (open) {
            if (apiCall !== undefined && apiCall !== '') {
                /* const i = axios.create({
                    baseURL: 'http://localhost:8000/',
                }); */
                axios
                    .get(apiCall)
                    .then((response) => {
                        setItems(response.data);
                    })
                    .catch((e) => {
                        alert(e);
                    });
            } else if (itemFunction !== undefined) {
                setItems(itemFunction());
            }
        }

        if (clicked !== undefined) {
            setClicked(clicked);
        }
    }, [open]);

    const handleChange = (e) => {
        if (e.target.checked) {
            setClicked([...itemsClicked, e.target.value]);
            setLastEvent(e);
        } else {
            const idx = itemsClicked.indexOf(e.target.value);
            setClicked(itemsClicked.filter((_, i) => i !== idx));
            setLastEvent(e);
        }
    };

    useEffect(() => {
        if (lastEvent && click) {
            click(lastEvent, lastEvent.target.value);
        }
    }, [lastEvent]);

    return (
        <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
            {!items && (
                <MenuItem>
                    <CircularProgress color="grey" />
                </MenuItem>
            )}

            {items &&
                items.map((item, idx) => {
                    return (
                        <MenuItem key={idx}>
                            <ListItemIcon>
                                <Checkbox
                                    size="small"
                                    checked={itemsClicked.includes(item)}
                                    onChange={(e) => {
                                        handleChange(e);
                                    }}
                                    value={item}
                                />
                            </ListItemIcon>
                            <ListItemText>{item}</ListItemText>
                        </MenuItem>
                    );
                })}
        </Menu>
    );
}
