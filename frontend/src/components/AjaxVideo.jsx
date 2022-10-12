import { React, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import LoadingBox from './LoadingBox';

export default function AjaxVideo({ states, title, width, height }) {
    const [isLoaded, setIsLoaded] = useState(false);
    const videoRef = useRef();

    useEffect(() => {
        axios
            .post(
                '/api/generate_ovito_animation',
                { states, width, height },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            )
            .then((response) => {
                const videoData = `data:video/webm;base64,${response.data.video}`;
                setIsLoaded(true);
                videoRef.current.setAttribute('src', videoData);
            });
    }, [states, title]);
    return isLoaded ? <video type="video/webm" controls ref={videoRef} /> : <LoadingBox />;
}

AjaxVideo.defaultProps = {
    width: 200,
    height: 200,
};
