let expenses = JSON.parse(localStorage.getItem('expenses')) || [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('date-input').valueAsDate = new Date();
  renderExpenses();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }

  const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // 請貼上你的金鑰

  const ocrInput = document.getElementById('ocr-input');
  ocrInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const loadingEl = document.getElementById('ocr-loading');
    const previewEl = document.getElementById('ocr-preview');
    const textResultEl = document.getElementById('ocr-text-result');

    loadingEl.textContent = "🤖 雲端 AI 正在深度辨識單據內容...";
    loadingEl.classList.remove('hidden');
    previewEl.classList.add('hidden');

    try {
      const base64Data = await fileToBase64(file);
      const base64Content = base64Data.split(',')[1];

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "請分析這張發票或單據照片，並嚴格只回傳以下 JSON 格式（不要包含任何 Markdown 標記或多餘文字）：\n" +
                      "{\n" +
                      '  "store": "商店或機構名稱",\n' +
                      '  "amount": 總金額數字,\n' +
                      '  "date": "YYYY-MM-DD 格式日期",\n' +
                      '  "items": ["品項1", "品項2"]\n' +
                      "}\n" +
                      "若無法辨識日期，請填寫今日日期；若無法確定金額，請填 0。"
              },
              {
                inline_data: {
                  mime_type: file.type,
                  data: base64Content
                }
              }
            ]
          }]
        })
      });

      const resData = await response.json();
      const rawText = resData.candidates[0].content.parts[0].text;
      const cleanJsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanJsonStr);

      if (result.store) document.getElementById('desc-input').value = result.store;
      if (result.amount) document.getElementById('amount-input').value = result.amount;
      if (result.date) document.getElementById('date-input').value = result.date;

      loadingEl.classList.add('hidden');
      previewEl.classList.remove('hidden');
      textResultEl.innerHTML = `
        <strong>商店：</strong>${result.store || '未辨識'}<br>
        <strong>金額：</strong>$${result.amount || 0}<br>
        <strong>日期：</strong>${result.date || '未辨識'}<br>
        <strong>品項：</strong>${(result.items || []).join(', ') || '無'}
      `;

    } catch (err) {
      loadingEl.classList.add('hidden');
      alert('AI 單據辨識失敗，請檢查 API Key 或手動輸入。');
      console.error(err);
    }
  });

  const form = document.getElementById('expense-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('desc-input').value;
    const amount = parseFloat(document.getElementById('amount-input').value);
    const date = document.getElementById('date-input').value;

    expenses.unshift({ id: Date.now(), desc, amount, date });
    saveAndRender();
    form.reset();
    document.getElementById('date-input').valueAsDate = new Date();
    document.getElementById('ocr-preview').classList.add('hidden');
  });
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function deleteExpense(id) {
  expenses = expenses.filter(item => item.id !== id);
  saveAndRender();
}

function saveAndRender() {
  localStorage.setItem('expenses', JSON.stringify(expenses));
  renderExpenses();
}

function renderExpenses() {
  const listEl = document.getElementById('expense-list');
  const totalEl = document.getElementById('total-amount');
  listEl.innerHTML = '';

  let total = 0;
  if (expenses.length === 0) {
    listEl.innerHTML = `<li class="py-4 text-center text-slate-400 text-sm">尚無支出紀錄</li>`;
  } else {
    expenses.forEach(item => {
      total += item.amount;
      const li = document.createElement('li');
      li.className = 'py-3 flex justify-between items-center';
      li.innerHTML = `
        <div>
          <div class="font-medium text-slate-800">${item.desc}</div>
          <div class="text-xs text-slate-400">${item.date}</div>
        </div>
        <div class="flex items-center space-x-3">
          <span class="font-bold text-red-500">-$${item.amount.toFixed(2)}</span>
          <button onclick="deleteExpense(${item.id})" class="text-slate-300 hover:text-red-500 text-sm">✕</button>
        </div>
      `;
      listEl.appendChild(li);
    });
  }
  totalEl.textContent = `總計: $${total.toFixed(2)}`;
}
