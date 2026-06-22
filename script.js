// ご指定のLIFF IDとGASウェブアプリURLを設定済みです
const LIFF_ID = "2010473243-llp7zgX9";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyQfJe2XlHcUt5WWl7YEiggAGjJarZJ4U46g3ekrZ7xpAqB5eoQqr1437fTGSenw-JIOg/exec";

document.addEventListener('DOMContentLoaded', () => {
    // 1. LIFFの初期化
    liff.init({ liffId: LIFF_ID }).then(() => {
        if (!liff.isLoggedIn()) {
            liff.login(); 
        } else {
            checkRegistration();
        }
    }).catch(err => console.error("LIFF初期化失敗", err));

    // 2. 登録ボタンのイベント
    document.getElementById('save-name-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('genji-name-input').value.trim();
        if (nameInput === "") {
            alert("源氏名を入力してください");
            return;
        }
        localStorage.setItem('castGenjiName', nameInput);
        checkRegistration();
    });

    // 3. 提出ボタンのイベント
    document.getElementById('submit-shift-btn').addEventListener('click', () => {
        submitShiftData();
    });

    // 4. タブ切り替えイベントの追加
    document.getElementById('tab-submit').addEventListener('click', () => {
        switchTab('submit');
    });
    document.getElementById('tab-view').addEventListener('click', () => {
        switchTab('view');
        fetchViewShifts(); 
    });
});

// 登録状態のチェックと画面切り替え
function checkRegistration() {
    const savedName = localStorage.getItem('castGenjiName');
    if (savedName) {
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('shift-section').style.display = 'block';
        document.getElementById('display-genji-name').textContent = savedName;
        
        generateShiftForm(); // フォーム（カレンダー）を生成
        prefillShiftForm();  // 過去データを引っ張ってきて自動セット
    } else {
        document.getElementById('register-section').style.display = 'block';
        document.getElementById('shift-section').style.display = 'none';
    }
}

// フォーム生成後、過去の提出データを自動で入力する関数
function prefillShiftForm() {
    const savedName = localStorage.getItem('castGenjiName');
    const url = `${GAS_WEB_APP_URL}?castName=${encodeURIComponent(savedName)}`;
    
    const submitBtn = document.getElementById('submit-shift-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "過去のデータを読み込み中...";
    submitBtn.disabled = true;

    fetch(url)
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success") {
            const data = resData.data;
            const startElements = document.querySelectorAll('.start-time');
            const endElements = document.querySelectorAll('.end-time');
            
            startElements.forEach((startEl, index) => {
                const endEl = endElements[index];
                const dateStr = startEl.getAttribute('data-date');
                
                const existingShift = data.find(shift => {
                    const d = new Date(shift.dateValue);
                    const shiftDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    return shiftDateStr === dateStr;
                });
                
                if (existingShift) {
                    startEl.value = existingShift.start || "";
                    endEl.value = existingShift.end || "";
                }
            });
        }
    })
    .catch(err => console.error("自動入力エラー:", err))
    .finally(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });
}

// タブの表示切り替えロジック
function switchTab(type) {
    const btnSubmit = document.getElementById('tab-submit');
    const btnView = document.getElementById('tab-view');
    const secSubmit = document.getElementById('sector-submit');
    const secView = document.getElementById('sector-view');

    if (type === 'submit') {
        btnSubmit.classList.add('active');
        btnView.classList.remove('active');
        secSubmit.style.display = 'block';
        secView.style.display = 'none';
    } else {
        btnSubmit.classList.remove('active');
        btnView.classList.add('active');
        secSubmit.style.display = 'none';
        secView.style.display = 'block';
    }
}

// ターゲットとなる「来週の月曜日」の日付を計算
function getTargetMonday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    let daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    if (dayOfWeek >= 4 || dayOfWeek === 0) { 
        daysUntilNextMonday += 7; 
    }
    const targetMonday = new Date(today);
    targetMonday.setDate(today.getDate() + daysUntilNextMonday);
    return targetMonday;
}

function generateTargetWeekDates(baseDate) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(baseDate);
        currentDate.setDate(baseDate.getDate() + i);
        dates.push(currentDate);
    }
    return dates;
}

