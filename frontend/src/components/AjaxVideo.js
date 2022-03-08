import React from 'react';
import axios from 'axios';
import CircularProgress from "@mui/material/CircularProgress";

class AjaxVideo extends React.Component {
    constructor(props) {
        super(props);
        this.videoRef = React.createRef();        
        this.state = {
            isLoaded: false,            
        }
    }

    // for now will just load Ovito animation
    componentDidMount() {
        if(!this.state.isLoaded) {
            axios.get('/generate_ovito_animation', {params: {'run': this.props.run,
                                                             'start': this.props.start,
                                                             'end': this.props.end
                                                            }}).then((response)=> {
                                                                const videoData = "data:video/webm;base64," + response.data.video;
                this.setState({isLoaded: true}, () => {
                    this.videoRef.current.setAttribute("src", videoData);
                });
            });
        }
    }

    render() {
        if(!this.state.isLoaded) {
            return (<CircularProgress color="grey"/>)
        } else {
            return (<video type="video/webm" controls ref={this.videoRef}/>);
        }
    }

}

export default AjaxVideo;
