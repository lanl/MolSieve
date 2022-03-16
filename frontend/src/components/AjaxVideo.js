import React from 'react';
import axios from 'axios';
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";

class AjaxVideo extends React.Component {
    constructor(props) {
        super(props);
        this.videoRef = React.createRef();
        let length = this.props.end - this.props.start;       
        this.state = {
            isLoaded: false,
            length: length,
            isLoading: false
        }
    }

    // for now will just load Ovito animation
    loadVideo = () => {
        this.setState({isLoading: true});
        axios.get('/generate_ovito_animation',
                  {params: {'run': this.props.run,
                            'start': this.props.start,
                            'end': this.props.end
                           }}).then((response)=> {
                               const videoData = "data:video/webm;base64," + response.data.video;
                               this.setState({isLoaded: true, isLoading: false}, () => {
                    this.videoRef.current.setAttribute("src", videoData);
                });
            });    
    }


    componentDidMount() {
        if(!this.state.isLoaded) {
            if(this.props.end - this.props.start < 100) {
                this.loadVideo();
            }
        }
    }

    render() {
         
        if(!this.state.isLoaded) {
            if(this.state.isLoading) {
                return (<CircularProgress color="grey"/>);
            } else {
                return (<Button onClick={()=>{
                                    this.loadVideo();
                                }}
                                size="small">Load video</Button>)
            }
        } else {
            return (<video type="video/webm" controls ref={this.videoRef}/>);
        }
    }

}

export default AjaxVideo;
