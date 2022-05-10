import React from 'react';
import axios from 'axios';
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";

class AjaxVideo extends React.Component {
    constructor(props) {
        super(props);
        this.videoRef = React.createRef();
        this.state = {
            isLoaded: false,
            isLoading: false
        }
    }
    
    loadVideo = () => {        
        this.setState({isLoading: true});
        axios.post('/api/generate_ovito_animation', JSON.stringify(this.props.states), {
            params: {
                'title': this.props.title
            },
            headers: {
                "Content-Type": "application/json"
            }
           }).then((response)=> {
               const videoData = "data:video/webm;base64," + response.data.video;

               this.setState({isLoading: false, isLoaded: true}, () => {
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
                return (<CircularProgress color="secondary"/>);
            } else {
                return (
                    <Button
                        color="secondary"
                        onClick={()=>{
                            this.loadVideo();
                        }}
                        size="small">
                        Load video
                    </Button>)
            }
        } else {
            return (<video type="video/webm" width="100%" controls ref={this.videoRef}/>);
        }
    }

}

export default AjaxVideo;
