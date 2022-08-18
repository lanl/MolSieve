import React from 'react';
import ReactDOM from 'react-dom';
import './css/index.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider, createTheme, experimental_sx as sx } from '@mui/material/styles';

import App from './App';

const theme = createTheme({
    palette: {
        type: 'light',
        primary: {
            main: '#394043',
        },
        secondary: {
            main: '#8C8C8C',
        },
    },
    components: {
        MuiToolbar: {
            styleOverrides: {
                root: sx({
                    background: '#f8f9f9',
                    fontColor: '#394043',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }),
            },
        },
    },
});

ReactDOM.render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <SnackbarProvider
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                <App />
            </SnackbarProvider>
        </ThemeProvider>
    </React.StrictMode>,
    document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
