import {React, useState, useEffect} from "react";
import axios from "axios";
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';

export default function AjaxMenu(props) {

    const [items, setItems] = useState(null);
    const [clicked, setClicked] = useState([]);
    const [lastEvent, setLastEvent] = useState(null);

    useEffect(() => {
        if(props.open) {
            if(props.api_call !== undefined && props.api_call !== '') {
                axios
                    .get(props.api_call)
                    .then((response) => {
                        setItems(response.data);                        
                    })
                    .catch((e) => {
                        alert(e);
                    });
            } else if(props.itemFunction !== undefined) {
                setItems(props.itemFunction());
            }
        }

        if(props.clicked !== undefined) {
            setClicked(props.clicked);
        }
        
    }, [props.open]);
  
    const handleChange = (e) => {
        if (e.target.checked) {
            setClicked([...clicked, e.target.value]);
            setLastEvent(e);
        } else {
            const idx = clicked.indexOf(e.target.value);                                   
            setClicked(clicked.filter((_,i) => i !== idx));
            setLastEvent(e);
        }
    }

    useEffect(() => {
        if (lastEvent && props.click) {
            props.click(lastEvent, lastEvent.target.value);
        }
    }, [lastEvent]);

    return (<Menu
                anchorEl={props.anchorEl}
                open={props.open}
                onClose={props.handleClose}>
                  
                {!items && (
                    <MenuItem>                
                        <CircularProgress color="grey" />
                    </MenuItem>)
                  }
                  
                {items &&
                 items.map((item, idx) => {
                    return (<MenuItem key={idx}>
                        <ListItemIcon>
                          <Checkbox
                            checked={clicked.includes(item)}
                            onChange={(e) => {handleChange(e);}}
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

