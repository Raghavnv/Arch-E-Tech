import { Component } from 'react';

// a page that crashes would otherwise leave a blank screen with no clue why: show what broke instead
export default class ErrorBoundary extends Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
    this.setState({ info });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    const details = `${error.name}: ${error.message}\n${(info?.componentStack || '').trim().split('\n').slice(0, 6).join('\n')}\nat ${window.location.pathname}${window.location.search}`;
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
        <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-lg font-semibold">This page hit an error</h1>
          <p className="mt-1 text-sm text-zinc-400">Your work is saved. Copy the details below and send them over so it can be fixed.</p>
          <pre className="mt-4 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-3 font-mono text-xs text-rose-300">{details}</pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => navigator.clipboard?.writeText(details)} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200">Copy details</button>
            <button onClick={() => window.location.reload()} className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold hover:bg-zinc-700">Reload</button>
            <a href="/dashboard" className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold hover:bg-zinc-700">Back to dashboard</a>
          </div>
        </div>
      </div>
    );
  }
}
