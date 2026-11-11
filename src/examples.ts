import type { GeneratedApp } from './contract.ts'

const css = `
  body { background: #f7faf7; color: #17342d; }
  main { max-width: 560px; margin: auto; padding: 28px; }
  h1 { font-size: 28px; margin: 0 0 20px; }
  form, li { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  input:not([type="checkbox"]) { min-width: 0; flex: 1; padding: 9px; border: 1px solid #bdd1c6; border-radius: 7px; }
  button { border: 0; border-radius: 7px; background: #1d5547; color: white; padding: 9px 12px; cursor: pointer; }
  ul { padding: 0; }
  li { padding: 9px 0; border-bottom: 1px solid #dce7df; }
  li label { display: flex; align-items: center; gap: 8px; }
  label:has(:checked) span { text-decoration: line-through; }
`

export const todoExample: GeneratedApp = {
  title: '待办清单',
  html: `<main><h1>待办清单</h1><form>
    <input id="task-name" aria-label="任务名称" placeholder="任务名称" required>
    <button type="button">添加任务</button>
    </form><ul aria-label="任务"></ul></main>`,
  css,
  js: `
    const form = document.querySelector('form');
    const nameInput = document.querySelector('#task-name');
    const tasks = document.querySelector('ul');
    function addEntry() {
      if (!form.reportValidity()) return;
      const task = nameInput.value.trim();
      if (!task) return;
      const row = document.createElement('li');
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      const text = document.createElement('span');
      checkbox.type = 'checkbox';
      text.textContent = task;
      label.append(checkbox, text);
      row.append(label);
      tasks.append(row);
      form.reset();
      nameInput.focus();
    }
    form.querySelector('button').addEventListener('click', addEntry);
    form.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement && !event.isComposing) {
        event.preventDefault();
        addEntry();
      }
    });
  `,
}

export const expenseExample: GeneratedApp = {
  title: '支出记录',
  html: `<main><h1>支出记录</h1><form>
    <input id="expense-name" aria-label="支出名称" placeholder="支出名称" required>
    <input id="amount" type="number" aria-label="金额" placeholder="金额" min="0.01" max="1000000" step="0.01" required>
    <button type="button">添加支出</button>
    </form><p aria-live="polite">总额 ¥<strong id="total">0.00</strong></p><ul aria-label="支出明细"></ul></main>`,
  css,
  js: `
    const form = document.querySelector('form');
    const nameInput = document.querySelector('#expense-name');
    const amount = document.querySelector('#amount');
    const expenses = document.querySelector('ul');
    const total = document.querySelector('#total');
    let totalCents = 0;
    function addEntry() {
      if (!form.reportValidity()) return;
      const item = nameInput.value.trim();
      const cents = Math.round(amount.valueAsNumber * 100);
      if (!item || !Number.isFinite(cents) || cents < 1) return;
      const row = document.createElement('li');
      row.textContent = item + ' · ¥' + (cents / 100).toFixed(2);
      expenses.append(row);
      totalCents += cents;
      total.textContent = (totalCents / 100).toFixed(2);
      form.reset();
      nameInput.focus();
    }
    form.querySelector('button').addEventListener('click', addEntry);
    form.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement && !event.isComposing) {
        event.preventDefault();
        addEntry();
      }
    });
  `,
}
