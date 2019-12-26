const { h, Component } = require('preact')

module.exports = class App extends Component {
  constructor() {
    super()

    this.state = {
      name: 'xiaows'
    }
  }

  componentDidMount() {}

  render() {
    return (
      <div>
        <p className='msg'>Hello, {this.state.name}</p>
        <div>12344</div>
      </div>
    )
  }
}
