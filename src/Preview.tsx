import { useLayoutEffect, useRef, useState } from 'react'
import type { GeneratedApp } from './contract.ts'

function previewDocument(app: GeneratedApp) {
  // The JSON literal must stay inside this script regardless of model output.
  const payload = JSON.stringify(app).replaceAll('<', '\\u003c')
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
  const report = () => parent.postMessage({ type: 'app-builder:preview-error' }, '*');
  window.addEventListener('error', report);
  window.addEventListener('unhandledrejection', report);
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

export function Preview({ app }: { app: GeneratedApp }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [failed, setFailed] = useState(false)
  const [document] = useState(() => previewDocument(app))

  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source === frame.current?.contentWindow && event.origin === 'null'
        && event.data?.type === 'app-builder:preview-error') setFailed(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <>
      {failed ? <div className="preview-error" role="status">预览脚本遇到错误。可重新生成应用。</div> : null}
      <iframe ref={frame} title="应用预览" sandbox="allow-scripts" srcDoc={document} />
    </>
  )
}
