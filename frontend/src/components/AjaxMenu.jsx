import { React, useState, useEffect } from 'react';
import axios from 'axios';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * Menu that hits a back-end API upon loading.
 *
 * @param {Bool} open - Whether or not the menu is open.
 * @param {String} apiCall - URL of the API to use.
 * @param {Array} clicked - Items that were already clicked.
 * @param {Function} click - Function to call when items get clicked.
 * @param {Object} anchorEl - Element to anchor the menu to.
 * @param {Function} handleClose - Function to call when closing the menu.
 */
export default function AjaxMenu({ open, apiCall, clicked, click, anchorEl, handleClose }) {
    const [items, setItems] = useState([]);
    const [itemsClicked, setClicked] = useState([]);
    const [lastEvent, setLastEvent] = useState(null);

    // call apiCall URL on every open
    useEffect(() => {
        if (open) {
            axios
                .get(apiCall)
                .then((response) => {
                    setItems(response.data);
                })
                .catch((e) => {
                    alert(e);
                });
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
            {items.length === 0 && (
                <MenuItem>
                    <CircularProgress color="grey" />
                </MenuItem>
            )}

            {items.length > 0 &&
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
