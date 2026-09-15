// 初始化本地儲存空間
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];

document.addEventListener('DOMContentLoaded', () => {
  // 設定預設日期為今天
  document.getElementById('date-input').valueAsDate = new Date();
  renderExpenses();

  // 1. 註冊 Service Worker (PWA 核心)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker 註冊成功'))
      .catch(err => console.error('Service Worker 註冊失敗', err));
  }

// 初始化本地儲存空間
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('date-input').valueAsDate = new Date();
  renderExpenses();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }

  // API 金鑰與設定 (建議透過雲端後端 Proxy 呼叫，此處以前端直接呼叫 Gemini Vision API 為例)
  const GEMINI_API_KEY = "AQ.Ab8RN6J1BdQqld7OpPWp204y0PhTn4zLUvW7lFS_KqxYSh0Lhg"; // 請替換為你的 API Key

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
      // 1. 將圖片轉為 Base64
      const base64Data = await fileToBase64(file);
      const base64Content = base64Data.split(',')[1];

      // 2. 呼叫 Google Gemini Vision API (以 gemini-2.5-flash 為例)
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
      
      // 清理 Markdown 標籤並解析 JSON
      const cleanJsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanJsonStr);

      // 3. 填入表單
      if (result.store) {
        document.getElementById('desc-input').value = result.store;
      }
      if (result.amount) {
        document.getElementById('amount-input').value = result.amount;
      }
      if (result.date) {
        document.getElementById('date-input').value = result.date;
      }

      // 4. 顯示辨識結果摘要
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

  // 表單提交處理
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

// Helper: 檔案轉 Base64
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


  // 3. 表單提交新增紀錄
  const form = document.getElementById('expense-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('desc-input').value;
    const amount = parseFloat(document.getElementById('amount-input').value);
    const date = document.getElementById('date-input').value;

    const newExpense = {
      id: Date.now(),
      desc,
      amount,
      date
    };

    expenses.unshift(newExpense);
    saveAndRender();
    form.reset();
    document.getElementById('date-input').valueAsDate = new Date();
    document.getElementById('ocr-preview').classList.add('hidden');
  });
});

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
