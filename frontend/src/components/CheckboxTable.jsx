import { React, useState, useEffect } from 'react';
import '../css/App.css';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import axios from 'axios';

/* eslint-disable */
export default function CheckboxTable({
    click,
    api_call,
    itemProps,
    clickedProps = [],
    header,
    selectOnlyOne = false,
}) {
    const [items, setItems] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);

    const clickFunc = (e) => {
        // build list of clicked checkboxes
        if (e.target.checked) {
            if (selectOnlyOne) {
                click([e.target.value]);
            } else {
                click([...clickedProps, e.target.value]);
            }
        } else if (selectOnlyOne) {
            click([]);
        } else {
            const idx = clickedProps.indexOf(e.target.value);
            const propsCopy = [...clickedProps];
            propsCopy.splice(idx, 1);
            click(propsCopy);
        }
    };

    useEffect(() => {
        if (api_call !== undefined && api_call !== '') {
            axios
                .get(api_call)
                .then((response) => {
                    setItems(response.data);
                })
                .catch((e) => {
                    alert(e);
                });
        } else {
            setItems(itemProps);
        }

        setIsLoaded(true);
    }, []);

    if (!isLoaded) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <CircularProgress color="grey" />
            </Box>
        );
    }
    return (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>{header}</TableCell>
                        <TableCell>Load?</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {items.map((i) => (
                        <TableRow key={i}>
                            <TableCell>{i}</TableCell>
                            <TableCell>
                                <Checkbox
                                    onClick={clickFunc}
                                    color="secondary"
                                    size="small"
                                    value={i}
                                    defaultChecked={clickedProps.includes(i)}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
