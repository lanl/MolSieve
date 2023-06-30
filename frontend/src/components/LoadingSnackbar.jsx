import { React, forwardRef } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import { SnackbarContent } from 'notistack';
import LoadingBox from './LoadingBox';

const LoadingSnackbar = forwardRef((props, ref) => {
    const { message, ...other } = props;
    return (
        /*eslint-disable */
        <SnackbarContent ref={ref} role="alert" {...other}>
            <Card style={{ backgroundColor: '#313131', padding: '10px' }}>
                <Typography style={{
                    color: '#fff',
                    flexGrow: 1
                }}> {message}</Typography>
                <LoadingBox
                    color="white" />
            </Card>
        </SnackbarContent >
    );
});

export default LoadingSnackbar;
