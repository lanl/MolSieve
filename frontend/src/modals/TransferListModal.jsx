import { React, useState, useEffect } from 'react';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';

import TransferList from '../components/TransferList';

/**
 * Transfer List embedded in a Modal.
 *
 * @param {Array<String>} options - The options to choose from.
 * @param {Bool} open - Is the modal open?
 * @param {String} title - Title shown in the Modal.
 * @param {Function} onSubmit - Function to run when submitting.
 * @param {Function} handleClose - Function to run when closing.
 */
export default function TransferListModal({ options, open, title, onSubmit, handleClose }) {
    const [chosen, setChosen] = useState([]);
    const [available, setAvailable] = useState(options);

    useEffect(() => {
        setChosen([]);
        setAvailable(options);
    }, [open]);

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <TransferList
                    chosen={chosen}
                    available={available}
                    setChosen={setChosen}
                    setAvailable={setAvailable}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button onClick={() => onSubmit(chosen)}>Create</Button>
            </DialogActions>
        </Dialog>
    );
}