// プルダウンの選択肢を生成する関数（LASTを追加）
function generateTimeOptions() {
    let options = '<option value="">休み</option>';
    options += '<option value="27:00">LAST</option>'; // 【追加】休みのすぐ下にLASTを配置
    
    for (let hour = 18; hour <= 27; hour++) {
        options += `<option value="${hour}:00">${hour}:00</option>`;
        if (hour !== 27) {
            options += `<option value="${hour}:30">${hour}:30</option>`;
        }
    }
    return options;
}

function generateShiftForm() {
    const container = document.getElementById('calendar-container');
    container.innerHTML = "";
    
    const daysOfWeek = ["月", "火", "水", "木", "金", "土", "日"];
    const timeOptions = generateTimeOptions();
    const targetMonday = getTargetMonday();
    const targetDates = generateTargetWeekDates(targetMonday);

    const startMonth = targetDates[0].getMonth() + 1;
    const startDate = targetDates[0].getDate();
    const endMonth = targetDates[6].getMonth() + 1;
    const endDate = targetDates[6].getDate();
    document.getElementById('target-week-title').textContent = 
        `対象期間: ${startMonth}/${startDate} 〜 ${endMonth}/${endDate}`;

    targetDates.forEach((date, index) => {
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const fullDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const html = `
            <div class="day-row">
                <div class="day-label">${dateStr} (${daysOfWeek[index]})</div>
                <div class="time-selects">
                    <select class="start-time" data-date="${fullDateStr}">
                        ${timeOptions}
                    </select>
                    <span class="time-separator">〜</span>
                    <select class="end-time" data-date="${fullDateStr}">
                        ${timeOptions}
                    </select>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// シフト提出データをGASへ送信（POST）
function submitShiftData() {
    const savedName = localStorage.getItem('castGenjiName');
    const shifts = [];
    const startElements = document.querySelectorAll('.start-time');
    const endElements = document.querySelectorAll('.end-time');

    startElements.forEach((startEl, index) => {
        const endEl = endElements[index];
        shifts.push({
            date: startEl.getAttribute('data-date'),
            start: startEl.value,
            end: endEl.value
        });
    });

    const submitData = { castName: savedName, shiftData: shifts };
    const submitBtn = document.getElementById('submit-shift-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = "送信中...";

    fetch(GAS_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData)
    })
    .then(() => {
        alert("シフトの提出が完了しました！");
        submitBtn.textContent = "提出完了";
        if (liff.isInClient()) { liff.closeWindow(); }
    })
    .catch(err => {
        console.error("送信エラー:", err);
        alert("送信に失敗しました。");
        submitBtn.disabled = false;
        submitBtn.textContent = "シフトを提出する";
    });
}

// 提出済みシフトをGASから取得（GET）して画面に表示
function fetchViewShifts() {
    const savedName = localStorage.getItem('castGenjiName');
    const container = document.getElementById('shift-list-container');
    container.innerHTML = '<p style="text-align: center; color: #888;">読み込み中...</p>';

    const url = `${GAS_WEB_APP_URL}?castName=${encodeURIComponent(savedName)}`;

    fetch(url)
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success") {
            const data = resData.data;
            if (data.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">提出済みのシフトはありません。</p>';
                return;
            }

            container.innerHTML = ""; 
            data.forEach(shift => {
                let timeStr = "休み";
                if (shift.start || shift.end) {
                    // 【追加】閲覧画面でも「27:00」を「LAST」に変換して見やすくする
                    const startText = shift.start === "27:00" ? "LAST" : (shift.start || "未定");
                    const endText = shift.end === "27:00" ? "LAST" : (shift.end || "未定");
                    timeStr = `${startText} 〜 ${endText}`;
                }

                const html = `
                    <div class="view-day-row">
                        <div class="view-date">${shift.dateLabel}</div>
                        <div class="view-time">${timeStr}</div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        } else {
            container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">データの取得に失敗しました。</p>';
        }
    })
    .catch(err => {
        console.error("データ取得エラー:", err);
        container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">通信エラーが発生しました。</p>';
    });
}