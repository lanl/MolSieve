import React from "react";
import ReactLoading from "react-loading";
import "./App.css";
const axios = require("axios").default;

class CheckboxTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoaded: false,
      items: [],
      click: () => void 0,
      clicked: [],
    };
  }

  click = (e) => {
    if (this.props.click) {
      this.props.click(e);
    }
    // build list of clicked checkboxes
    this.state.clicked.push(e.target.value);
  };

  componentDidMount() {
    axios
      .get(this.props.api_call)
      .then((response) => {
        this.setState({ isLoaded: true, items: response.data });
      })
      .catch((e) => {
        alert(e);
      });

    if (this.props.defaults) {
      this.setState({ ...this.state, clicked: this.props.defaults });
    }
  }

  render() {
    const { isLoaded, items } = this.state;
    if (!isLoaded) {
      return (
        <ReactLoading
          className="CenteredSpinner"
          type="bars"
          color="black"
          height="5%"
          width="5%"
        />
      );
    } else {
      return (
        <table>
          <thead>
            <tr>
              <th>{this.props.header}</th>
              <th>Load?</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i}>
                <td>{i}</td>
                <td>
                  <input
                    onClick={this.click}
                    type="checkbox"
                    value={i}
                    readOnly={this.props.defaults.includes(i)}
                    disabled={this.props.defaults.includes(i)}
                    defaultChecked={this.props.defaults.includes(i)}
                  ></input>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }
}

export default CheckboxTable;
