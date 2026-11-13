import { useLayoutEffect, useRef, useState } from 'react'
import type { GeneratedApp } from './contract.ts'
import { applyPreviewOperation, readPreviewData } from './preview-data.ts'
import type { PreviewOperation } from './preview-data.ts'

function previewDocument(app: GeneratedApp, snapshot: Record<string, string>) {
  // The JSON literal must stay inside this script regardless of model output.
  const payload = JSON.stringify(app).replaceAll('<', '\\u003c')
  const stored = JSON.stringify(Object.entries(snapshot)).replaceAll('<', '\\u003c')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'">
<style>body { margin: 0; font-family: system-ui, sans-serif; } button, input, textarea, select { font: inherit; }</style>
</head>
<body>
<script>
(() => {
  const summarize = value => {
    const name = value && typeof value === 'object' && typeof value.name === 'string' ? value.name : '';
    const detail = value && typeof value === 'object' && typeof value.message === 'string'
      ? value.message : String(value || '未知错误');
    return (name && !detail.startsWith(name) ? name + ': ' + detail : detail).slice(0, 240);
  };
  const report = value => parent.postMessage({ type: 'app-builder:preview-error', message: summarize(value) }, '*');
  window.addEventListener('error', event => report(event.error || event.message));
  window.addEventListener('unhandledrejection', event => report(event.reason));
  const entries = new Map(${stored});
  const storage = {
    get length() { return entries.size; },
    key(index) { return [...entries.keys()][Number(index)] ?? null; },
    getItem(key) { return entries.get(String(key)) ?? null; },
    setItem(key, value) {
      key = String(key); value = String(value);
      entries.set(key, value);
      parent.postMessage({ type: 'app-builder:preview-storage', operation: 'set', key, value }, '*');
    },
    removeItem(key) {
      key = String(key); entries.delete(key);
      parent.postMessage({ type: 'app-builder:preview-storage', operation: 'remove', key }, '*');
    },
    clear() {
      entries.clear();
      parent.postMessage({ type: 'app-builder:preview-storage', operation: 'clear' }, '*');
    }
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: false });
  const app = ${payload};
  document.title = app.title;
  const style = document.createElement('style');
  style.textContent = app.css;
  document.head.append(style);
  const markup = document.createElement('template');
  markup.innerHTML = app.html;
  markup.content.querySelectorAll('base, meta, script, link, iframe, frame, object, embed').forEach(node => node.remove());
  document.body.append(markup.content);
  const script = document.createElement('script');
  script.textContent = app.js;
  document.body.append(script);
})();
</script>
</body>
</html>`
}

export function Preview({ app, namespace, onRepair }: { app: GeneratedApp; namespace: string; onRepair?: (message: string) => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [failure, setFailure] = useState('')
  const [document] = useState(() => previewDocument(app, readPreviewData(namespace)))

  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return
      if (event.data?.type === 'app-builder:preview-storage') {
        const { operation, key, value } = event.data
        applyPreviewOperation(namespace, { operation, key, value } as PreviewOperation)
      }
      if (event.data?.type === 'app-builder:preview-error') {
        const message = typeof event.data.message === 'string' ? event.data.message.slice(0, 240) : '未知错误'
        setFailure(message)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [namespace])

  return (
    <>
      {failure ? <div className="preview-error" role="alert">
        <span>预览脚本遇到错误：{failure}</span>
        {onRepair ? <button type="button" onClick={() => onRepair(failure)}>修复应用</button> : null}
      </div> : null}
      <iframe ref={frame} title="应用预览" tabIndex={0} sandbox="allow-scripts" srcDoc={document}
        onLoad={() => frame.current?.focus()} />
    </>
  )
}
