import { Component } from "react";
import ServerError from "../pages/ServerError/index.jsx";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("AppErrorBoundary caught an error", error, info);
  }

  render() {
    if (this.state.error) {
      return <ServerError error={this.state.error} />;
    }
    return this.props.children;
  }
}
