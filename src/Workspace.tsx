import {
  ArrowRight, ArrowUp, Check, CircleAlert, ClipboardList, Globe2, Layers3,
  LoaderCircle, Monitor, RotateCcw, Sparkles, Wallet,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { isGeneratedApp, PROMPT_LIMIT } from './contract.ts'
import type { GeneratedApp } from './contract.ts'
import { expenseExample, todoExample } from './examples.ts'
import { Preview } from './Preview.tsx'
import { createProject, readProject, saveProject } from './project.ts'
import type { Project } from './project.ts'

const examples = [
  { title: '待办清单', description: '添加任务，标记完成', icon: ClipboardList, app: todoExample, prompt: '生成一个可以新增任务并勾选完成的待办清单' },
  { title: '支出记录', description: '录入支出，计算总额', icon: Wallet, app: expenseExample, prompt: '生成一个可以录入支出名称和金额、并显示总额的记账页' },
]

async function generateApp(prompt: string, currentApp?: GeneratedApp) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, currentApp }),
    signal: AbortSignal.timeout(100_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof data?.message === 'string' ? data.message : '生成服务暂时不可用，请重试。')
  }
  if (!isGeneratedApp(data)) throw new Error('没有收到可用的应用，请重试。')
  return data
}

export function Workspace() {
  const [project, setProject] = useState(readProject)
  const [prompt, setPrompt] = useState(project?.prompt ?? '')
  const [revision, setRevision] = useState('')
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(Boolean(project))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [sample, setSample] = useState<GeneratedApp | null>(null)
  const [previewVersion, setPreviewVersion] = useState(0)
  const inFlight = useRef(false)
  const promptInput = useRef<HTMLTextAreaElement>(null)
  const previewApp = sample ?? project?.app
  const draft = editing ? revision : prompt
  const inputLabel = editing ? '修改需求' : '应用需求'

  function showSample(app: GeneratedApp | null) {
    setSample(app)
    setPreviewVersion(version => version + 1)
  }

  function changeMode(nextEditing: boolean) {
    setEditing(nextEditing)
    setError('')
    promptInput.current?.focus()
  }

  function repairPreview(message: string) {
    if (!project || sample) return
    setRevision(`修复预览运行错误：${message}。保留现有功能和界面，并确保应用启动后可以正常交互。`)
    setEditing(true)
    setError('')
    requestAnimationFrame(() => promptInput.current?.focus())
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const brief = draft.trim()
    if (!brief) {
      setError(editing ? '请先描述你想修改的内容。' : '请先描述你想创建的应用。')
      promptInput.current?.focus()
      return
    }

    inFlight.current = true
    setPending(true)
    setError('')
    try {
      const currentProject = editing ? project : null
      const app = await generateApp(brief, currentProject?.app)
      const nextProject: Project = createProject(currentProject?.prompt ?? brief, app, currentProject ?? undefined)
      setSaved(saveProject(nextProject))
      setProject(nextProject)
      setRevision('')
      showSample(null)
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'TimeoutError') {
        setError('生成时间超过限制，请简化需求或重试。')
      } else if (failure instanceof TypeError) {
        setError('无法连接生成服务，请检查网络后重试。')
      } else {
        setError(failure instanceof Error ? failure.message : '生成失败，请重试。')
      }
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <div className="workspace">
      <header className="site-header">
        <div className="header-inner">
          <div className="brand"><span className="brand-mark"><Layers3 size={19} /></span>App Builder</div>
          <div className="header-context"><Monitor size={15} /> 生成工作台</div>
        </div>
      </header>

      <main className="page">
        <section className="intro" aria-labelledby="page-title">
          <h1 id="page-title">描述需求，<span>生成应用</span></h1>
          <p>用自然语言说明你想做什么，生成后可以直接操作网页预览。</p>
        </section>

        <div className="workbench">
          <section className="composer" aria-labelledby="composer-title">
            <div className="section-heading">
              <span className="heading-icon"><Sparkles size={17} /></span>
              <h2 id="composer-title">{inputLabel}</h2>
            </div>
            {editing ? <p className="revision-context">基于「{project?.app.title}」继续修改。<button type="button" className="example-action" disabled={pending} onClick={() => changeMode(false)}>返回新建</button></p> : null}
            <form id="generate-form" onSubmit={submit}>
              <div className="input-card">
                <textarea
                  ref={promptInput}
                  aria-label={inputLabel}
                  aria-describedby="prompt-count"
                  value={draft}
                  readOnly={pending}
                  maxLength={PROMPT_LIMIT}
                  placeholder={editing ? '例如：加一个筛选器，只显示未完成的任务…' : '例如：做一个能添加任务、标记完成的待办清单…'}
                  onChange={event => {
                    if (editing) setRevision(event.target.value)
                    else setPrompt(event.target.value)
                    if (error) setError('')
                  }}
                  onKeyDown={event => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
                <div className="input-footer">
                  <span id="prompt-count">{draft.length} / {PROMPT_LIMIT}</span>
                  <button className="generate-button" type="submit" disabled={pending}>
                    {pending ? <LoaderCircle className="spinner" size={16} /> : <ArrowUp size={16} />}
                    {editing ? (pending ? '修改中' : '应用修改') : (pending ? '生成中' : '生成应用')}
                  </button>
                </div>
              </div>
              {error ? (
                <div className="request-error" role="alert">
                  <CircleAlert size={16} />
                  <span>{error}</span>
                  {draft.trim() ? <button type="submit">重试</button> : null}
                </div>
              ) : null}
            </form>

            {!editing ? <div className="examples">
              <h3>从示例开始</h3>
              {examples.map(({ title, description, prompt: examplePrompt, icon: Icon, app }) => (
                <div className="example" key={title}>
                  <button type="button" className="example-prompt" aria-label={`填入${title}需求`} disabled={pending} onClick={() => {
                    setPrompt(examplePrompt)
                    setError('')
                    promptInput.current?.focus()
                  }}>
                    <span className="example-icon"><Icon size={17} /></span>
                    <span className="example-copy"><strong>{title}</strong><small>{description}</small></span>
                  </button>
                  <button type="button" className="example-action" aria-label={`试用${title}`} disabled={pending} onClick={() => showSample(app)}>
                    试用 <ArrowRight size={13} />
                  </button>
                </div>
              ))}
            </div> : null}
          </section>

          <section className="preview-panel" aria-labelledby="preview-title">
            <header className="preview-heading">
              <div className="section-heading">
                <span className="heading-icon"><Monitor size={17} /></span>
                <h2 id="preview-title">应用预览</h2>
              </div>
              {previewApp ? <div className="preview-actions">
                {project && !sample && !editing ? <button className="example-action" type="button" disabled={pending} onClick={() => changeMode(true)}>继续修改</button> : null}
                {sample ? <button className="example-action" type="button" onClick={() => showSample(null)}>
                  {project ? '返回项目' : '退出示例'}
                </button> : null}
                <button className="icon-button" title="重新加载预览" aria-label="重新加载预览" type="button"
                  onClick={() => setPreviewVersion(version => version + 1)}>
                  <RotateCcw size={16} />
                </button>
              </div> : null}
            </header>
            <div className="preview-browser">
              <div className="browser-bar">
                <div className="browser-dots" aria-hidden="true"><i /><i /><i /></div>
                <span className="browser-title"><Globe2 size={13} /> {previewApp?.title ?? '应用预览'}</span>
              </div>
              <div className="preview-surface" aria-busy={pending}>
                {previewApp ? <Preview key={`${sample ? sample.title : project?.id}-${previewVersion}`} app={previewApp}
                  namespace={sample ? `example-${sample === todoExample ? 'todo' : 'expense'}` : project!.id}
                  onRepair={project && !sample ? repairPreview : undefined} /> : (
                  <div className="preview-empty">
                    <div className="preview-glyph" aria-hidden="true">
                      {pending ? <LoaderCircle size={30} className="spinner" /> : <Layers3 size={31} strokeWidth={1.55} />}
                    </div>
                    <h3>{pending ? '正在生成应用' : '等待生成应用'}</h3>
                    <p>{pending ? '模型正在编写页面和交互逻辑。' : '填写应用需求，生成结果会显示在这里。'}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="preview-footer" role="status">
              {pending ? <><LoaderCircle size={14} className="spinner" />{editing ? '正在修改当前应用' : '正在生成新结果'}</> :
                sample ? <><span className="status-dot" />内置示例 · 无需 API 密钥</> :
                project ? (saved ? <><Check size={15} />已保存需求和应用代码</> :
                  <><CircleAlert size={15} />当前结果未保存，刷新后可能丢失</>) :
                  <><span className="status-dot" />生成的项目将保存在此浏览器</>}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
