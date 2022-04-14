import React from "react";
import axios from "axios";
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';

class AjaxMenu extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            isLoaded: false,
            items: [],
            clicked: []
        }
    }

  componentDidMount() {    
      if(this.props.api_call !== undefined && this.props.api_call !== '') {
            axios
                .get(this.props.api_call)
                .then((response) => {
                    this.setState({ isLoaded: true, items: response.data });
                })
                .catch((e) => {
                    alert(e);
                });
        }
  }

  handleChange = (e) => {
    if (e.target.checked) {
      this.setState({clicked: [...this.state.clicked, e.target.value]}, () => {
        if (this.props.click) {
          this.props.click(e, e.target.value);
        }
      });            
    } else {
      let newClicked = [...this.state.clicked];
      newClicked.splice(newClicked.indexOf(e.target.value), 1);
      this.setState({clicked: newClicked}, () => {
        if (this.props.click) {
          this.props.click(e, e.target.value);
        }
      });            
    }
  }

    click = (e) => {
        if (e.target.checked) {
            this.setState({clicked: [...this.state.clicked, e.target.value]}, () => {
                if (this.props.click) {
                    this.props.click(e, this.state.clicked);
                }
            });
        } else {
            let newClicked = [...this.state.clicked];
            newClicked.splice(newClicked.indexOf(e.target.value), 1);
            this.setState({clicked: newClicked}, () => {
                if (this.props.click) {
                    this.props.click(e, this.state.clicked);
                }
            });            
        }
    }

    render() {
      const { isLoaded, items } = this.state;

        console.log("rendering");
        console.log(this.props);
        return (<Menu
                  anchorEl={this.props.anchorEl}
                  open={this.props.open}
                  onClose={this.props.handleClose}>
                  
                  {!isLoaded && (
                    <MenuItem>                
                      <CircularProgress color="grey" />
                    </MenuItem>)
                  }
                  
                  {isLoaded &&
                   items.map((item, idx) => {
                    return (<MenuItem key={idx}>
                        <ListItemIcon>
                          <Checkbox
                            checked={this.state.clicked.includes(item)}
                            onChange={(e) => {this.handleChange(e);}}
                            value={item}
                          />
                        </ListItemIcon>
                        <ListItemText>
                         {item}
                        </ListItemText>
                      </MenuItem>
                     );
                   })
                  }
                </Menu>);              
    }
}

export default AjaxMenu;
