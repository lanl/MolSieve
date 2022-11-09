import React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { api_generate_ovito_image } from '../api/ajax';

class SingleStateModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = { trajectoryState: this.props.state, isLoaded: false };
        this.imgRef = React.createRef();
    }

    componentDidMount() {
        api_generate_ovito_image(this.state.trajectoryState.number)
            .then((response) => {
                const imageData = `data:image/png;base64,${response.image}`;
                this.setState({ isLoaded: true }, () => {
                    this.imgRef.current.setAttribute('src', imageData);
                });
            })
            .catch((e) => {
                alert(e);
            });
    }

    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {
        const tableRows = Object.keys(this.state.trajectoryState).map((attr) => {
            return (
                <TableRow key={attr}>
                    <TableCell>{attr}</TableCell>
                    <TableCell>{this.state.trajectoryState[attr]}</TableCell>
                </TableRow>
            );
        });

        return (
            <Dialog
                onClose={this.closeFunc}
                open={this.props.open}
                fullWidth
                width="lg"
                onBackdropClick={() => this.closeFunc()}
            >
                <DialogTitle>State {this.state.trajectoryState.number}</DialogTitle>
                <DialogContent
                    style={{
                        alignContent: 'center',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {this.state.isLoaded && <img ref={this.imgRef} />}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {!this.state.isLoaded && <CircularProgress color="grey" />}
                    </Box>
                    <br />
                    <TableContainer component={Paper}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Attribute name</TableCell>
                                    <TableCell>Attribute value</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>{tableRows}</TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button size="small" onClick={this.closeFunc}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default SingleStateModal;
