import { Component, Suspense } from 'react';
import { Environment } from '@react-three/drei';

/*
 * drei's <Environment preset> downloads an HDR sky from a CDN. Offline, behind a firewall, or when the
 * CDN is slow, that load throws and takes the whole 3D view (and page) down with it. This wrapper keeps
 * the scene drawing without reflections instead.
 */
class Quiet extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.warn('Environment lighting unavailable; drawing without it.', e?.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function SafeEnvironment(props) {
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Environment {...props} />
      </Suspense>
    </Quiet>
  );
}
